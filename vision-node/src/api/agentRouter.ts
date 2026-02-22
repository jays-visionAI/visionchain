/**
 * Vision Node - Agent API
 *
 * Local REST API for programmatic node control by AI agents.
 * All endpoints are prefixed with /agent/v1/
 *
 * Authentication: Bearer token (API key from config)
 *
 * Endpoints:
 *   POST /agent/v1/node/status     - Get node status
 *   POST /agent/v1/node/start      - Start the node
 *   POST /agent/v1/node/stop       - Stop the node
 *   POST /agent/v1/node/config     - Get/update config
 *
 *   POST /agent/v1/storage/upload   - Upload data
 *   POST /agent/v1/storage/download - Download data
 *   POST /agent/v1/storage/delete   - Delete a file
 *   POST /agent/v1/storage/list     - List stored files
 *   POST /agent/v1/storage/stats    - Storage statistics
 *
 *   POST /agent/v1/heartbeat/stats  - Heartbeat stats
 *   POST /agent/v1/heartbeat/beat   - Force a heartbeat
 *
 *   POST /agent/v1/p2p/stats        - P2P network stats
 *   POST /agent/v1/p2p/peers        - List connected peers
 *   POST /agent/v1/p2p/connect      - Connect to a peer
 *   POST /agent/v1/p2p/broadcast    - Broadcast a message
 *
 *   GET  /agent/v1/actions         - List all available actions
 */

import { Router, type Request, type Response } from 'express';
import { nodeManager } from '../core/nodeManager.js';
import { storageService } from '../core/storageService.js';
import { heartbeatService } from '../core/heartbeat.js';
import { p2pNetwork } from '../core/p2pNetwork.js';
import { configManager } from '../config/nodeConfig.js';

export function createAgentRouter(): Router {
    const router = Router();

    // ── Auth Middleware ──
    router.use((req: Request, res: Response, next) => {
        // Skip auth for actions list (discovery)
        if (req.path === '/actions' && req.method === 'GET') {
            return next();
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: 'Missing or invalid Authorization header. Use: Bearer <api_key>',
            });
        }

        const token = authHeader.slice(7);
        const config = configManager.get();

        // Accept either the node's API key or a special agent key
        if (token !== config.apiKey && token !== 'vision-agent-local') {
            return res.status(403).json({
                success: false,
                error: 'Invalid API key',
            });
        }

        next();
    });

    // ── Discovery: List all actions ──
    router.get('/actions', (_req: Request, res: Response) => {
        res.json({
            success: true,
            version: '1.0.0',
            actions: [
                { method: 'POST', path: '/agent/v1/node/status', description: 'Get current node status' },
                { method: 'POST', path: '/agent/v1/node/start', description: 'Start the node' },
                { method: 'POST', path: '/agent/v1/node/stop', description: 'Stop the node' },
                { method: 'POST', path: '/agent/v1/node/config', description: 'Get or update node config', params: { set: 'object (optional) - key-value pairs to update' } },
                { method: 'POST', path: '/agent/v1/storage/upload', description: 'Upload data to storage', params: { data: 'string (base64)', metadata: 'object (optional)' } },
                { method: 'POST', path: '/agent/v1/storage/download', description: 'Download a file', params: { file_key: 'string' } },
                { method: 'POST', path: '/agent/v1/storage/delete', description: 'Delete a file', params: { file_key: 'string' } },
                { method: 'POST', path: '/agent/v1/storage/list', description: 'List all stored files' },
                { method: 'POST', path: '/agent/v1/storage/stats', description: 'Get storage statistics' },
                { method: 'POST', path: '/agent/v1/heartbeat/stats', description: 'Get heartbeat statistics' },
                { method: 'POST', path: '/agent/v1/heartbeat/beat', description: 'Force an immediate heartbeat' },
                { method: 'POST', path: '/agent/v1/p2p/stats', description: 'Get P2P network statistics' },
                { method: 'POST', path: '/agent/v1/p2p/peers', description: 'List connected peers' },
                { method: 'POST', path: '/agent/v1/p2p/connect', description: 'Connect to a peer', params: { address: 'string', port: 'number' } },
                { method: 'POST', path: '/agent/v1/p2p/broadcast', description: 'Broadcast a message to all peers', params: { type: 'string', payload: 'object' } },
            ],
        });
    });

    // ══════════════════════════════════════
    // NODE CONTROL
    // ══════════════════════════════════════

    router.post('/node/status', (_req: Request, res: Response) => {
        const status = nodeManager.getStatus();
        res.json({ success: true, ...status });
    });

    router.post('/node/start', async (_req: Request, res: Response) => {
        try {
            if (nodeManager.isRunning()) {
                return res.json({ success: true, message: 'Node is already running' });
            }
            await nodeManager.start();
            res.json({ success: true, message: 'Node started' });
        } catch (err) {
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    router.post('/node/stop', async (_req: Request, res: Response) => {
        try {
            if (!nodeManager.isRunning()) {
                return res.json({ success: true, message: 'Node is not running' });
            }
            await nodeManager.stop();
            res.json({ success: true, message: 'Node stopped' });
        } catch (err) {
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    router.post('/node/config', (req: Request, res: Response) => {
        const { set } = req.body || {};

        if (set && typeof set === 'object') {
            // Update config
            const allowed = ['storageMaxGB', 'heartbeatIntervalMs', 'dashboardPort', 'p2pPort', 'nodeClass', 'environment'];
            const updates: Record<string, unknown> = {};
            const rejected: string[] = [];

            for (const [key, value] of Object.entries(set)) {
                if (allowed.includes(key)) {
                    updates[key] = value;
                } else {
                    rejected.push(key);
                }
            }

            if (Object.keys(updates).length > 0) {
                configManager.update(updates as any);
                configManager.save();
            }

            return res.json({
                success: true,
                updated: Object.keys(updates),
                rejected,
                config: sanitizeConfig(configManager.get()),
            });
        }

        // Read config
        res.json({
            success: true,
            config: sanitizeConfig(configManager.get()),
        });
    });

    // ══════════════════════════════════════
    // STORAGE
    // ══════════════════════════════════════

    router.post('/storage/upload', (req: Request, res: Response) => {
        const { data, metadata } = req.body || {};

        if (!data) {
            return res.status(400).json({ success: false, error: 'data (base64 string) is required' });
        }

        try {
            const buffer = Buffer.from(data, 'base64');
            const result = storageService.upload(buffer, metadata);

            if (result.success) {
                res.json({
                    success: true,
                    file_key: result.fileKey,
                    cid: result.cid,
                    merkle_root: result.merkleRoot,
                    total_size: result.totalSize,
                    chunk_count: result.chunkCount,
                });
            } else {
                res.status(500).json({ success: false, error: result.error });
            }
        } catch (err) {
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    router.post('/storage/download', (req: Request, res: Response) => {
        const { file_key } = req.body || {};

        if (!file_key) {
            return res.status(400).json({ success: false, error: 'file_key is required' });
        }

        const result = storageService.download(file_key);
        if (result.success && result.data) {
            res.json({
                success: true,
                data: result.data.toString('base64'),
                size: result.data.length,
            });
        } else {
            res.status(404).json({ success: false, error: result.error || 'File not found' });
        }
    });

    router.post('/storage/delete', (req: Request, res: Response) => {
        const { file_key } = req.body || {};

        if (!file_key) {
            return res.status(400).json({ success: false, error: 'file_key is required' });
        }

        const deleted = storageService.delete(file_key);
        res.json({ success: deleted, message: deleted ? 'File deleted' : 'File not found' });
    });

    router.post('/storage/list', (_req: Request, res: Response) => {
        const files = storageService.listFiles();
        res.json({
            success: true,
            count: files.length,
            files: files.map(f => ({
                file_key: f.fileKey,
                merkle_root: f.merkleRoot,
                total_size: f.totalSize,
                chunk_count: f.chunkCount,
                created_at: f.createdAt,
            })),
        });
    });

    router.post('/storage/stats', (_req: Request, res: Response) => {
        const stats = storageService.getStats();
        res.json({
            success: true,
            ...stats,
        });
    });

    // ══════════════════════════════════════
    // HEARTBEAT
    // ══════════════════════════════════════

    router.post('/heartbeat/stats', (_req: Request, res: Response) => {
        const stats = heartbeatService.getStats();
        res.json({ success: true, ...stats });
    });

    router.post('/heartbeat/beat', async (_req: Request, res: Response) => {
        try {
            await heartbeatService.beat();
            const stats = heartbeatService.getStats();
            res.json({
                success: true,
                message: 'Heartbeat sent',
                totalHeartbeats: stats.totalHeartbeats,
                weight: stats.weight,
                pendingReward: stats.pendingReward,
            });
        } catch (err) {
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    // ══════════════════════════════════════
    // P2P NETWORK
    // ══════════════════════════════════════

    router.post('/p2p/stats', (_req: Request, res: Response) => {
        const stats = p2pNetwork.getStats();
        res.json({ success: true, ...stats });
    });

    router.post('/p2p/peers', (_req: Request, res: Response) => {
        const stats = p2pNetwork.getStats();
        res.json({
            success: true,
            connectedPeers: stats.connectedPeers,
            peers: stats.peers,
        });
    });

    router.post('/p2p/connect', (req: Request, res: Response) => {
        const { address, port } = req.body || {};
        if (!address || !port) {
            return res.status(400).json({ success: false, error: 'Missing address or port' });
        }

        try {
            p2pNetwork.connectToPeer(address, Number(port));
            res.json({ success: true, message: `Connecting to ${address}:${port}` });
        } catch (err) {
            res.status(500).json({ success: false, error: String(err) });
        }
    });

    router.post('/p2p/broadcast', (req: Request, res: Response) => {
        const { type, payload } = req.body || {};
        if (!type) {
            return res.status(400).json({ success: false, error: 'Missing message type' });
        }

        p2pNetwork.broadcast(type, payload || {});
        res.json({ success: true, message: `Broadcast sent: ${type}` });
    });

    return router;
}

/**
 * Remove sensitive fields from config before returning to agents
 */
function sanitizeConfig(config: any) {
    const { apiKey, ...safe } = config;
    return safe;
}
