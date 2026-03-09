const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, shell, nativeTheme, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

// ── Config ──
const CONFIG_DIR = path.join(os.homedir(), '.visionnode');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const LOCK_PATH = path.join(CONFIG_DIR, 'node.lock');
const STORAGE_DIR = path.join(CONFIG_DIR, 'storage');
const PRODUCTION_API = 'https://us-central1-visionchain-d19ed.cloudfunctions.net/agentGateway';
const STAGING_API = 'https://us-central1-visionchain-staging.cloudfunctions.net/agentGateway';

let mainWindow = null;
let tray = null;
let nodeRunning = false;
let heartbeatTimer = null;
let config = null;
let storageServer = null;
let chunkSyncTimer = null;
let isOnWifi = true; // Desktop defaults to WiFi
let nodeStats = {
    heartbeatCount: 0,
    lastHeartbeat: null,
    pendingReward: 0,
    totalEarned: 0,
    pendingUsdt: 0,
    totalUsdtEarned: 0,
    pendingRp: 0,
    totalRpEarned: 0,
    weight: 0,
    baseWeight: 0,
    storageBonus: 0,
    chunksHeld: 0,
    storedGB: 0,
    uptimeSeconds: 0,
    startedAt: null,
    errors: [],
    storageChunks: 0,
    storageBytes: 0,
    chunkServed: 0,
};

// ── Force dark mode ──
nativeTheme.themeSource = 'dark';

// ── Process Lock ──
// Ensures only ONE node instance (CLI or App) runs per machine.
function isProcessAlive(pid) {
    try { process.kill(pid, 0); return true; } catch { return false; }
}

function readLock() {
    if (!fs.existsSync(LOCK_PATH)) return null;
    try { return JSON.parse(fs.readFileSync(LOCK_PATH, 'utf-8')); } catch { return null; }
}

function acquireLock() {
    if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

    const existing = readLock();
    if (existing && isProcessAlive(existing.pid)) {
        return existing; // Another instance is running
    }
    // Remove stale lock
    if (existing) try { fs.unlinkSync(LOCK_PATH); } catch { }

    // Write our lock
    const lock = {
        pid: process.pid,
        client: 'app',
        startedAt: new Date().toISOString(),
        version: '1.1.1-beta',
    };
    fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2), 'utf-8');
    return null; // success
}

function releaseLock() {
    const existing = readLock();
    if (existing && existing.pid === process.pid) {
        try { fs.unlinkSync(LOCK_PATH); } catch { }
    }
}

// ── Config Management ──
function loadConfig() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_PATH)) {
        try {
            config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            return config;
        } catch { }
    }
    return null;
}

function saveConfig(cfg) {
    config = cfg;
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function isInitialized() {
    return config && config.email && config.apiKey;
}

// ── Gateway API calls ──
async function callGateway(body) {
    const apiUrl = config?.apiUrl || PRODUCTION_API;
    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'VisionNodeApp/1.0.0',
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
    }
    return response.json();
}

async function registerNode(email, nodeClass, storageGB, environment, referralCode) {
    const deviceId = `desktop_${crypto.randomBytes(8).toString('hex')}`;
    const apiUrl = environment === 'staging' ? STAGING_API : PRODUCTION_API;

    const body = {
        action: 'mobile_node.register',
        email,
        device_id: deviceId,
        device_type: 'desktop',
        platform: process.platform,
        node_class: nodeClass,
        version: '1.1.1-beta',
    };
    if (referralCode) body.referral_code = referralCode;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Registration failed: HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success && !result.node_id) throw new Error(result.error || 'Registration failed');

    const cfg = {
        nodeId: result.node_id,
        email,
        apiKey: result.api_key,
        walletAddress: result.wallet_address,
        referralCode: result.referral_code || '',
        nodeClass,
        environment,
        storagePath: STORAGE_DIR,
        storageMaxGB: storageGB,
        heartbeatIntervalMs: 5 * 60 * 1000,
        dashboardPort: 9090,
        p2pPort: 4001,
        apiUrl,
        wsRpcUrl: 'wss://ws.rpc.visionchain.co',
        registered: true,
        firstLaunch: new Date().toISOString(),
        lastLaunch: new Date().toISOString(),
    };

    saveConfig(cfg);
    return cfg;
}

// ── Heartbeat ──
async function sendHeartbeat() {
    if (!config || !config.apiKey) return;

    try {
        const result = await callGateway({
            action: 'mobile_node.heartbeat',
            api_key: config.apiKey,
            mode: 'wifi_full',
            platform: process.platform,
            node_class: config.nodeClass,
            storage_max_gb: config.storageMaxGB,
            version: '1.1.1-beta',
            chunk_endpoint: `http://${os.hostname()}:${CHUNK_PORT}`,
        });

        nodeStats.heartbeatCount++;
        nodeStats.lastHeartbeat = new Date();

        if (result.accepted) {
            nodeStats.weight = result.weight || 0;
            nodeStats.baseWeight = result.base_weight || 0;
            nodeStats.storageBonus = result.storage_bonus || 0;
            nodeStats.chunksHeld = result.chunks_held || 0;
            nodeStats.storedGB = result.stored_gb || 0;
            // 3-tier rewards
            nodeStats.pendingReward = result.pending_reward || nodeStats.pendingReward;
            nodeStats.totalEarned = result.total_earned || nodeStats.totalEarned;
            nodeStats.pendingUsdt = result.pending_usdt || nodeStats.pendingUsdt;
            nodeStats.totalUsdtEarned = result.total_usdt_earned || nodeStats.totalUsdtEarned;
            nodeStats.pendingRp = result.pending_rp || nodeStats.pendingRp;
            nodeStats.totalRpEarned = result.total_rp_earned || nodeStats.totalRpEarned;
        }

        // Update uptime
        if (nodeStats.startedAt) {
            nodeStats.uptimeSeconds = Math.floor((Date.now() - nodeStats.startedAt) / 1000);
        }

        sendToRenderer('node:heartbeat', {
            success: true,
            accepted: result.accepted,
            weight: result.weight,
            base_weight: result.base_weight,
            storage_bonus: result.storage_bonus,
            chunks_held: result.chunks_held,
            // 3-tier rewards for this heartbeat
            vcn_reward: result.heartbeat_reward,
            usdt_reward: result.heartbeat_usdt,
            rp_reward: result.heartbeat_rp,
            // Pending totals
            pending_vcn: result.pending_reward,
            pending_usdt: result.pending_usdt,
            pending_rp: result.pending_rp,
        });
        sendToRenderer('node:stats', getNodeStatus());

    } catch (err) {
        nodeStats.errors.push({ time: new Date(), message: err.message });
        if (nodeStats.errors.length > 20) nodeStats.errors.shift();
        sendToRenderer('node:heartbeat', { success: false, error: err.message });
        sendToRenderer('node:stats', getNodeStatus());
    }
}

function getNodeStatus() {
    const uptime = nodeStats.startedAt
        ? Math.floor((Date.now() - nodeStats.startedAt) / 1000)
        : 0;

    return {
        running: nodeRunning,
        nodeId: config?.nodeId || '',
        email: config?.email || '',
        nodeClass: config?.nodeClass || '',
        storageMaxGB: config?.storageMaxGB || 0,
        environment: config?.environment || 'production',
        walletAddress: config?.walletAddress || '',
        heartbeatCount: nodeStats.heartbeatCount,
        lastHeartbeat: nodeStats.lastHeartbeat?.toISOString() || null,
        pendingReward: nodeStats.pendingReward,
        totalEarned: nodeStats.totalEarned,
        weight: nodeStats.weight,
        baseWeight: nodeStats.baseWeight,
        storageBonus: nodeStats.storageBonus,
        chunksHeld: nodeStats.chunksHeld,
        storedGB: nodeStats.storedGB,
        // 3-tier rewards
        pendingUsdt: nodeStats.pendingUsdt,
        totalUsdtEarned: nodeStats.totalUsdtEarned,
        pendingRp: nodeStats.pendingRp,
        totalRpEarned: nodeStats.totalRpEarned,
        uptimeSeconds: uptime,
        errors: nodeStats.errors.slice(-5),
        // Storage stats
        storageChunks: nodeStats.storageChunks,
        storageBytes: nodeStats.storageBytes,
        chunkServed: nodeStats.chunkServed,
        isOnWifi,
    };
}

// ── Node Start/Stop ──

// ── Local Chunk Storage ──
const CHUNKS_DIR = path.join(STORAGE_DIR, 'chunks');
const DB_PATH = path.join(STORAGE_DIR, 'chunks.db');
let chunkDb = null;

function initChunkStorage() {
    if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });

    // better-sqlite3 is a native module that may fail on some platforms
    // (e.g., cross-compiled from macOS to Windows). Wrap in try-catch
    // and fall back to filesystem-only mode gracefully.
    let Database = null;
    try {
        Database = require('better-sqlite3');
    } catch (loadErr) {
        console.warn('[Storage] better-sqlite3 native module not available:', loadErr.message);
        console.warn('[Storage] Falling back to filesystem-only chunk storage');
        chunkDb = null;
        return;
    }

    try {
        chunkDb = new Database(DB_PATH);
        chunkDb.pragma('journal_mode = WAL');
        chunkDb.exec(`
            CREATE TABLE IF NOT EXISTS chunks (
                hash TEXT PRIMARY KEY,
                file_key TEXT,
                chunk_index INTEGER,
                size INTEGER,
                created_at INTEGER,
                last_accessed INTEGER
            )
        `);
        console.log('[Storage] SQLite chunk index initialized');
    } catch (dbErr) {
        console.warn('[Storage] SQLite initialization failed:', dbErr.message);
        chunkDb = null;
    }
}

function getChunkPath(hash) {
    const prefix = hash.substring(0, 2);
    const dir = path.join(CHUNKS_DIR, prefix);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, hash);
}

function storeChunk(hash, data, fileKey = '', chunkIndex = 0) {
    const chunkPath = getChunkPath(hash);
    if (fs.existsSync(chunkPath)) return true; // Already stored

    // Check storage limit
    const maxBytes = (config?.storageMaxGB || 5) * 1024 * 1024 * 1024;
    if (nodeStats.storageBytes + data.length > maxBytes) return false;

    fs.writeFileSync(chunkPath, data);

    if (chunkDb) {
        try {
            chunkDb.prepare(
                'INSERT OR REPLACE INTO chunks (hash, file_key, chunk_index, size, created_at, last_accessed) VALUES (?, ?, ?, ?, ?, ?)'
            ).run(hash, fileKey, chunkIndex, data.length, Date.now(), Date.now());
        } catch { /* ignore */ }
    }

    nodeStats.storageChunks++;
    nodeStats.storageBytes += data.length;
    return true;
}

function getChunk(hash) {
    const chunkPath = getChunkPath(hash);
    if (!fs.existsSync(chunkPath)) return null;
    return fs.readFileSync(chunkPath);
}

function hasChunk(hash) {
    return fs.existsSync(getChunkPath(hash));
}

function getStorageStats() {
    let totalChunks = 0;
    let totalBytes = 0;
    if (chunkDb) {
        try {
            const row = chunkDb.prepare('SELECT COUNT(*) as cnt, COALESCE(SUM(size),0) as total FROM chunks').get();
            totalChunks = row.cnt;
            totalBytes = row.total;
        } catch { /* ignore */ }
    }
    nodeStats.storageChunks = totalChunks;
    nodeStats.storageBytes = totalBytes;
    return { totalChunks, totalBytes };
}

// ── HTTP Chunk Server ──
const CHUNK_PORT = 9001;

function startChunkServer() {
    if (storageServer) return;
    try {
        const express = require('express');
        const app = express();

        // CORS
        app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
            if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
            next();
        });

        app.get('/health', (req, res) => {
            const stats = getStorageStats();
            res.json({
                ok: nodeRunning,
                nodeId: config?.nodeId || '',
                storage: { totalChunks: stats.totalChunks, usedBytes: stats.totalBytes },
            });
        });

        app.get('/chunks/:hash/exists', (req, res) => {
            const exists = hasChunk(req.params.hash);
            res.json({ exists, hash: req.params.hash });
        });

        app.get('/chunks/:hash', (req, res) => {
            const data = getChunk(req.params.hash);
            if (!data) return res.status(404).send('Chunk not found');
            nodeStats.chunkServed++;
            res.set('Content-Type', 'application/octet-stream');
            res.set('Content-Length', String(data.length));
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            res.send(data);
        });

        storageServer = app.listen(CHUNK_PORT, () => {
            console.log(`[Storage] Chunk server running at http://localhost:${CHUNK_PORT}`);
        });
    } catch (err) {
        console.warn('[Storage] Could not start chunk server:', err.message);
    }
}

function stopChunkServer() {
    if (storageServer) {
        storageServer.close();
        storageServer = null;
        console.log('[Storage] Chunk server stopped');
    }
}

// ── Chunk Registry Sync ──
async function syncChunkRegistry() {
    if (!nodeRunning || !config?.apiKey || !isOnWifi) return;

    try {
        const apiUrl = config.apiUrl || PRODUCTION_API;

        // Register local chunks
        const localChunks = [];
        if (chunkDb) {
            try {
                const rows = chunkDb.prepare('SELECT hash, file_key, size, chunk_index FROM chunks LIMIT 500').all();
                for (const r of rows) {
                    localChunks.push({ hash: r.hash, file_key: r.file_key, size: r.size, index: r.chunk_index });
                }
            } catch { /* ignore */ }
        }

        if (localChunks.length > 0) {
            await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'chunk.register',
                    node_id: config.nodeId,
                    chunks: localChunks,
                }),
            });
        }

        // Get replication assignments
        const assignResp = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'chunk.assignments',
                node_id: config.nodeId,
                capacity: (config.storageMaxGB || 5) * 1024 * 1024 * 1024 - nodeStats.storageBytes,
            }),
        });

        if (assignResp.ok) {
            const data = await assignResp.json();
            const assignments = data.assignments || [];

            for (const a of assignments.slice(0, 20)) {
                if (hasChunk(a.hash)) continue;
                // Fetch chunk from staging
                try {
                    const chunkResp = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'chunk.fetch_staging',
                            hash: a.hash,
                        }),
                    });
                    if (chunkResp.ok) {
                        const chunkData = await chunkResp.json();
                        if (chunkData.data) {
                            const buf = Buffer.from(chunkData.data, 'base64');
                            const stored = storeChunk(a.hash, buf, chunkData.file_key || a.file_key || '', chunkData.index || a.index || 0);
                            if (stored) {
                                // Confirm storage to server
                                fetch(apiUrl, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        action: 'chunk.stored',
                                        node_id: config.nodeId,
                                        hash: a.hash,
                                        size: buf.length,
                                    }),
                                }).catch(() => { });
                                console.log(`[ChunkSync] Stored chunk ${a.hash.substring(0, 12)}... (${buf.length} bytes)`);
                            }
                        }
                    }
                } catch { /* ignore individual chunk failures */ }
            }
        }

        sendToRenderer('node:stats', getNodeStatus());
    } catch (err) {
        console.warn('[ChunkSync] Error:', err.message);
    }
}

function startNode() {
    if (nodeRunning) return { success: true };

    // Check lock
    const lockHolder = acquireLock();
    if (lockHolder) {
        const clientName = lockHolder.client === 'app' ? 'Vision Node App' : 'Vision Node CLI';
        const msg = `Another instance is already running:\n${clientName} (PID ${lockHolder.pid})\n\nOnly one Vision Node can run per machine.\nStop the other instance first.`;
        sendToRenderer('node:error', { message: msg });
        return { success: false, error: msg };
    }

    nodeRunning = true;
    nodeStats.startedAt = Date.now();
    nodeStats.errors = [];

    // Ensure storage directory exists
    if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }

    // Initialize chunk storage and HTTP server
    initChunkStorage();
    startChunkServer();
    getStorageStats();

    // Send first heartbeat immediately
    sendHeartbeat();

    // Then every 5 minutes
    heartbeatTimer = setInterval(sendHeartbeat, config?.heartbeatIntervalMs || 300000);

    // Start chunk registry sync (every 2 minutes)
    syncChunkRegistry();
    chunkSyncTimer = setInterval(syncChunkRegistry, 120000);

    sendToRenderer('node:started', getNodeStatus());
    updateTrayMenu();
    return { success: true };
}

function stopNode() {
    if (!nodeRunning) return;
    nodeRunning = false;
    nodeStats.startedAt = null;
    if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
    }
    if (chunkSyncTimer) {
        clearInterval(chunkSyncTimer);
        chunkSyncTimer = null;
    }
    stopChunkServer();
    if (chunkDb) {
        try { chunkDb.close(); } catch { /* ignore */ }
        chunkDb = null;
    }
    releaseLock();
    sendToRenderer('node:stopped', getNodeStatus());
    updateTrayMenu();
}

// ── IPC Helpers ──
function sendToRenderer(channel, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(channel, data);
    }
}

// ── Window ──
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 680,
        minWidth: 780,
        minHeight: 580,
        titleBarStyle: 'hiddenInset',
        trafficLightPosition: { x: 16, y: 16 },
        backgroundColor: '#09090f',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('close', (e) => {
        if (nodeRunning) {
            e.preventDefault();
            mainWindow.hide();
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// ── Tray ──
function createTray() {
    const iconPath = path.join(__dirname, '..', '..', 'resources', 'tray-icon.png');
    if (fs.existsSync(iconPath)) {
        tray = new Tray(nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 }));
    } else {
        // Fallback: empty icon
        tray = new Tray(nativeImage.createEmpty());
    }
    tray.setToolTip('Vision Node');
    updateTrayMenu();

    tray.on('click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        } else {
            createWindow();
        }
    });
}

function updateTrayMenu() {
    if (!tray) return;
    const template = [
        { label: `Vision Node Beta v1.1.1`, enabled: false },
        { type: 'separator' },
        {
            label: nodeRunning ? 'Stop Node' : 'Start Node',
            click: () => {
                if (nodeRunning) stopNode();
                else if (isInitialized()) startNode();
            },
        },
        {
            label: 'Open Dashboard',
            click: () => {
                if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
                else createWindow();
            },
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                stopNode();
                app.quit();
            },
        },
    ];
    tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ── IPC Handlers ──
function setupIPC() {
    ipcMain.handle('node:getStatus', () => getNodeStatus());
    ipcMain.handle('node:isInitialized', () => isInitialized());
    ipcMain.handle('node:getConfig', () => config);

    ipcMain.handle('node:register', async (_, { email, nodeClass, storageGB, environment, referralCode }) => {
        try {
            const cfg = await registerNode(email, nodeClass, storageGB, environment || 'production', referralCode);
            return { success: true, config: cfg };
        } catch (err) {
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('node:start', () => {
        return startNode();
    });

    ipcMain.handle('node:stop', () => {
        stopNode();
        return { success: true };
    });

    ipcMain.handle('node:openExternal', (_, url) => {
        shell.openExternal(url);
    });

    // ── Settings Change Handlers ──
    ipcMain.handle('node:updateConfig', (_, updates) => {
        if (!config) return { success: false, error: 'Node not initialized' };

        const allowedFields = ['email', 'nodeClass', 'environment'];
        const classRanges = {
            lite: { min: 0.1, max: 1, default: 0.5 },
            standard: { min: 1, max: 100, default: 10 },
            full: { min: 100, max: 1000, default: 200 },
        };

        let changed = false;
        for (const key of allowedFields) {
            if (updates[key] !== undefined && updates[key] !== config[key]) {
                config[key] = updates[key];
                changed = true;

                // If nodeClass changed, adjust storage range and API URL
                if (key === 'nodeClass') {
                    const range = classRanges[updates[key]] || classRanges.standard;
                    if (config.storageMaxGB < range.min) config.storageMaxGB = range.default;
                    if (config.storageMaxGB > range.max) config.storageMaxGB = range.max;
                }
                if (key === 'environment') {
                    config.apiUrl = updates[key] === 'staging' ? STAGING_API : PRODUCTION_API;
                }
            }
        }

        if (changed) {
            saveConfig(config);
            sendToRenderer('node:stats', getNodeStatus());
        }

        return { success: true, config };
    });

    ipcMain.handle('node:updateStorage', (_, newGB) => {
        if (!config) return { success: false, error: 'Node not initialized' };

        const classRanges = {
            lite: { min: 0.1, max: 1 },
            standard: { min: 1, max: 100 },
            full: { min: 100, max: 1000 },
        };
        const range = classRanges[config.nodeClass] || classRanges.standard;
        const clamped = Math.max(range.min, Math.min(range.max, parseFloat(newGB)));

        config.storageMaxGB = clamped;
        saveConfig(config);
        sendToRenderer('node:stats', getNodeStatus());
        return { success: true, storageMaxGB: clamped };
    });

    // Leaderboard: fetch top nodes from server
    ipcMain.handle('node:getLeaderboard', async () => {
        if (!config?.apiKey) return { success: false, error: 'Not registered' };
        try {
            const apiUrl = config.apiUrl || PRODUCTION_API;
            const resp = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mobile_node.leaderboard',
                    api_key: config.apiKey,
                }),
            });
            const data = await resp.json();
            return { success: true, ...data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });

    // Claim VCN rewards
    ipcMain.handle('node:claimVCN', async () => {
        if (!config?.apiKey) return { success: false, error: 'Not registered' };
        if (parseFloat(nodeStats.pendingReward) < 0.001) {
            return { success: false, error: 'Minimum 0.001 VCN required to claim' };
        }
        try {
            const apiUrl = config.apiUrl || PRODUCTION_API;
            const resp = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'mobile_node.claim_reward',
                    api_key: config.apiKey,
                }),
            });
            const data = await resp.json();
            if (data.claimed_amount) {
                nodeStats.pendingReward = '0';
                nodeStats.totalEarned = data.new_balance || nodeStats.totalEarned;
                sendToRenderer('node:stats', getNodeStatus());
            }
            return { success: true, ...data };
        } catch (e) {
            return { success: false, error: e.message };
        }
    });
}

// ── Singleton: only one app window ──
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    // Another App instance is already running, focus it instead
    app.quit();
} else {
    app.on('second-instance', () => {
        // Someone tried to open a second instance → focus our window
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    // ── App Lifecycle ──
    app.whenReady().then(() => {
        loadConfig();

        // Check if CLI is already running (by lockfile)
        const lockHolder = readLock();
        if (lockHolder && isProcessAlive(lockHolder.pid) && lockHolder.client === 'cli') {
            dialog.showMessageBoxSync({
                type: 'warning',
                title: 'Vision Node',
                message: 'Vision Node CLI is already running',
                detail: `A CLI instance (PID ${lockHolder.pid}) is already running.\n\nPlease stop the CLI first (Ctrl+C) before using the desktop app.\n\nOnly one Vision Node instance is allowed per machine.`,
                buttons: ['OK'],
            });
            app.quit();
            return;
        }

        setupIPC();
        createWindow();
        createTray();

        // Auto-start if already configured
        if (isInitialized()) {
            startNode();
        }
    });

    app.on('window-all-closed', () => {
        // Don't quit on macOS when windows are closed (tray keeps running)
        if (process.platform !== 'darwin' && !nodeRunning) {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (mainWindow === null) {
            createWindow();
        } else {
            mainWindow.show();
        }
    });

    app.on('before-quit', () => {
        stopNode();
    });
}
