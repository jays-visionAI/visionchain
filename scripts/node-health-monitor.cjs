#!/usr/bin/env node
/**
 * Vision Chain Node Health Monitor & Auto-Reconnect
 * 
 * This script monitors all 5 Vision Chain nodes and:
 * 1. Checks peer connectivity
 * 2. Checks block sync status (detects forks)
 * 3. Auto-reconnects nodes via admin_addPeer if peers drop
 * 4. Alerts if nodes are on different forks
 * 
 * Usage:
 *   node scripts/node-health-monitor.cjs              # Run once
 *   node scripts/node-health-monitor.cjs --watch       # Run continuously (every 30s)
 *   node scripts/node-health-monitor.cjs --fix         # Run once + auto-fix
 *   node scripts/node-health-monitor.cjs --watch --fix # Run continuously + auto-fix
 * 
 * Recommended: Set up as a cron job on the server:
 *   * * * * * node /path/to/node-health-monitor.cjs --fix >> /var/log/vision-health.log 2>&1
 */

const NODES = [
    { name: 'node-1', url: 'http://46.224.221.201:8545', enode: 'enode://b51e15b9ce0121d142bf7adeeaaa66b5bfcb07fe11b1927156623afcf97c4e5a1f4fbafeba8320f9490caa2607b50df97fce31dbdbfc21960e3465ad81ebba22@172.20.0.11:30303' },
    { name: 'node-2', url: 'http://46.224.221.201:8546', enode: 'enode://f394a0fd8fff8e8449dc0a2731fa78fe2939d27131c695eb4006c022b11c1ab9adb309798cc168e020ecf2822e5bb103f2a215ca4c6c20d43cd3072522bd94ac@172.20.0.12:30303' },
    { name: 'node-3', url: 'http://46.224.221.201:8547', enode: 'enode://7286cdb2cdec31865c78f65552532aa6e28c937670b027b5144c2b4cf77c480039bb74914f0e2d1999ef9d251d3b3447e7cd1e9782a8615633ae5f07290ec59a@172.20.0.13:30303' },
    { name: 'node-4', url: 'http://46.224.221.201:8548', enode: 'enode://6d91ebc2038227b422afe67f1e5f92a61dc1b3a0310be4decfaae59cd7fcfedf7bea46d9b1f484d04712668751253171f87bc3a5fb7b607bac84bba0a29d890c@172.20.0.14:30303' },
    { name: 'node-5', url: 'http://46.224.221.201:8549', enode: 'enode://2198afd2651575351095d6b248d4910a7990b57736d9a4a10c72b92cd8a4dabb6bea72382fe1bb095ddafb15d2e75677e35eeabab8973f4f5180ef8dfdcf4330@172.20.0.15:30303' },
];

// Max allowed block difference before we flag a fork
const MAX_BLOCK_DIFF = 10;
// Minimum required peers per node
const MIN_PEERS = 2;

async function rpc(url, method, params = []) {
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    return data.result;
}

async function getNodeStatus(node) {
    try {
        const [blockHex, peerCountHex, mining] = await Promise.all([
            rpc(node.url, 'eth_blockNumber'),
            rpc(node.url, 'net_peerCount'),
            rpc(node.url, 'eth_mining'),
        ]);
        return {
            ...node,
            block: parseInt(blockHex, 16),
            peers: parseInt(peerCountHex, 16),
            mining,
            online: true,
        };
    } catch (e) {
        return { ...node, block: 0, peers: 0, mining: false, online: false, error: e.message };
    }
}

async function addPeerToNode(nodeUrl, peerEnode) {
    try {
        const result = await rpc(nodeUrl, 'admin_addPeer', [peerEnode]);
        return result;
    } catch (e) {
        return false;
    }
}

async function reconnectAllNodes() {
    console.log('[FIX] Reconnecting all nodes...');
    let addCount = 0;
    for (const node of NODES) {
        for (const peer of NODES) {
            if (node.name === peer.name) continue;
            const added = await addPeerToNode(node.url, peer.enode);
            if (added) addCount++;
        }
    }
    console.log(`[FIX] Sent ${addCount} addPeer requests`);
}

async function checkHealth(autoFix = false) {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Vision Chain Health Check`);
    console.log('─'.repeat(60));

    const statuses = await Promise.all(NODES.map(getNodeStatus));

    // Display status table
    for (const s of statuses) {
        const status = s.online ? 'ONLINE' : 'OFFLINE';
        const mineStr = s.mining ? 'MINING' : '      ';
        const peerWarn = s.peers < MIN_PEERS ? ' [LOW PEERS]' : '';
        console.log(`  ${s.name}: ${status}  block=${String(s.block).padStart(8)}  peers=${s.peers}  ${mineStr}${peerWarn}`);
    }

    const onlineNodes = statuses.filter(s => s.online);
    if (onlineNodes.length === 0) {
        console.log('[CRITICAL] All nodes are offline!');
        return { healthy: false, issue: 'all_offline' };
    }

    // Check for fork: compare block numbers among online nodes
    const maxBlock = Math.max(...onlineNodes.map(s => s.block));
    const minBlock = Math.min(...onlineNodes.map(s => s.block));
    const blockDiff = maxBlock - minBlock;

    if (blockDiff > MAX_BLOCK_DIFF) {
        console.log(`[WARNING] Possible fork detected! Block diff: ${blockDiff} (max=${maxBlock}, min=${minBlock})`);
        const behindNodes = onlineNodes.filter(s => s.block < maxBlock - MAX_BLOCK_DIFF);
        for (const n of behindNodes) {
            console.log(`  ${n.name} is ${maxBlock - n.block} blocks behind`);
        }
        if (autoFix) {
            await reconnectAllNodes();
        }
        return { healthy: false, issue: 'fork', blockDiff };
    }

    // Check for low peers
    const lowPeerNodes = onlineNodes.filter(s => s.peers < MIN_PEERS);
    if (lowPeerNodes.length > 0) {
        console.log(`[WARNING] ${lowPeerNodes.length} node(s) have low peer count:`);
        for (const n of lowPeerNodes) {
            console.log(`  ${n.name}: ${n.peers} peers (min: ${MIN_PEERS})`);
        }
        if (autoFix) {
            await reconnectAllNodes();
        }
        return { healthy: false, issue: 'low_peers' };
    }

    console.log(`[OK] All nodes healthy. Block diff: ${blockDiff}, Min peers: ${Math.min(...onlineNodes.map(s => s.peers))}`);
    return { healthy: true };
}

// Main
(async () => {
    const args = process.argv.slice(2);
    const watchMode = args.includes('--watch');
    const autoFix = args.includes('--fix');

    if (watchMode) {
        console.log('Starting continuous monitoring (every 30s)...');
        while (true) {
            await checkHealth(autoFix);
            await new Promise(r => setTimeout(r, 30000));
        }
    } else {
        const result = await checkHealth(autoFix);
        process.exit(result.healthy ? 0 : 1);
    }
})();
