const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('visionNode', {
    // Node lifecycle
    getStatus: () => ipcRenderer.invoke('node:getStatus'),
    isInitialized: () => ipcRenderer.invoke('node:isInitialized'),
    getConfig: () => ipcRenderer.invoke('node:getConfig'),
    register: (opts) => ipcRenderer.invoke('node:register', opts),
    start: () => ipcRenderer.invoke('node:start'),
    stop: () => ipcRenderer.invoke('node:stop'),
    openExternal: (url) => ipcRenderer.invoke('node:openExternal', url),

    // Settings
    updateConfig: (updates) => ipcRenderer.invoke('node:updateConfig', updates),
    updateStorage: (newGB) => ipcRenderer.invoke('node:updateStorage', newGB),

    // Leaderboard & Rewards
    getLeaderboard: () => ipcRenderer.invoke('node:getLeaderboard'),
    claimVCN: () => ipcRenderer.invoke('node:claimVCN'),

    // Events from main process
    onStarted: (cb) => ipcRenderer.on('node:started', (_, data) => cb(data)),
    onStopped: (cb) => ipcRenderer.on('node:stopped', (_, data) => cb(data)),
    onHeartbeat: (cb) => ipcRenderer.on('node:heartbeat', (_, data) => cb(data)),
    onStats: (cb) => ipcRenderer.on('node:stats', (_, data) => cb(data)),
    onError: (cb) => ipcRenderer.on('node:error', (_, data) => cb(data)),
});
