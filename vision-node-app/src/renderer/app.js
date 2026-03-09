// ── Vision Node Desktop App – Renderer ──

let currentStatus = null;
const activityLog = [];

// ── Init ──
async function init() {
    const initialized = await window.visionNode.isInitialized();

    if (!initialized) {
        showView('setup-view');
        setupClassSelector();
        setupStorageSlider();
    } else {
        showView('dashboard-view');
        await refreshStatus();
        initStorageSettings();
        initNodeSettings();
        checkForUpdates();
    }

    // Listen for events from main process
    window.visionNode.onStarted(onNodeStarted);
    window.visionNode.onStopped(onNodeStopped);
    window.visionNode.onHeartbeat(onHeartbeat);
    window.visionNode.onStats(onStatsUpdate);
    window.visionNode.onError((data) => {
        addActivity('error', data.message || 'Unknown error');
    });

    // Periodic refresh
    setInterval(refreshStatus, 10000);
}

// ── Views ──
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    document.getElementById(id).style.display = id === 'setup-view' ? 'flex' : 'flex';
}

// ── Setup ──
let selectedClass = 'standard';

function setupClassSelector() {
    document.querySelectorAll('.class-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.class-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedClass = btn.dataset.class;

            // Update slider range based on class
            const slider = document.getElementById('setup-storage');
            const maxMap = { lite: 1, standard: 100, full: 1000 };
            const minMap = { lite: 0.1, standard: 1, full: 100 };
            const defMap = { lite: 0.5, standard: 10, full: 200 };
            slider.min = minMap[selectedClass] || 1;
            slider.max = maxMap[selectedClass] || 100;
            slider.value = defMap[selectedClass] || 10;
            document.getElementById('storage-value-text').textContent = slider.value;
        });
    });
}

function setupStorageSlider() {
    const slider = document.getElementById('setup-storage');
    slider.addEventListener('input', () => {
        document.getElementById('storage-value-text').textContent = slider.value;
    });
}

async function handleSetup() {
    const email = document.getElementById('setup-email').value.trim();
    const storageGB = parseInt(document.getElementById('setup-storage').value);
    const referralCode = document.getElementById('setup-referral').value.trim();
    const errorEl = document.getElementById('setup-error');

    if (!email || !email.includes('@')) {
        errorEl.textContent = 'Please enter a valid email address.';
        errorEl.style.display = 'block';
        return;
    }

    errorEl.style.display = 'none';
    const btn = document.getElementById('setup-btn');
    btn.disabled = true;
    document.getElementById('setup-btn-text').textContent = 'Registering...';
    document.getElementById('setup-spinner').style.display = 'block';

    try {
        const result = await window.visionNode.register({
            email,
            nodeClass: selectedClass,
            storageGB,
            environment: 'production',
            referralCode: referralCode || undefined,
        });

        if (result.success) {
            showView('dashboard-view');
            await refreshStatus();
            // Auto-start
            await window.visionNode.start();
        } else {
            errorEl.textContent = result.error || 'Registration failed.';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = err.message || 'Registration failed.';
        errorEl.style.display = 'block';
    } finally {
        btn.disabled = false;
        document.getElementById('setup-btn-text').textContent = 'Get Started';
        document.getElementById('setup-spinner').style.display = 'none';
    }
}

// ── Dashboard ──
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    document.getElementById(`tab-${tab}`).classList.add('active');
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
}

async function refreshStatus() {
    try {
        currentStatus = await window.visionNode.getStatus();
        updateUI(currentStatus);
    } catch { }
}

async function toggleNode() {
    if (!currentStatus) return;

    if (currentStatus.running) {
        await window.visionNode.stop();
    } else {
        await window.visionNode.start();
    }
    await refreshStatus();
}

// ── UI Updates ──
function updateUI(s) {
    if (!s) return;

    // Status dot & text
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (s.running) {
        dot.classList.add('online');
        text.textContent = 'Running';
        text.style.color = '#22c55e';
    } else {
        dot.classList.remove('online');
        text.textContent = 'Offline';
        text.style.color = '';
    }

    // Toggle button
    const toggleBtn = document.getElementById('toggle-btn');
    const toggleText = document.getElementById('toggle-text');
    const playIcon = document.getElementById('toggle-icon-play');
    const stopIcon = document.getElementById('toggle-icon-stop');
    if (s.running) {
        toggleBtn.classList.add('running');
        toggleText.textContent = 'Stop Node';
        playIcon.style.display = 'none';
        stopIcon.style.display = 'block';
    } else {
        toggleBtn.classList.remove('running');
        toggleText.textContent = 'Start Node';
        playIcon.style.display = 'block';
        stopIcon.style.display = 'none';
    }

    // Overview stats
    document.getElementById('stat-uptime').textContent = formatUptime(s.uptimeSeconds || 0);
    document.getElementById('stat-heartbeats').textContent = (s.heartbeatCount || 0).toLocaleString();
    document.getElementById('stat-storage').textContent = `${s.storageMaxGB || 0} GB`;
    document.getElementById('stat-weight').textContent = `${parseFloat(s.weight || 0).toFixed(2)}x`;
    // Show weight breakdown tooltip
    const weightCard = document.getElementById('stat-weight')?.closest('.stat-card');
    if (weightCard && s.storageBonus > 0) {
        weightCard.title = `Base: ${(s.baseWeight || 0).toFixed(3)}x + Storage: +${(s.storageBonus || 0).toFixed(3)}x (${s.chunksHeld || 0} chunks)`;
    }

    // Overview storage usage
    const usedBytes = s.storageBytes || 0;
    const maxBytes = (s.storageMaxGB || 1) * 1024 * 1024 * 1024;
    const usagePct = maxBytes > 0 ? Math.min(100, (usedBytes / maxBytes) * 100) : 0;
    const usedEl = document.getElementById('stat-storage-used');
    const barEl = document.getElementById('stat-storage-bar');
    const chunksEl = document.getElementById('stat-storage-chunks');
    const pctEl = document.getElementById('stat-storage-pct');
    if (usedEl) usedEl.textContent = formatBytes(usedBytes);
    if (barEl) {
        barEl.style.width = `${Math.max(0, usagePct)}%`;
        if (usagePct > 80) barEl.style.background = 'linear-gradient(90deg, #f59e0b, #ef4444)';
        else barEl.style.background = 'linear-gradient(90deg, #22c55e, #06b6d4)';
    }
    if (chunksEl) chunksEl.textContent = `${(s.storageChunks || 0).toLocaleString()} chunks`;
    if (pctEl) pctEl.textContent = `${usagePct.toFixed(1)}%`;

    // Node info
    document.getElementById('overview-node-id').textContent = s.nodeId || '';
    document.getElementById('info-email').textContent = s.email || '-';
    document.getElementById('info-class').textContent = capitalize(s.nodeClass || '-');
    document.getElementById('info-wallet').textContent = s.walletAddress ? truncate(s.walletAddress, 16) : '-';
    document.getElementById('info-env').textContent = capitalize(s.environment || '-');

    // Rewards - 3 Tier
    document.getElementById('reward-pending-vcn').textContent = parseFloat(s.pendingReward || 0).toFixed(6);
    document.getElementById('reward-pending-usdt').textContent = '$' + parseFloat(s.pendingUsdt || 0).toFixed(6);
    document.getElementById('reward-pending-rp').textContent = Math.floor(s.pendingRp || 0).toLocaleString();
    document.getElementById('reward-earned-vcn').textContent = parseFloat(s.totalEarned || 0).toFixed(4);
    document.getElementById('reward-earned-usdt').textContent = '$' + parseFloat(s.totalUsdtEarned || 0).toFixed(6);
    document.getElementById('reward-earned-rp').textContent = Math.floor(s.totalRpEarned || 0).toLocaleString();
    document.getElementById('reward-weight').textContent = `${parseFloat(s.weight || 0).toFixed(2)}x`;
    // Show weight breakdown in rewards tab
    const weightBreakdownEl = document.getElementById('reward-weight-breakdown');
    if (weightBreakdownEl) {
        if (s.storageBonus > 0) {
            weightBreakdownEl.textContent = `Base ${(s.baseWeight || 0).toFixed(3)}x + ${(s.storageBonus || 0).toFixed(3)}x storage (${s.chunksHeld || 0} chunks, ${(s.storedGB || 0).toFixed(4)} GB)`;
            weightBreakdownEl.style.display = 'block';
        } else {
            weightBreakdownEl.textContent = `Desktop full mode — store chunks to earn more`;
            weightBreakdownEl.style.display = 'block';
        }
    }

    // Settings - Node Configuration
    document.getElementById('settings-nodeid').textContent = s.nodeId || '-';
    document.getElementById('settings-apikey').textContent = s.nodeId ? '***hidden***' : '-';
    document.getElementById('settings-storage-path').textContent = `~/.visionnode/storage`;
    document.getElementById('settings-api-url').textContent = s.environment === 'staging'
        ? 'staging.cloudfunctions.net/agentGateway'
        : 'production.cloudfunctions.net/agentGateway';

    // Settings - Storage usage
    const settingsUsed = document.getElementById('settings-storage-used');
    const settingsPct = document.getElementById('settings-storage-pct');
    if (settingsUsed) settingsUsed.textContent = formatBytes(usedBytes);
    if (settingsPct) settingsPct.textContent = `${usagePct.toFixed(1)}%`;
}

// ── Event Handlers ──
function onNodeStarted(data) {
    addActivity('success', 'Node started');
    updateUI(data);
}

function onNodeStopped(data) {
    addActivity('info', 'Node stopped');
    updateUI(data);
}

function onHeartbeat(data) {
    if (data.success) {
        const vcnStr = data.vcn_reward ? `VCN +${parseFloat(data.vcn_reward).toFixed(6)}` : '';
        const usdtStr = data.usdt_reward && parseFloat(data.usdt_reward) > 0 ? ` | USDT +$${parseFloat(data.usdt_reward).toFixed(8)}` : '';
        const rpStr = data.rp_reward ? ` | RP +${data.rp_reward}` : '';
        addActivity('success', `Heartbeat OK (${vcnStr}${usdtStr}${rpStr})`);
    } else {
        addActivity('error', `Heartbeat failed: ${data.error || 'Unknown error'}`);
    }
}

function onStatsUpdate(data) {
    currentStatus = data;
    updateUI(data);
}

// ── Activity Log ──
function addActivity(type, message) {
    activityLog.unshift({ type, message, time: new Date() });
    if (activityLog.length > 50) activityLog.pop();
    renderActivityLog();
}

function renderActivityLog() {
    const container = document.getElementById('activity-log');
    if (activityLog.length === 0) {
        container.innerHTML = '<div class="activity-empty">No activity yet. Start your node to begin.</div>';
        return;
    }

    container.innerHTML = activityLog.slice(0, 20).map(a => `
        <div class="activity-item">
            <div class="activity-dot ${a.type}"></div>
            <div class="activity-text">${escapeHtml(a.message)}</div>
            <div class="activity-time">${formatTime(a.time)}</div>
        </div>
    `).join('');
}

// ── Helpers ──
function formatUptime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
    return `${(seconds / 86400).toFixed(1)}d`;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val < 10 ? val.toFixed(2) : val < 100 ? val.toFixed(1) : Math.round(val)} ${units[i]}`;
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function truncate(s, len) {
    if (s.length <= len) return s;
    return s.slice(0, len / 2) + '...' + s.slice(-len / 2);
}

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Start ──
document.addEventListener('DOMContentLoaded', init);

// ── Node Settings ──
let settingsClass = 'standard';
let settingsEnv = 'production';

async function initNodeSettings() {
    try {
        const status = await window.visionNode.getStatus();
        if (!status) return;

        // Populate email
        const emailInput = document.getElementById('settings-email');
        if (emailInput) emailInput.value = status.email || '';

        // Set class
        settingsClass = status.nodeClass || 'standard';
        highlightClassBtn(settingsClass);

        // Set environment
        settingsEnv = status.environment || 'production';
        highlightEnvBtn(settingsEnv);
    } catch (err) {
        console.warn('[NodeSettings] Init failed:', err);
    }
}

function selectSettingsClass(cls) {
    settingsClass = cls;
    highlightClassBtn(cls);
}

function selectSettingsEnv(env) {
    settingsEnv = env;
    highlightEnvBtn(env);
}

function highlightClassBtn(cls) {
    document.querySelectorAll('.settings-class-btn').forEach(btn => {
        const isActive = btn.dataset.class === cls;
        btn.style.borderColor = isActive ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)';
        btn.style.background = isActive ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.04)';
        btn.style.color = isActive ? '#a5b4fc' : '#94a3b8';
    });
}

function highlightEnvBtn(env) {
    document.querySelectorAll('.settings-env-btn').forEach(btn => {
        const isActive = btn.dataset.env === env;
        btn.style.borderColor = isActive ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.08)';
        btn.style.background = isActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)';
        btn.style.color = isActive ? '#86efac' : '#94a3b8';
    });
}

async function saveNodeSettings() {
    const btn = document.getElementById('settings-save-btn');
    const statusEl = document.getElementById('settings-save-status');
    if (!btn) return;

    const email = (document.getElementById('settings-email')?.value || '').trim();
    if (!email || !email.includes('@')) {
        statusEl.textContent = 'Invalid email address';
        statusEl.style.color = '#ef4444';
        return;
    }

    btn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.style.color = '#a0aec0';

    try {
        const result = await window.visionNode.updateConfig({
            email,
            nodeClass: settingsClass,
            environment: settingsEnv,
        });

        if (result && result.success) {
            statusEl.textContent = 'Settings saved successfully';
            statusEl.style.color = '#22c55e';
            // Refresh the overview UI too
            await refreshStatus();
            // Reinitialize storage slider for new class range
            initStorageSettings();
        } else {
            statusEl.textContent = 'Error: ' + (result?.error || 'Unknown');
            statusEl.style.color = '#ef4444';
        }
    } catch (err) {
        statusEl.textContent = 'Failed to save';
        statusEl.style.color = '#ef4444';
    } finally {
        btn.disabled = false;
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

// ── Storage Settings ──
async function initStorageSettings() {
    try {
        const status = await window.visionNode.getStatus();
        if (!status) return;

        const slider = document.getElementById('settings-storage-slider');
        if (!slider) return;

        const nodeClass = status.nodeClass || 'standard';
        const classRanges = {
            lite: { min: 0.1, max: 1, step: 0.1 },
            standard: { min: 1, max: 100, step: 1 },
            full: { min: 100, max: 1000, step: 10 },
        };
        const range = classRanges[nodeClass] || classRanges.standard;

        slider.min = range.min;
        slider.max = range.max;
        slider.step = range.step;
        slider.value = status.storageMaxGB || range.min;

        const formatGB = (gb) => gb < 1 ? (gb * 1024).toFixed(0) + ' MB' : gb >= 1000 ? (gb / 1024).toFixed(1) + ' TB' : gb + ' GB';

        document.getElementById('settings-storage-min').textContent = formatGB(range.min);
        document.getElementById('settings-storage-max').textContent = formatGB(range.max);
        document.getElementById('settings-storage-value').textContent = formatGB(status.storageMaxGB || range.min);
        document.getElementById('settings-storage-alloc').textContent = formatGB(status.storageMaxGB || range.min);

        slider.addEventListener('input', function () {
            document.getElementById('settings-storage-value').textContent = formatGB(parseFloat(this.value));
        });
    } catch (err) {
        console.warn('[Storage Settings] Init failed:', err);
    }
}

async function applyStorageSettings() {
    const slider = document.getElementById('settings-storage-slider');
    const statusEl = document.getElementById('settings-storage-status');
    const btn = document.getElementById('settings-storage-apply-btn');
    if (!slider || !btn) return;

    const newGB = parseFloat(slider.value);
    btn.disabled = true;
    statusEl.textContent = 'Saving...';
    statusEl.style.color = '#a0aec0';

    try {
        const result = await window.visionNode.updateStorage(newGB);
        if (result && result.success) {
            const formatGB = (gb) => gb < 1 ? (gb * 1024).toFixed(0) + ' MB' : gb + ' GB';
            statusEl.textContent = 'Applied: ' + formatGB(result.storageMaxGB);
            statusEl.style.color = '#22c55e';
            document.getElementById('settings-storage-alloc').textContent = formatGB(result.storageMaxGB);
        } else {
            statusEl.textContent = 'Error: ' + (result?.error || 'Unknown');
            statusEl.style.color = '#ef4444';
        }
    } catch (err) {
        statusEl.textContent = 'Failed';
        statusEl.style.color = '#ef4444';
    } finally {
        btn.disabled = false;
        setTimeout(() => { statusEl.textContent = ''; }, 5000);
    }
}

// ── Update Checker ──
const CURRENT_VERSION = '1.1.1';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/jays-visionAI/visionchain/releases/latest';

async function checkForUpdates() {
    try {
        const resp = await fetch(GITHUB_RELEASES_API, {
            headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!resp.ok) return;

        const release = await resp.json();
        const latestTag = (release.tag_name || '').replace(/^(node-)?v/, '');
        if (!latestTag || !isNewerVersion(latestTag, CURRENT_VERSION)) return;

        // Find the right download asset for this platform
        const platform = navigator.platform.toLowerCase();
        const assets = release.assets || [];
        let downloadUrl = '';
        let assetName = '';

        if (platform.includes('mac') || platform.includes('darwin')) {
            // Prefer arm64 for Apple Silicon, fallback to x64
            const arm = assets.find(a => /arm64.*\.dmg$/i.test(a.name));
            const x64 = assets.find(a => /x64.*\.dmg$/i.test(a.name));
            const any = assets.find(a => /\.dmg$/i.test(a.name));
            const picked = arm || x64 || any;
            if (picked) { downloadUrl = picked.browser_download_url; assetName = picked.name; }
        } else if (platform.includes('win')) {
            const exe = assets.find(a => /\.exe$/i.test(a.name));
            if (exe) { downloadUrl = exe.browser_download_url; assetName = exe.name; }
        }

        if (!downloadUrl && release.html_url) {
            downloadUrl = release.html_url; // Fallback to release page
        }

        showUpdateBanner(latestTag, release.body || '', downloadUrl, assetName);
    } catch (err) {
        console.warn('[UpdateChecker] Failed:', err.message);
    }
}

function isNewerVersion(latest, current) {
    const a = latest.split('.').map(Number);
    const b = current.split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0;
        const y = b[i] || 0;
        if (x > y) return true;
        if (x < y) return false;
    }
    return false;
}

function showUpdateBanner(version, releaseNotes, downloadUrl, assetName) {
    // Remove existing banner if any
    const old = document.getElementById('update-banner');
    if (old) old.remove();

    const banner = document.createElement('div');
    banner.id = 'update-banner';
    banner.style.cssText = `
        position: fixed; top: 38px; left: 0; right: 0; z-index: 9999;
        background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(6,182,212,0.1));
        border-bottom: 1px solid rgba(99,102,241,0.3);
        padding: 10px 20px;
        display: flex; align-items: center; gap: 12px;
        backdrop-filter: blur(12px);
        animation: slideDown 0.4s ease;
    `;

    // Sparkle SVG icon
    const iconSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    const summaryLines = (releaseNotes || '').split('\n').filter(l => l.trim()).slice(0, 3);
    const summaryText = summaryLines.length > 0
        ? summaryLines.map(l => l.replace(/^[-*]\s*/, '').trim()).join(' / ')
        : '';

    banner.innerHTML = `
        <div style="flex-shrink:0">${iconSvg}</div>
        <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-size:12px; font-weight:700; color:#e0e7ff;">New Version Available</span>
                <span style="font-size:10px; font-weight:800; color:#a5b4fc; background:rgba(99,102,241,0.2); padding:2px 8px; border-radius:6px; letter-spacing:0.05em;">v${escapeHtml(version)}</span>
            </div>
            ${summaryText ? `<div style="font-size:10px; color:#94a3b8; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(summaryText)}</div>` : ''}
        </div>
        <button onclick="downloadUpdate('${escapeHtml(downloadUrl)}')" style="
            flex-shrink:0; display:flex; align-items:center; gap:6px;
            padding:7px 16px; border-radius:8px; border:none;
            background:linear-gradient(135deg,#6366f1,#06b6d4); color:#fff;
            font-size:11px; font-weight:700; cursor:pointer;
            font-family:inherit; transition:opacity 0.2s;
        " onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
        </button>
        <button onclick="dismissUpdateBanner()" style="
            flex-shrink:0; width:24px; height:24px; border-radius:6px; border:none;
            background:rgba(255,255,255,0.06); color:#6b7280; cursor:pointer;
            display:flex; align-items:center; justify-content:center;
            font-size:14px; font-family:inherit; transition:background 0.2s;
        " onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.06)'">&times;</button>
    `;

    // Inject animation keyframe if not already
    if (!document.getElementById('update-banner-style')) {
        const style = document.createElement('style');
        style.id = 'update-banner-style';
        style.textContent = '@keyframes slideDown { from { transform: translateY(-100%); opacity:0; } to { transform: translateY(0); opacity:1; } }';
        document.head.appendChild(style);
    }

    document.body.appendChild(banner);
}

function downloadUpdate(url) {
    if (url) window.visionNode.openExternal(url);
}

function dismissUpdateBanner() {
    const banner = document.getElementById('update-banner');
    if (banner) {
        banner.style.transition = 'opacity 0.3s, transform 0.3s';
        banner.style.opacity = '0';
        banner.style.transform = 'translateY(-100%)';
        setTimeout(() => banner.remove(), 300);
    }
}

