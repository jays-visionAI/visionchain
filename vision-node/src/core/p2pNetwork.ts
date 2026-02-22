/**
 * Vision Node - P2P Network Layer
 *
 * WebSocket-based peer-to-peer networking for the Vision Node network.
 *
 * Features:
 *   - Peer discovery via signaling server
 *   - Direct WebSocket connections between peers
 *   - Gossip-based message propagation
 *   - Chunk request/response for distributed storage
 *   - Peer health monitoring with auto-reconnect
 *   - Peer reputation tracking
 */

import WebSocket, { WebSocketServer } from 'ws';
import { configManager } from '../config/nodeConfig.js';
import { storageService } from './storageService.js';
import { hostname, platform, arch, cpus } from 'os';

// ── Types ──

export interface PeerInfo {
    nodeId: string;
    address: string;
    port: number;
    nodeClass: string;
    capabilities: string[];
    connectedAt: number;
    lastPing: number;
    latencyMs: number;
    reputation: number;
}

export interface P2PMessage {
    type: string;
    from: string;
    to?: string;       // empty = broadcast
    id: string;
    timestamp: number;
    ttl: number;
    payload: any;
}

export interface P2PStats {
    isRunning: boolean;
    nodeId: string;
    listeningPort: number;
    connectedPeers: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalChunksShared: number;
    peers: Array<{
        nodeId: string;
        address: string;
        latencyMs: number;
        reputation: number;
        connectedAt: number;
    }>;
}

type MessageHandler = (msg: P2PMessage, peer: PeerInfo) => void;

// ── Constants ──

const SIGNAL_SERVER = 'wss://signal.visionchain.co';
const PING_INTERVAL = 30_000;        // 30s
const RECONNECT_DELAY = 10_000;      // 10s
const MAX_RECONNECT_DELAY = 300_000;  // 5min
const MAX_TTL = 5;                    // max hops for gossip
const MAX_PEERS = 12;                 // max direct connections
const SEEN_MSG_CACHE = 1000;          // dedup cache size

// ── P2P Service ──

class P2PNetwork {
    private wss: WebSocketServer | null = null;
    private signalWs: WebSocket | null = null;
    private peers = new Map<string, { info: PeerInfo; ws: WebSocket }>();
    private handlers = new Map<string, MessageHandler[]>();
    private seenMessages = new Set<string>();
    private running = false;
    private port = 4001;
    private nodeId = '';
    private pingTimer: ReturnType<typeof setInterval> | null = null;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    private reconnectDelay = RECONNECT_DELAY;
    private reconnectAttempts = 0;

    private stats = {
        totalMessagesSent: 0,
        totalMessagesReceived: 0,
        totalChunksShared: 0,
    };

    /**
     * Start the P2P network layer
     */
    start(): void {
        if (this.running) return;

        const config = configManager.get();
        this.port = config.p2pPort || 4001;
        this.nodeId = config.nodeId;
        this.running = true;

        // Start WebSocket server for incoming peer connections
        this.wss = new WebSocketServer({ port: this.port });

        this.wss.on('connection', (ws, req) => {
            const addr = req.socket.remoteAddress || 'unknown';
            console.log(`[P2P] Incoming connection from ${addr}`);
            this.handleIncomingConnection(ws, addr);
        });

        this.wss.on('error', (err) => {
            if ((err as any).code === 'EADDRINUSE') {
                console.warn(`[P2P] Port ${this.port} in use, trying ${this.port + 1}`);
                this.port++;
                this.wss?.close();
                this.wss = new WebSocketServer({ port: this.port });
            } else {
                console.error('[P2P] Server error:', err.message);
            }
        });

        // Register built-in message handlers
        this.registerBuiltinHandlers();

        // Connect to signaling server for peer discovery
        this.connectToSignalServer();

        // Start ping loop
        this.pingTimer = setInterval(() => this.pingPeers(), PING_INTERVAL);

        console.log(`[P2P] Listening on port ${this.port} (max ${MAX_PEERS} peers)`);
    }

    /**
     * Stop the P2P network
     */
    stop(): void {
        if (!this.running) return;

        this.running = false;

        // Close all peer connections
        for (const [id, peer] of this.peers) {
            try {
                peer.ws.close(1000, 'Node shutting down');
            } catch { }
        }
        this.peers.clear();

        // Close signal connection
        if (this.signalWs) {
            try { this.signalWs.close(); } catch { }
            this.signalWs = null;
        }

        // Stop server
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        // Clear timers
        if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
        if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null; }

        console.log('[P2P] Stopped');
    }

    /**
     * Broadcast a message to all connected peers
     */
    broadcast(type: string, payload: any): void {
        const msg: P2PMessage = {
            type,
            from: this.nodeId,
            id: this.generateMsgId(),
            timestamp: Date.now(),
            ttl: MAX_TTL,
            payload,
        };

        this.seenMessages.add(msg.id);
        this.trimSeenCache();

        for (const [, peer] of this.peers) {
            this.sendToPeer(peer.ws, msg);
        }
    }

    /**
     * Send a direct message to a specific peer
     */
    sendDirect(targetNodeId: string, type: string, payload: any): boolean {
        const peer = this.peers.get(targetNodeId);
        if (!peer || peer.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        const msg: P2PMessage = {
            type,
            from: this.nodeId,
            to: targetNodeId,
            id: this.generateMsgId(),
            timestamp: Date.now(),
            ttl: 1,
            payload,
        };

        this.sendToPeer(peer.ws, msg);
        return true;
    }

    /**
     * Register a handler for a message type
     */
    on(type: string, handler: MessageHandler): void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }
        this.handlers.get(type)!.push(handler);
    }

    /**
     * Request a chunk from the network
     */
    async requestChunk(chunkHash: string): Promise<Buffer | null> {
        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 10_000);

            // One-time handler for chunk response
            const handler = (msg: P2PMessage) => {
                if (msg.payload.chunkHash === chunkHash && msg.payload.data) {
                    clearTimeout(timeout);
                    resolve(Buffer.from(msg.payload.data, 'base64'));
                }
            };

            this.on('chunk:response', handler);

            // Request from all peers
            this.broadcast('chunk:request', { chunkHash });
        });
    }

    /**
     * Get P2P statistics
     */
    getStats(): P2PStats {
        return {
            isRunning: this.running,
            nodeId: this.nodeId,
            listeningPort: this.port,
            connectedPeers: this.peers.size,
            totalMessagesSent: this.stats.totalMessagesSent,
            totalMessagesReceived: this.stats.totalMessagesReceived,
            totalChunksShared: this.stats.totalChunksShared,
            peers: Array.from(this.peers.values()).map(p => ({
                nodeId: p.info.nodeId,
                address: p.info.address,
                latencyMs: p.info.latencyMs,
                reputation: p.info.reputation,
                connectedAt: p.info.connectedAt,
            })),
        };
    }

    /**
     * Connect to a peer by address
     */
    connectToPeer(address: string, port: number): void {
        if (this.peers.size >= MAX_PEERS) {
            console.log('[P2P] Max peers reached, skipping connection');
            return;
        }

        const url = `ws://${address}:${port}`;
        console.log(`[P2P] Connecting to ${url}`);

        try {
            const ws = new WebSocket(url, { handshakeTimeout: 5000 });

            ws.on('open', () => {
                // Send handshake
                const handshake: P2PMessage = {
                    type: 'handshake',
                    from: this.nodeId,
                    id: this.generateMsgId(),
                    timestamp: Date.now(),
                    ttl: 1,
                    payload: {
                        nodeId: this.nodeId,
                        port: this.port,
                        nodeClass: configManager.get().nodeClass,
                        capabilities: this.getCapabilities(),
                        version: '1.0.0',
                    },
                };
                this.sendToPeer(ws, handshake);
            });

            ws.on('message', (data) => this.handleMessage(ws, data.toString(), address));
            ws.on('close', () => this.handlePeerDisconnect(ws));
            ws.on('error', (err) => {
                console.warn(`[P2P] Connection to ${url} failed: ${err.message}`);
            });
        } catch (err) {
            console.warn(`[P2P] Failed to connect to ${address}:${port}`);
        }
    }

    // ── Private: Signal Server ──

    private connectToSignalServer(): void {
        try {
            this.signalWs = new WebSocket(SIGNAL_SERVER, { handshakeTimeout: 5000 });

            this.signalWs.on('open', () => {
                console.log('[P2P] Connected to signaling server');
                this.reconnectDelay = RECONNECT_DELAY;

                // Announce ourselves
                this.signalWs?.send(JSON.stringify({
                    type: 'announce',
                    nodeId: this.nodeId,
                    port: this.port,
                    nodeClass: configManager.get().nodeClass,
                    capabilities: this.getCapabilities(),
                    peers: this.peers.size,
                }));
            });

            this.signalWs.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());

                    if (msg.type === 'peers') {
                        // Signal server provides peer list
                        const peerList = msg.peers || [];
                        console.log(`[P2P] Discovered ${peerList.length} peers from signal server`);

                        for (const peer of peerList) {
                            if (peer.nodeId !== this.nodeId && !this.peers.has(peer.nodeId)) {
                                this.connectToPeer(peer.address, peer.port);
                            }
                        }
                    }

                    if (msg.type === 'connect') {
                        // Another peer wants to connect to us
                        if (!this.peers.has(msg.nodeId) && this.peers.size < MAX_PEERS) {
                            this.connectToPeer(msg.address, msg.port);
                        }
                    }
                } catch { }
            });

            this.signalWs.on('close', () => {
                if (this.reconnectAttempts === 0) {
                    console.log('[P2P] Signal server not available (will retry in background)');
                }
                this.scheduleReconnect();
            });

            this.signalWs.on('error', () => {
                // Swallow -- close event will fire
            });

        } catch {
            this.scheduleReconnect();
        }
    }

    private scheduleReconnect(): void {
        if (!this.running) return;

        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => {
            if (this.reconnectAttempts % 5 === 0) {
                console.log(`[P2P] Signal server reconnect attempt #${this.reconnectAttempts}...`);
            }
            this.connectToSignalServer();
        }, this.reconnectDelay);

        // Exponential backoff
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
    }

    // ── Private: Connection Handling ──

    private handleIncomingConnection(ws: WebSocket, address: string): void {
        ws.on('message', (data) => this.handleMessage(ws, data.toString(), address));
        ws.on('close', () => this.handlePeerDisconnect(ws));
        ws.on('error', () => { });
    }

    private handleMessage(ws: WebSocket, raw: string, address: string): void {
        let msg: P2PMessage;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        this.stats.totalMessagesReceived++;

        // Dedup
        if (this.seenMessages.has(msg.id)) return;
        this.seenMessages.add(msg.id);
        this.trimSeenCache();

        // Handle specific types
        switch (msg.type) {
            case 'handshake':
                this.handleHandshake(ws, msg, address);
                break;

            case 'handshake:ack':
                this.handleHandshakeAck(ws, msg, address);
                break;

            case 'ping':
                this.sendToPeer(ws, {
                    type: 'pong',
                    from: this.nodeId,
                    to: msg.from,
                    id: this.generateMsgId(),
                    timestamp: Date.now(),
                    ttl: 1,
                    payload: { pingId: msg.payload.pingId },
                });
                break;

            case 'pong':
                this.handlePong(msg);
                break;

            default:
                // Route to registered handlers
                const handlers = this.handlers.get(msg.type) || [];
                const peerInfo = this.findPeerByNodeId(msg.from);
                if (peerInfo) {
                    for (const h of handlers) {
                        try { h(msg, peerInfo); } catch { }
                    }
                }

                // Gossip: forward to other peers if TTL > 0
                if (!msg.to && msg.ttl > 1) {
                    const fwd = { ...msg, ttl: msg.ttl - 1 };
                    for (const [id, peer] of this.peers) {
                        if (id !== msg.from) {
                            this.sendToPeer(peer.ws, fwd);
                        }
                    }
                }
                break;
        }
    }

    private handleHandshake(ws: WebSocket, msg: P2PMessage, address: string): void {
        const { nodeId, port, nodeClass, capabilities } = msg.payload;

        if (nodeId === this.nodeId) return; // self-connection
        if (this.peers.has(nodeId)) return; // already connected

        if (this.peers.size >= MAX_PEERS) {
            ws.close(4001, 'Max peers reached');
            return;
        }

        const peerInfo: PeerInfo = {
            nodeId,
            address,
            port: port || 4001,
            nodeClass: nodeClass || 'standard',
            capabilities: capabilities || [],
            connectedAt: Date.now(),
            lastPing: Date.now(),
            latencyMs: 0,
            reputation: 50,
        };

        this.peers.set(nodeId, { info: peerInfo, ws });
        console.log(`[P2P] Peer connected: ${nodeId} (${nodeClass}) [${this.peers.size}/${MAX_PEERS}]`);

        // Send ack
        this.sendToPeer(ws, {
            type: 'handshake:ack',
            from: this.nodeId,
            to: nodeId,
            id: this.generateMsgId(),
            timestamp: Date.now(),
            ttl: 1,
            payload: {
                nodeId: this.nodeId,
                port: this.port,
                nodeClass: configManager.get().nodeClass,
                capabilities: this.getCapabilities(),
                version: '1.0.0',
            },
        });
    }

    private handleHandshakeAck(ws: WebSocket, msg: P2PMessage, address: string): void {
        const { nodeId, port, nodeClass, capabilities } = msg.payload;
        if (this.peers.has(nodeId)) return;

        const peerInfo: PeerInfo = {
            nodeId,
            address,
            port: port || 4001,
            nodeClass: nodeClass || 'standard',
            capabilities: capabilities || [],
            connectedAt: Date.now(),
            lastPing: Date.now(),
            latencyMs: 0,
            reputation: 50,
        };

        this.peers.set(nodeId, { info: peerInfo, ws });
        console.log(`[P2P] Handshake complete with ${nodeId} [${this.peers.size}/${MAX_PEERS}]`);
    }

    private handlePeerDisconnect(ws: WebSocket): void {
        for (const [id, peer] of this.peers) {
            if (peer.ws === ws) {
                this.peers.delete(id);
                console.log(`[P2P] Peer disconnected: ${id} [${this.peers.size}/${MAX_PEERS}]`);
                break;
            }
        }
    }

    private handlePong(msg: P2PMessage): void {
        const peer = this.peers.get(msg.from);
        if (peer) {
            peer.info.lastPing = Date.now();
            peer.info.latencyMs = Date.now() - msg.timestamp;
        }
    }

    // ── Private: Built-in Handlers ──

    private registerBuiltinHandlers(): void {
        // Handle chunk requests from other peers
        this.on('chunk:request', (msg, peer) => {
            const { chunkHash } = msg.payload;
            const chunk = storageService.getChunk(chunkHash);

            if (chunk) {
                this.sendDirect(peer.nodeId, 'chunk:response', {
                    chunkHash,
                    data: chunk.toString('base64'),
                    size: chunk.length,
                });
                this.stats.totalChunksShared++;
                peer.reputation = Math.min(peer.reputation + 1, 100);
            }
        });

        // Handle peer announce (share our peer list)
        this.on('peer:discover', (msg, peer) => {
            const peerList = Array.from(this.peers.values())
                .filter(p => p.info.nodeId !== msg.from)
                .slice(0, 5)
                .map(p => ({
                    nodeId: p.info.nodeId,
                    address: p.info.address,
                    port: p.info.port,
                    nodeClass: p.info.nodeClass,
                }));

            this.sendDirect(peer.nodeId, 'peer:list', { peers: peerList });
        });

        // Handle peer list response
        this.on('peer:list', (msg) => {
            const { peers } = msg.payload;
            if (!Array.isArray(peers)) return;

            for (const p of peers) {
                if (p.nodeId !== this.nodeId && !this.peers.has(p.nodeId) && this.peers.size < MAX_PEERS) {
                    this.connectToPeer(p.address, p.port);
                }
            }
        });
    }

    // ── Private: Maintenance ──

    private pingPeers(): void {
        const now = Date.now();
        const stale: string[] = [];

        for (const [id, peer] of this.peers) {
            // Remove peers that haven't responded in 3 ping cycles
            if (now - peer.info.lastPing > PING_INTERVAL * 3) {
                stale.push(id);
                continue;
            }

            // Send ping
            const pingId = this.generateMsgId();
            this.sendToPeer(peer.ws, {
                type: 'ping',
                from: this.nodeId,
                to: id,
                id: pingId,
                timestamp: now,
                ttl: 1,
                payload: { pingId },
            });
        }

        // Cleanup stale peers
        for (const id of stale) {
            const peer = this.peers.get(id);
            if (peer) {
                try { peer.ws.close(4002, 'Ping timeout'); } catch { }
                this.peers.delete(id);
                console.log(`[P2P] Peer timed out: ${id}`);
            }
        }

        // Periodically request more peers if below threshold
        if (this.peers.size < MAX_PEERS / 2) {
            this.broadcast('peer:discover', {});
        }
    }

    // ── Private: Utilities ──

    private sendToPeer(ws: WebSocket, msg: P2PMessage): void {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(msg));
                this.stats.totalMessagesSent++;
            } catch { }
        }
    }

    private findPeerByNodeId(nodeId: string): PeerInfo | null {
        const peer = this.peers.get(nodeId);
        return peer?.info ?? null;
    }

    private getCapabilities(): string[] {
        const caps = ['storage', 'relay'];
        const config = configManager.get();
        if (config.nodeClass === 'full') caps.push('rpc_cache');
        return caps;
    }

    private generateMsgId(): string {
        return `${this.nodeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    private trimSeenCache(): void {
        if (this.seenMessages.size > SEEN_MSG_CACHE) {
            const iter = this.seenMessages.values();
            const toRemove = this.seenMessages.size - SEEN_MSG_CACHE;
            for (let i = 0; i < toRemove; i++) {
                this.seenMessages.delete(iter.next().value!);
            }
        }
    }
}

export const p2pNetwork = new P2PNetwork();
