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
    }

    // Listen for events from main process
    window.visionNode.onStarted(onNodeStarted);
    window.visionNode.onStopped(onNodeStopped);
    window.visionNode.onHeartbeat(onHeartbeat);
    window.visionNode.onStats(onStatsUpdate);

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
    document.getElementById('stat-weight').textContent = `${(s.weight || 0).toFixed(2)}x`;

    // Node info
    document.getElementById('overview-node-id').textContent = s.nodeId || '';
    document.getElementById('info-email').textContent = s.email || '-';
    document.getElementById('info-class').textContent = capitalize(s.nodeClass || '-');
    document.getElementById('info-wallet').textContent = s.walletAddress ? truncate(s.walletAddress, 16) : '-';
    document.getElementById('info-env').textContent = capitalize(s.environment || '-');

    // Rewards
    document.getElementById('reward-pending').textContent = (s.pendingReward || 0).toFixed(6);
    document.getElementById('reward-earned').textContent = (s.totalEarned || 0).toFixed(4);
    document.getElementById('reward-weight').textContent = `${(s.weight || 0).toFixed(2)}x`;

    // Settings
    const config = s;
    document.getElementById('settings-nodeid').textContent = s.nodeId || '-';
    document.getElementById('settings-apikey').textContent = s.nodeId ? '***hidden***' : '-';
    document.getElementById('settings-storage-path').textContent = `~/.visionnode/storage`;
    document.getElementById('settings-api-url').textContent = s.environment === 'staging'
        ? 'staging.cloudfunctions.net/agentGateway'
        : 'production.cloudfunctions.net/agentGateway';
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
        const rewardStr = data.reward ? ` (+${parseFloat(data.reward).toFixed(6)} VCN)` : '';
        addActivity('success', `Heartbeat OK${rewardStr}`);
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
