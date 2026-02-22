/**
 * Vision Node Dashboard - Client-side JavaScript
 * Dynamic infographic with gauges, charts, particles, and live updates
 */
(function () {
    'use strict';

    const logs = [];
    const MAX_LOGS = 80;
    const heartbeatHistory = [];
    const MAX_HISTORY = 60;
    let updateCount = 0;

    // ─── Particle Background ───
    function initParticles() {
        const canvas = document.getElementById('particleCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let w, h;
        const particles = [];
        const PARTICLE_COUNT = 45;

        function resize() {
            w = canvas.width = window.innerWidth;
            h = canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resize);
        resize();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.3,
                vy: (Math.random() - 0.5) * 0.3,
                r: Math.random() * 1.5 + 0.5,
                alpha: Math.random() * 0.3 + 0.1,
            });
        }

        function draw() {
            ctx.clearRect(0, 0, w, h);
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = w;
                if (p.x > w) p.x = 0;
                if (p.y < 0) p.y = h;
                if (p.y > h) p.y = 0;

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(16, 185, 129, ' + p.alpha + ')';
                ctx.fill();

                // Draw connections
                for (let j = i + 1; j < particles.length; j++) {
                    const q = particles[j];
                    const dx = p.x - q.x;
                    const dy = p.y - q.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(q.x, q.y);
                        ctx.strokeStyle = 'rgba(16, 185, 129, ' + (0.06 * (1 - dist / 150)) + ')';
                        ctx.lineWidth = 0.5;
                        ctx.stroke();
                    }
                }
            }
            requestAnimationFrame(draw);
        }
        draw();
    }

    // ─── Heartbeat Chart ───
    function drawHeartbeatChart() {
        const canvas = document.getElementById('heartbeatChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = 240;
        ctx.scale(2, 2);
        const W = rect.width;
        const H = 120;
        const pad = { top: 10, bottom: 20, left: 10, right: 10 };

        ctx.clearRect(0, 0, W, H);

        // Grid lines
        ctx.strokeStyle = 'rgba(30, 45, 79, 0.5)';
        ctx.lineWidth = 0.5;
        for (let y = 0; y < 4; y++) {
            const yy = pad.top + (y / 3) * (H - pad.top - pad.bottom);
            ctx.beginPath();
            ctx.moveTo(pad.left, yy);
            ctx.lineTo(W - pad.right, yy);
            ctx.stroke();
        }

        if (heartbeatHistory.length < 2) {
            ctx.fillStyle = '#4a5d80';
            ctx.font = '11px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for heartbeat data...', W / 2, H / 2);
            return;
        }

        const maxVal = Math.max(...heartbeatHistory.map(h => h.count), 1);
        const chartW = W - pad.left - pad.right;
        const chartH = H - pad.top - pad.bottom;
        const step = chartW / (MAX_HISTORY - 1);

        // Fill gradient
        const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
        grad.addColorStop(0, 'rgba(244, 63, 94, 0.2)');
        grad.addColorStop(1, 'rgba(244, 63, 94, 0)');

        ctx.beginPath();
        ctx.moveTo(pad.left, H - pad.bottom);
        for (let i = 0; i < heartbeatHistory.length; i++) {
            const x = pad.left + i * step;
            const y = pad.top + chartH - (heartbeatHistory[i].count / maxVal) * chartH;
            if (i === 0) ctx.lineTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(pad.left + (heartbeatHistory.length - 1) * step, H - pad.bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line
        ctx.beginPath();
        for (let i = 0; i < heartbeatHistory.length; i++) {
            const x = pad.left + i * step;
            const y = pad.top + chartH - (heartbeatHistory[i].count / maxVal) * chartH;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = '#f43f5e';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dots
        for (let i = 0; i < heartbeatHistory.length; i++) {
            const x = pad.left + i * step;
            const y = pad.top + chartH - (heartbeatHistory[i].count / maxVal) * chartH;
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#f43f5e';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        }

        // Time labels
        ctx.fillStyle = '#4a5d80';
        ctx.font = '10px JetBrains Mono';
        ctx.textAlign = 'center';
        const labelInterval = Math.max(1, Math.floor(heartbeatHistory.length / 6));
        for (let i = 0; i < heartbeatHistory.length; i += labelInterval) {
            const x = pad.left + i * step;
            ctx.fillText(heartbeatHistory[i].label, x, H - 4);
        }
    }

    // ─── SSE Connection ───
    function connect() {
        addLog('Connecting to node...', 'info');
        const es = new EventSource('/api/events');

        es.onmessage = function (event) {
            try {
                const data = JSON.parse(event.data);
                updateDashboard(data);
                updateCount++;
            } catch (e) {
                addLog('Parse error: ' + e.message, 'error');
            }
        };

        es.onerror = function () {
            addLog('Connection lost. Reconnecting...', 'warn');
            setOnline(false);
            es.close();
            setTimeout(connect, 3000);
        };

        es.onopen = function () {
            addLog('Connected to Vision Node', 'success');
            setOnline(true);
        };
    }

    function updateDashboard(data) {
        const { status, storage, heartbeat, timestamp } = data;

        // Header
        setText('nodeIdHeader', status.nodeId || '--');
        setText('envBadge', status.environment || '--');
        setOnline(status.isRunning);

        // ── Storage Gauge ──
        const pct = storage.usagePercent || 0;
        const arc = document.getElementById('gaugeArc');
        const circumference = 2 * Math.PI * 85; // ~534
        arc.setAttribute('stroke-dashoffset', String(circumference - (pct / 100) * circumference));
        if (pct > 80) arc.setAttribute('stroke', 'url(#gaugeWarn)');
        else arc.setAttribute('stroke', 'url(#gaugeGrad)');

        setText('storagePercent', pct + '%');
        setText('storageUsed', formatSize(storage.totalSizeBytes || 0));
        setText('storageMax', formatSize(storage.maxSizeBytes || 0));
        setText('totalFiles', String(storage.totalFiles || 0));
        setText('totalChunks', String(storage.totalChunks || 0));
        setText('fileCount', (storage.totalFiles || 0) + ' files');

        // ── Uptime Ring ──
        const upSec = status.uptimeSeconds || 0;
        const upPct = Math.min(upSec / (24 * 3600), 1); // max 24h = full
        setRing('uptimeRing', upPct);
        setText('uptimeValue', formatUptime(upSec));

        // ── Heartbeat Ring ──
        const hbCount = heartbeat.totalHeartbeats || 0;
        const hbPct = Math.min(hbCount / 288, 1); // 288 = 24h worth of 5min heartbeats
        setRing('heartbeatRing', hbPct);
        setText('heartbeatValue', String(hbCount));
        setText('hbRate', hbCount + ' / 5min');

        // Track history
        const timeLabel = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        heartbeatHistory.push({ count: hbCount, label: timeLabel });
        if (heartbeatHistory.length > MAX_HISTORY) heartbeatHistory.shift();
        drawHeartbeatChart();

        // ── Weight Ring ──
        const weight = heartbeat.weight || 0;
        setRing('weightRing', Math.min(weight / 5, 1));
        setText('weightValue', weight.toFixed(2) + 'x');

        // ── Reward ──
        const reward = heartbeat.pendingReward || 0;
        setText('rewardValue', reward.toFixed(4));
        const rewardBar = document.getElementById('rewardBar');
        rewardBar.style.width = Math.min(reward / 100, 1) * 100 + '%';
        if (reward > 0) {
            setText('rewardSub', 'Earning rewards from network participation');
        }

        // ── Network Contribution ──
        const uptimeContrib = Math.min(upSec / (24 * 3600) * 100, 100);
        const storageContrib = pct;
        const relayContrib = Math.min(hbCount / 288 * 100, 100);
        document.getElementById('contribUptime').style.width = uptimeContrib + '%';
        document.getElementById('contribStorage').style.width = storageContrib + '%';
        document.getElementById('contribRelay').style.width = relayContrib + '%';
        setText('contribUptimePct', Math.round(uptimeContrib) + '%');
        setText('contribStoragePct', Math.round(storageContrib) + '%');
        setText('contribRelayPct', Math.round(relayContrib) + '%');

        // ── Node Info ──
        setText('nodeId', status.nodeId || '--');
        setText('email', status.email || '--');
        const classEl = document.getElementById('nodeClass');
        if (classEl) classEl.textContent = (status.nodeClass || '--').toUpperCase();
        setText('platform', status.system ? (status.system.platform + '/' + status.system.arch) : '--');
        setText('hostname', status.system ? status.system.hostname : '--');
        if (status.storage) setText('storagePath', status.storage.path || '--');

        // ── System ──
        if (status.system) {
            setText('cpuCores', String(status.system.cpus));
            setText('archInfo', status.system.platform + ' ' + status.system.arch);
            const usedMem = status.system.totalMemoryMB - status.system.freeMemoryMB;
            const memPct = (usedMem / status.system.totalMemoryMB) * 100;
            document.getElementById('memoryBar').style.width = memPct + '%';
            setText('memFree', formatSize(status.system.freeMemoryMB * 1024 * 1024));
            setText('memTotal', formatSize(status.system.totalMemoryMB * 1024 * 1024));
        }

        // Last update
        setText('lastUpdate', 'Updated ' + new Date(timestamp).toLocaleTimeString());

        // Files table
        if (updateCount % 3 === 0) updateFilesTable();

        // Heartbeat log
        if (heartbeat.lastHeartbeat > 0) {
            const msg = 'HB #' + hbCount + ' | weight=' + weight.toFixed(2) + 'x | reward=' + reward.toFixed(4) + ' VCN';
            if (logs.length === 0 || !logs[logs.length - 1].msg.includes('#' + hbCount)) {
                addLog(msg, heartbeat.consecutiveFailures > 0 ? 'warn' : 'success');
            }
        }

        // ── P2P Network ──
        if (status.p2p) {
            const p2p = status.p2p;
            setText('peerCount', p2p.connectedPeers + ' peers');
            setText('p2pPort', String(p2p.listeningPort || '--'));
            setText('p2pMsgSent', String(p2p.totalMessagesSent || 0));
            setText('p2pMsgRecv', String(p2p.totalMessagesReceived || 0));
            setText('p2pChunksShared', String(p2p.totalChunksShared || 0));

            const peersEl = document.getElementById('peersList');
            if (peersEl) {
                if (!p2p.peers || p2p.peers.length === 0) {
                    peersEl.innerHTML = '<div class="table-empty" style="padding:16px"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg><p>Discovering peers...</p></div>';
                } else {
                    let html = '';
                    for (const peer of p2p.peers) {
                        html += '<div class="peer-item">'
                            + '<div class="peer-dot"></div>'
                            + '<span class="peer-id">' + esc(peer.nodeId || '--') + '</span>'
                            + '<span class="peer-latency">' + (peer.latencyMs || 0) + 'ms</span>'
                            + '<span class="peer-rep">R:' + (peer.reputation || 0) + '</span>'
                            + '</div>';
                    }
                    peersEl.innerHTML = html;
                }
            }
        }
    }

    function updateFilesTable() {
        fetch('/api/storage')
            .then(r => r.json())
            .then(data => {
                const container = document.getElementById('filesTable');
                if (!data.files || data.files.length === 0) {
                    container.innerHTML = '<div class="table-empty"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg><p>No files stored yet</p></div>';
                    return;
                }
                let html = '<table><thead><tr><th>File Key</th><th>CID</th><th>Size</th><th>Chunks</th><th>Created</th></tr></thead><tbody>';
                for (const f of data.files) {
                    const cid = f.merkleRoot ? ('vcn://' + f.merkleRoot.slice(0, 16) + '...') : '--';
                    html += '<tr><td class="mono">' + esc(f.fileKey) + '</td><td class="mono">' + esc(cid) + '</td><td>' + formatSize(f.totalSize) + '</td><td>' + f.chunkCount + '</td><td>' + new Date(f.createdAt).toLocaleString() + '</td></tr>';
                }
                html += '</tbody></table>';
                container.innerHTML = html;
            }).catch(() => { });
    }

    // ─── Helpers ───
    function setRing(id, pct) {
        const el = document.getElementById(id);
        if (!el) return;
        const circumference = 2 * Math.PI * 40; // ~251
        el.setAttribute('stroke-dashoffset', String(circumference - pct * circumference));
    }

    function setOnline(on) {
        const ind = document.getElementById('liveIndicator');
        const text = document.getElementById('statusText');
        if (on) {
            ind.className = 'live-indicator';
            text.textContent = 'Online';
        } else {
            ind.className = 'live-indicator offline';
            text.textContent = 'Offline';
        }
    }

    function addLog(msg, type) {
        const now = new Date().toLocaleTimeString();
        logs.push({ time: now, msg, type: type || 'info' });
        if (logs.length > MAX_LOGS) logs.shift();
        const container = document.getElementById('logContainer');
        let html = '';
        for (let i = logs.length - 1; i >= Math.max(0, logs.length - 40); i--) {
            html += '<div class="log-entry ' + logs[i].type + '"><span class="log-time">' + logs[i].time + '</span>' + esc(logs[i].msg) + '</div>';
        }
        container.innerHTML = html;
    }

    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function formatUptime(s) {
        if (!s || s <= 0) return '--';
        const d = Math.floor(s / 86400);
        const h = Math.floor((s % 86400) / 3600);
        const m = Math.floor((s % 3600) / 60);
        if (d > 0) return d + 'd ' + h + 'h';
        if (h > 0) return h + 'h ' + m + 'm';
        return m + 'm ' + (s % 60) + 's';
    }

    function formatSize(b) {
        if (!b || b <= 0) return '0B';
        if (b < 1024) return b + 'B';
        if (b < 1048576) return (b / 1024).toFixed(1) + 'KB';
        if (b < 1073741824) return (b / 1048576).toFixed(1) + 'MB';
        return (b / 1073741824).toFixed(2) + 'GB';
    }

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    // Boot
    initParticles();
    connect();
    window.addEventListener('resize', drawHeartbeatChart);
})();
