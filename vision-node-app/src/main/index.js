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
let nodeStats = {
    heartbeatCount: 0,
    lastHeartbeat: null,
    pendingReward: 0,
    totalEarned: 0,
    weight: 0,
    uptimeSeconds: 0,
    startedAt: null,
    errors: [],
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
        version: '1.0.0',
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
        version: '1.0.0',
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
            version: '1.0.0',
        });

        nodeStats.heartbeatCount++;
        nodeStats.lastHeartbeat = new Date();

        if (result.accepted) {
            nodeStats.weight = result.weight || 0;
            nodeStats.pendingReward = result.pending_reward || nodeStats.pendingReward;
            nodeStats.totalEarned = result.total_earned || nodeStats.totalEarned;
        }

        // Update uptime
        if (nodeStats.startedAt) {
            nodeStats.uptimeSeconds = Math.floor((Date.now() - nodeStats.startedAt) / 1000);
        }

        sendToRenderer('node:heartbeat', {
            success: true,
            accepted: result.accepted,
            weight: result.weight,
            reward: result.heartbeat_reward,
            pending: result.pending_reward,
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
        uptimeSeconds: uptime,
        errors: nodeStats.errors.slice(-5),
    };
}

// ── Node Start/Stop ──
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

    // Send first heartbeat immediately
    sendHeartbeat();

    // Then every 5 minutes
    heartbeatTimer = setInterval(sendHeartbeat, config?.heartbeatIntervalMs || 300000);

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
        { label: `Vision Node v1.0.0`, enabled: false },
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
