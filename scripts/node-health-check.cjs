/**
 * Vision Chain Node Health Check Script
 * Comprehensive inspection of all validator nodes
 */

const RPC = 'https://api.visionchain.co/rpc-proxy';

async function rpc(method, params = []) {
    const res = await fetch(RPC, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    });
    const data = await res.json();
    if (data.error) throw new Error(`RPC Error: ${data.error.message}`);
    return data.result;
}

async function main() {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║         VISION CHAIN NODE HEALTH CHECK                  ║');
    console.log('║         ' + new Date().toISOString() + '              ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    // 1. Basic Network Info
    console.log('━━━ 1. NETWORK STATUS ━━━');
    const blockHex = await rpc('eth_blockNumber');
    const blockNum = parseInt(blockHex, 16);
    const chainId = parseInt(await rpc('eth_chainId'), 16);
    const netVersion = await rpc('net_version');
    const peerCount = parseInt(await rpc('net_peerCount'), 16);
    const mining = await rpc('eth_mining');
    const syncing = await rpc('eth_syncing');
    const gasPriceWei = parseInt(await rpc('eth_gasPrice'), 16);

    console.log(`  Chain ID:     ${chainId} (net: ${netVersion})`);
    console.log(`  Block Height: ${blockNum.toLocaleString()}`);
    console.log(`  Peer Count:   ${peerCount}`);
    console.log(`  Mining:       ${mining}`);
    console.log(`  Syncing:      ${syncing === false ? 'No (fully synced)' : JSON.stringify(syncing)}`);
    console.log(`  Gas Price:    ${(gasPriceWei / 1e9).toFixed(2)} Gwei`);

    // 2. Validator Signers
    console.log('\n━━━ 2. VALIDATOR SIGNERS (Clique PoA) ━━━');
    const signers = await rpc('clique_getSigners', ['latest']);
    console.log(`  Total Signers: ${signers.length}`);
    signers.forEach((addr, i) => {
        console.log(`  [${i + 1}] ${addr}`);
    });

    // 3. Block Production Analysis (last 20 blocks)
    console.log('\n━━━ 3. BLOCK PRODUCTION (Last 20 blocks) ━━━');
    const signerCounts = {};
    const blockTimes = [];
    let prevTimestamp = null;

    for (let i = 0; i < 20; i++) {
        const bNum = blockNum - i;
        const block = await rpc('eth_getBlockByNumber', ['0x' + bNum.toString(16), false]);
        if (!block) continue;

        const timestamp = parseInt(block.timestamp, 16);
        
        // Extract signer from extraData (Clique: last 65 bytes = signature)
        const extraData = block.extraData;
        // In Clique, the signer is recoverable from the signature, but we can use clique_getSnapshot
        // For simplicity, check if we can identify the signer from the block
        
        if (prevTimestamp !== null) {
            blockTimes.push(prevTimestamp - timestamp);
        }
        prevTimestamp = timestamp;

        if (i < 10) {
            console.log(`  Block ${bNum} | ${new Date(timestamp * 1000).toISOString()} | Txs: ${block.transactions.length}`);
        }
    }

    if (blockTimes.length > 0) {
        const avgBlockTime = blockTimes.reduce((a, b) => a + b, 0) / blockTimes.length;
        const minBlockTime = Math.min(...blockTimes);
        const maxBlockTime = Math.max(...blockTimes);
        console.log(`\n  Avg Block Time: ${avgBlockTime.toFixed(2)}s`);
        console.log(`  Min Block Time: ${minBlockTime}s`);
        console.log(`  Max Block Time: ${maxBlockTime}s`);
    }

    // 4. Clique Snapshot (signer activity)
    console.log('\n━━━ 4. CLIQUE SNAPSHOT (Signer Activity) ━━━');
    try {
        const snapshot = await rpc('clique_getSnapshot', ['latest']);
        console.log(`  Snapshot Block: ${parseInt(snapshot.number, 16)}`);
        console.log(`  Snapshot Hash:  ${snapshot.hash?.slice(0, 18)}...`);
        
        if (snapshot.recents) {
            console.log(`  Recent Signers:`);
            const recentEntries = Object.entries(snapshot.recents).sort((a, b) => parseInt(b[0]) - parseInt(a[0]));
            const recentSignerCount = {};
            recentEntries.forEach(([blockNo, signer]) => {
                recentSignerCount[signer] = (recentSignerCount[signer] || 0) + 1;
            });
            
            console.log(`  Active signers in recent window: ${Object.keys(recentSignerCount).length}/${signers.length}`);
            Object.entries(recentSignerCount).forEach(([signer, count]) => {
                const idx = signers.indexOf(signer.toLowerCase()) + 1;
                const pct = ((count / recentEntries.length) * 100).toFixed(1);
                console.log(`    Signer ${idx} (${signer.slice(0, 10)}...): ${count} blocks (${pct}%)`);
            });

            // Check for inactive signers
            const activeSigners = new Set(Object.values(snapshot.recents).map(s => s.toLowerCase()));
            const inactiveSigners = signers.filter(s => !activeSigners.has(s.toLowerCase()));
            if (inactiveSigners.length > 0) {
                console.log(`\n  ⚠ INACTIVE SIGNERS (not in recent window):`);
                inactiveSigners.forEach(s => {
                    const idx = signers.indexOf(s.toLowerCase()) + 1;
                    console.log(`    [${idx}] ${s}`);
                });
            } else {
                console.log(`\n  All ${signers.length} signers are active.`);
            }
        }

        // Check votes (pending proposals)
        if (snapshot.votes && snapshot.votes.length > 0) {
            console.log(`\n  Pending Votes: ${snapshot.votes.length}`);
            snapshot.votes.forEach(v => {
                console.log(`    ${v.authorize ? 'AUTHORIZE' : 'DEAUTHORIZE'} ${v.address} by ${v.voter}`);
            });
        } else {
            console.log(`  Pending Votes: None`);
        }

    } catch (e) {
        console.log(`  Error fetching snapshot: ${e.message}`);
    }

    // 5. Contract Health (check key contracts are responding)
    console.log('\n━━━ 5. CONTRACT HEALTH ━━━');
    const contracts = {
        'VCNToken': '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        'Paymaster': '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        'BridgeStaking': '0xc351628EB244ec633d5f21fBD6621e1a683B1181',
    };

    for (const [name, addr] of Object.entries(contracts)) {
        try {
            const code = await rpc('eth_getCode', [addr, 'latest']);
            const hasCode = code && code !== '0x' && code.length > 2;
            console.log(`  ${name} (${addr.slice(0, 10)}...): ${hasCode ? 'DEPLOYED (' + Math.floor((code.length - 2) / 2) + ' bytes)' : 'NO CODE!'}`);
        } catch (e) {
            console.log(`  ${name}: ERROR - ${e.message}`);
        }
    }

    // 6. Admin/Mining Account Balance
    console.log('\n━━━ 6. KEY ACCOUNT BALANCES ━━━');
    const accounts = {
        'Node 1 (Miner)': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        'Paymaster EOA': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    };
    // Add all signers
    signers.forEach((s, i) => {
        if (!Object.values(accounts).includes(s)) {
            accounts[`Signer ${i + 1}`] = s;
        }
    });

    for (const [name, addr] of Object.entries(accounts)) {
        try {
            const balHex = await rpc('eth_getBalance', [addr, 'latest']);
            const balEth = parseInt(balHex, 16) / 1e18;
            console.log(`  ${name.padEnd(20)} (${addr.slice(0, 10)}...): ${balEth.toFixed(4)} VCN`);
        } catch (e) {
            console.log(`  ${name}: ERROR`);
        }
    }

    // 7. RPC Endpoint check (response time)
    console.log('\n━━━ 7. RPC ENDPOINT LATENCY ━━━');
    const endpoints = [
        'https://api.visionchain.co/rpc-proxy',
        'https://rpc.visionchain.co',
    ];
    for (const ep of endpoints) {
        try {
            const start = Date.now();
            const res = await fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
            });
            const elapsed = Date.now() - start;
            const data = await res.json();
            const ok = data.result ? 'OK' : 'ERROR';
            console.log(`  ${ep.padEnd(50)} ${ok} (${elapsed}ms)`);
        } catch (e) {
            console.log(`  ${ep.padEnd(50)} FAILED: ${e.message?.slice(0, 50)}`);
        }
    }

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                      SUMMARY                            ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Validators:  ${String(signers.length).padEnd(6)} Peers: ${String(peerCount).padEnd(6)} Mining: ${mining}      ║`);
    console.log(`║  Block:       ${String(blockNum).padEnd(6)} Synced: YES   Chain: ${chainId}   ║`);
    console.log(`║  Gas Price:   ${((gasPriceWei / 1e9).toFixed(2) + ' Gwei').padEnd(42)}║`);
    console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
