#!/usr/bin/env node
'use strict';

/**
 * rpc-gateway: the only path from https://rpc.visionchain.co to geth.
 *
 * nginx (TLS) -> rpc-gateway (127.0.0.1:8600, method allowlist) -> geth HTTP
 *
 * Every request body is parsed and checked with rpc-allowlist.js; only allowed
 * calls are forwarded, re-serialized. No dependencies, so it runs with plain
 * `node` next to the sequencer (pm2 name: vision-rpc-gateway).
 *
 * Config: a JSON file given as the first argument (see rpc-gateway.example.json):
 *   {
 *     "listen":     { "host": "127.0.0.1", "port": 8600 },
 *     "upstream":   "http://127.0.0.1:8545",            // serves "/"
 *     "nodeRoutes": { "/node-2": "http://127.0.0.1:8546" } // optional, same allowlist
 *   }
 */

const fs = require('fs');
const http = require('http');
const https = require('https');
const { checkRequest, createRejectLog } = require('./rpc-allowlist');

const DEFAULTS = Object.freeze({
    listen: { host: '127.0.0.1', port: 8600 },
    upstream: 'http://127.0.0.1:8545',
    nodeRoutes: {},
    maxBodyBytes: 1024 * 1024,
    timeoutMs: 30000,
});

const CORS_HEADERS = Object.freeze({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
});

function loadConfig(file) {
    const raw = file ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    return { ...DEFAULTS, ...raw, listen: { ...DEFAULTS.listen, ...(raw.listen || {}) } };
}

function buildRoutes(config) {
    const routes = new Map([['/', new URL(config.upstream)]]);
    for (const [path, url] of Object.entries(config.nodeRoutes || {})) {
        if (!/^\/node-[0-9]+$/.test(path)) {
            throw new Error(`nodeRoutes: "${path}" is not of the form /node-N`);
        }
        routes.set(path, new URL(url));
    }
    for (const url of routes.values()) {
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error(`upstream ${url.href} must be http(s)`);
        }
    }
    return routes;
}

function routePath(rawUrl) {
    const path = (rawUrl || '/').split('?')[0];
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

function clientAddress(req) {
    const cf = req.headers['cf-connecting-ip'];
    if (cf) return String(cf);
    const xff = req.headers['x-forwarded-for'];
    if (xff) return String(xff).split(',')[0].trim();
    return req.socket.remoteAddress || '?';
}

function send(res, status, body, extraHeaders = {}) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(text),
        ...extraHeaders,
    });
    res.end(text);
}

function forward(upstream, payloadText, res, timeoutMs, log) {
    const client = upstream.protocol === 'https:' ? https : http;
    const upstreamReq = client.request(upstream, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Content-Length': Buffer.byteLength(payloadText),
        },
        timeout: timeoutMs,
    }, (upstreamRes) => {
        res.writeHead(upstreamRes.statusCode || 502, {
            ...CORS_HEADERS,
            'Content-Type': upstreamRes.headers['content-type'] || 'application/json',
        });
        upstreamRes.pipe(res);
    });

    upstreamReq.on('timeout', () => upstreamReq.destroy(new Error('upstream timeout')));
    upstreamReq.on('error', (err) => {
        log.error(`[rpc-gateway] upstream ${upstream.host}: ${err.message}`);
        if (!res.headersSent) {
            send(res, 502, { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'upstream unavailable' } });
        } else {
            res.destroy();
        }
    });
    upstreamReq.end(payloadText);
}

function createGateway(config = DEFAULTS, { log = console } = {}) {
    const routes = buildRoutes(config);
    const maxBodyBytes = config.maxBodyBytes || DEFAULTS.maxBodyBytes;
    const timeoutMs = config.timeoutMs || DEFAULTS.timeoutMs;
    const logRejected = createRejectLog(log);

    return http.createServer((req, res) => {
        const path = routePath(req.url);

        if (path === '/healthz' && req.method === 'GET') {
            return send(res, 200, { ok: true });
        }
        const upstream = routes.get(path);
        if (!upstream) {
            return send(res, 404, { error: 'not found' });
        }
        if (req.method === 'OPTIONS') {
            res.writeHead(204, CORS_HEADERS);
            return res.end();
        }
        if (req.method !== 'POST') {
            return send(res, 405, { error: 'use POST with a JSON-RPC body' }, { Allow: 'POST, OPTIONS' });
        }

        const chunks = [];
        let size = 0;
        let tooLarge = false;
        req.on('data', (chunk) => {
            if (tooLarge) return;
            size += chunk.length;
            if (size > maxBodyBytes) {
                tooLarge = true;
                send(res, 413, { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'request too large' } },
                    { Connection: 'close' });
                req.resume();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => {
            if (tooLarge) return;
            let body;
            try {
                body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
                return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } });
            }
            const checked = checkRequest(body);
            if (!checked.ok) {
                logRejected(path, checked.rejected, clientAddress(req));
                return send(res, 200, checked.reply);
            }
            forward(upstream, JSON.stringify(checked.payload), res, timeoutMs, log);
        });
        req.on('error', () => res.destroy());
    });
}

if (require.main === module) {
    const config = loadConfig(process.argv[2]);
    const server = createGateway(config);
    server.listen(config.listen.port, config.listen.host, () => {
        console.log(`[rpc-gateway] listening on ${config.listen.host}:${config.listen.port}`);
        for (const [path, url] of buildRoutes(config)) {
            console.log(`[rpc-gateway]   ${path} -> ${url.href}`);
        }
    });
}

module.exports = { createGateway, loadConfig, buildRoutes };
