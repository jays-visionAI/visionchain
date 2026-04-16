/**
 * VCN Balance Restoration Script
 * 
 * Restores VCN ERC-20 token balances from the v1 snapshot to the v2 token contract
 * by calling the Paymaster admin_transfer endpoint for each address.
 * 
 * Usage:
 *   node scripts/restore-vcn-balances.cjs                 # Dry run (default)
 *   node scripts/restore-vcn-balances.cjs --execute        # Execute transfers
 *   node scripts/restore-vcn-balances.cjs --single 0x...   # Restore single address
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PAYMASTER_URL = 'https://paymaster-sapjcm3s5a-uc.a.run.app';
const RPC_URL = 'https://api.visionchain.co/rpc-proxy';
const VCN_TOKEN = '0xf8a2F49C782447a8660554F7c3274cbd765b1963';
const ADMIN_ADDRESS = '0x805E8DB0175aeC75d2e2852aD14092466C281e3b';

// Addresses to skip (system/admin wallets)
const SKIP_ADDRESSES = new Set([
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266', // Node1 deployer
  '0x805e8db0175aec75d2e2852ad14092466c281e3b', // Admin executor
]);

// Delay between transfers (ms) - respects Paymaster lock and block time
const TRANSFER_DELAY_MS = 8000;

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`RPC Error: ${data.error.message}`);
  return data.result;
}

async function getERC20Balance(address) {
  const selector = '0x70a08231'; // balanceOf(address)
  const paddedAddr = address.replace('0x', '').toLowerCase().padStart(64, '0');
  const result = await rpcCall('eth_call', [
    { to: VCN_TOKEN, data: selector + paddedAddr },
    'latest',
  ]);
  return BigInt(result);
}

async function adminTransfer(recipient, amountWei) {
  const res = await fetch(PAYMASTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'admin_transfer',
      recipient,
      amount: amountWei,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }
  return data;
}

function formatVCN(wei) {
  const num = Number(BigInt(wei)) / 1e18;
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

async function main() {
  const args = process.argv.slice(2);
  const executeMode = args.includes('--execute');
  const singleIdx = args.indexOf('--single');
  const singleAddress = singleIdx >= 0 ? args[singleIdx + 1]?.toLowerCase() : null;

  console.log('='.repeat(60));
  console.log('  VCN Balance Restoration Script (v2 Testnet)');
  console.log(`  Mode: ${executeMode ? 'EXECUTE' : 'DRY RUN'}`);
  if (singleAddress) console.log(`  Target: ${singleAddress}`);
  console.log('='.repeat(60));
  console.log();

  // Load snapshot
  const snapshotPath = path.join(__dirname, '..', 'snapshots', 'vcn-snapshot.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'));
  const balances = snapshot.balances;

  console.log(`Snapshot: ${snapshot.timestamp}`);
  console.log(`Snapshot token: ${snapshot.tokenAddress}`);
  console.log(`Current token:  ${VCN_TOKEN}`);
  console.log();

  // Filter addresses
  let targets = {};
  for (const [addr, wei] of Object.entries(balances)) {
    if (SKIP_ADDRESSES.has(addr.toLowerCase())) continue;
    if (BigInt(wei) === 0n) continue;
    if (singleAddress && addr.toLowerCase() !== singleAddress) continue;
    targets[addr] = wei;
  }

  console.log(`Addresses to restore: ${Object.keys(targets).length}`);
  const totalWei = Object.values(targets).reduce((sum, v) => sum + BigInt(v), 0n);
  console.log(`Total VCN to restore: ${formatVCN(totalWei)} VCN`);
  console.log();

  // Pre-check: verify admin has enough balance
  const adminBalance = await getERC20Balance(ADMIN_ADDRESS);
  console.log(`Admin balance: ${formatVCN(adminBalance)} VCN`);
  if (adminBalance < totalWei) {
    console.error(`ERROR: Admin balance (${formatVCN(adminBalance)}) < required (${formatVCN(totalWei)})`);
    process.exit(1);
  }
  console.log('Admin balance is sufficient.');
  console.log();

  // Pre-check: existing on-chain balances
  console.log('Checking current on-chain balances...');
  let needsRestore = [];
  let alreadyRestored = [];

  for (const [addr, snapshotWei] of Object.entries(targets)) {
    const currentBalance = await getERC20Balance(addr);
    const snapshotAmount = BigInt(snapshotWei);

    if (currentBalance >= snapshotAmount) {
      alreadyRestored.push({ addr, current: currentBalance, snapshot: snapshotAmount });
      console.log(`  SKIP ${addr}: already has ${formatVCN(currentBalance)} (need ${formatVCN(snapshotAmount)})`);
    } else {
      const deficit = snapshotAmount - currentBalance;
      needsRestore.push({ addr, current: currentBalance, snapshot: snapshotAmount, deficit });
      console.log(`  NEED ${addr}: has ${formatVCN(currentBalance)}, need ${formatVCN(snapshotAmount)}, deficit: ${formatVCN(deficit)}`);
    }
  }

  console.log();
  console.log(`Already restored: ${alreadyRestored.length}`);
  console.log(`Needs restoration: ${needsRestore.length}`);

  if (needsRestore.length === 0) {
    console.log('\nAll balances already restored. Nothing to do.');
    return;
  }

  const totalDeficit = needsRestore.reduce((sum, r) => sum + r.deficit, 0n);
  console.log(`Total deficit: ${formatVCN(totalDeficit)} VCN`);
  console.log();

  if (!executeMode) {
    console.log('='.repeat(60));
    console.log('  DRY RUN COMPLETE - No transfers executed.');
    console.log('  Run with --execute to perform actual transfers.');
    console.log('='.repeat(60));
    return;
  }

  // Execute transfers
  console.log('='.repeat(60));
  console.log('  EXECUTING TRANSFERS...');
  console.log('='.repeat(60));
  console.log();

  const results = [];
  for (let i = 0; i < needsRestore.length; i++) {
    const { addr, deficit } = needsRestore[i];
    const deficitStr = deficit.toString();

    console.log(`[${i + 1}/${needsRestore.length}] Transferring ${formatVCN(deficit)} VCN to ${addr}...`);

    try {
      const result = await adminTransfer(addr, deficitStr);
      results.push({ addr, amount: deficitStr, status: 'SUCCESS', txHash: result.txHash });
      console.log(`  SUCCESS: ${result.txHash}`);
    } catch (err) {
      results.push({ addr, amount: deficitStr, status: 'FAILED', error: err.message });
      console.error(`  FAILED: ${err.message}`);
    }

    // Wait between transfers
    if (i < needsRestore.length - 1) {
      console.log(`  Waiting ${TRANSFER_DELAY_MS / 1000}s...`);
      await new Promise(r => setTimeout(r, TRANSFER_DELAY_MS));
    }
  }

  // Summary
  console.log();
  console.log('='.repeat(60));
  console.log('  RESTORATION COMPLETE');
  console.log('='.repeat(60));

  const succeeded = results.filter(r => r.status === 'SUCCESS');
  const failed = results.filter(r => r.status === 'FAILED');

  console.log(`  Succeeded: ${succeeded.length}`);
  console.log(`  Failed:    ${failed.length}`);
  console.log();

  if (failed.length > 0) {
    console.log('Failed transfers:');
    for (const f of failed) {
      console.log(`  ${f.addr}: ${f.error}`);
    }
  }

  // Save log
  const logPath = path.join(__dirname, '..', 'snapshots', `restoration-v2-${Date.now()}.json`);
  const log = {
    timestamp: new Date().toISOString(),
    dryRun: false,
    tokenAddress: VCN_TOKEN,
    adminAddress: ADMIN_ADDRESS,
    totalAddresses: needsRestore.length,
    succeeded: succeeded.length,
    failed: failed.length,
    results,
  };
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\nLog saved to: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
