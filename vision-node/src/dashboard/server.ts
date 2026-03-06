/**
 * Vision Node - Dashboard Server
 *
 * Express-based local web server that provides:
 * - Static dashboard UI at localhost:9090
 * - REST API for real-time node stats
 * - SSE (Server-Sent Events) for live updates
 */

import express from 'express';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { nodeManager } from '../core/nodeManager.js';
import { heartbeatService } from '../core/heartbeat.js';
import { storageService } from '../core/storageService.js';
import { configManager } from '../config/nodeConfig.js';
import { createAgentRouter } from '../api/agentRouter.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let server: ReturnType<typeof express.application.listen> | null = null;

export function startDashboard(port: number): void {
    const app = express();

    // JSON body parser for Agent API
    app.use(express.json({ limit: '50mb' }));

    // ── Public Chunk Serving (no auth, CORS enabled) ──

    // CORS middleware for chunk endpoints
    const chunkCors = (_req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
        next();
    };

    // Health check
    app.get('/health', chunkCors, (_req, res) => {
        const status = nodeManager.getStatus();
        res.json({
            ok: status.isRunning,
            nodeId: status.nodeId,
            nodeClass: status.nodeClass,
            storage: {
                totalChunks: status.storage.totalChunks,
                usedBytes: status.storage.usedBytes,
                maxGB: status.storage.maxGB,
                usagePercent: status.storage.usagePercent,
            },
            uptime: status.uptimeSeconds,
        });
    });

    // Check if chunk exists
    app.get('/chunks/:hash/exists', chunkCors, (req, res) => {
        const { hash } = req.params;
        if (!hash || hash.length < 16) {
            return res.status(400).json({ exists: false, error: 'Invalid hash' });
        }
        const exists = storageService.hasChunk(hash);
        res.json({ exists, hash });
    });

    // Serve chunk data (binary)
    app.get('/chunks/:hash', chunkCors, (req, res) => {
        const { hash } = req.params;
        if (!hash || hash.length < 16) {
            return res.status(400).send('Invalid hash');
        }
        const data = storageService.getChunk(hash);
        if (!data) {
            return res.status(404).send('Chunk not found');
        }
        res.set('Content-Type', 'application/octet-stream');
        res.set('Content-Length', String(data.length));
        res.set('X-Chunk-Hash', hash);
        res.set('Cache-Control', 'public, max-age=31536000, immutable'); // chunks are immutable
        res.send(data);
    });

    // Mount Agent API (auth required)
    app.use('/agent/v1', createAgentRouter());

    // Serve static files
    app.use(express.static(join(__dirname, '..', '..', 'src', 'dashboard', 'public')));

    // API: Node status
    app.get('/api/status', (_req, res) => {
        const status = nodeManager.getStatus();
        res.json(status);
    });

    // API: Storage stats
    app.get('/api/storage', (_req, res) => {
        const stats = storageService.getStats();
        const files = storageService.listFiles();
        res.json({ stats, files });
    });

    // API: Heartbeat stats
    app.get('/api/heartbeat', (_req, res) => {
        const stats = heartbeatService.getStats();
        res.json(stats);
    });

    // API: Config
    app.get('/api/config', (_req, res) => {
        const config = configManager.get();
        // Omit sensitive fields
        const { apiKey, ...safeConfig } = config;
        res.json(safeConfig);
    });

    // API: Update storage allocation
    app.post('/api/config/storage', (req, res) => {
        try {
            const { storageMaxGB } = req.body;
            if (storageMaxGB === undefined || typeof storageMaxGB !== 'number') {
                return res.status(400).json({ error: 'storageMaxGB (number) is required' });
            }

            const config = configManager.get();
            const minGB = config.nodeClass === 'lite' ? 0.1 : config.nodeClass === 'full' ? 100 : 1;
            const maxGB = config.nodeClass === 'lite' ? 1 : config.nodeClass === 'full' ? 1000 : 100;
            const clamped = Math.max(minGB, Math.min(maxGB, storageMaxGB));

            configManager.update({ storageMaxGB: clamped });
            configManager.save();

            const stats = storageService.getStats();
            res.json({
                success: true,
                storageMaxGB: clamped,
                currentUsageBytes: stats.totalSizeBytes,
                usagePercent: clamped > 0
                    ? Math.round((stats.totalSizeBytes / (clamped * 1024 * 1024 * 1024)) * 100)
                    : 0,
            });

            console.log(`[Dashboard] Storage allocation updated to ${clamped} GB`);
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            res.status(500).json({ error: errMsg });
        }
    });

    // SSE: Live updates (push every 5 seconds)
    app.get('/api/events', (_req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        });

        const send = () => {
            const data = {
                status: nodeManager.getStatus(),
                storage: storageService.getStats(),
                heartbeat: heartbeatService.getStats(),
                timestamp: Date.now(),
            };
            res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        send();
        const interval = setInterval(send, 5000);

        _req.on('close', () => {
            clearInterval(interval);
        });
    });

    server = app.listen(port, () => {
        console.log(`[Dashboard] Running at http://localhost:${port}`);
        console.log(`[Agent API] Endpoints at http://localhost:${port}/agent/v1/actions`);
    });
}

export function stopDashboard(): void {
    if (server) {
        server.close();
        server = null;
        console.log('[Dashboard] Stopped');
    }
}
