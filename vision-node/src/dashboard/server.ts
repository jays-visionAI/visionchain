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

    // Mount Agent API
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
