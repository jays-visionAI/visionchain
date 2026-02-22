/**
 * Vision Node - CLI Main Entry Point
 *
 * Provides the command-line interface using Commander.js.
 * Commands: init, start, stop, status, config
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { configManager } from './config/nodeConfig.js';
import { gatewayClient } from './api/gateway.js';
import { nodeManager } from './core/nodeManager.js';
import { heartbeatService } from './core/heartbeat.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load package.json for version
let version = '1.0.0';
try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    version = pkg.version;
} catch {
    // Use default version
}

const program = new Command();

program
    .name('vision-node')
    .description('Vision Chain Distributed Storage Node')
    .version(version);

// ─── INIT ───
program
    .command('init')
    .description('Initialize a new Vision Node')
    .requiredOption('-e, --email <email>', 'Email address for node registration')
    .option('-s, --storage <size>', 'Storage allocation (e.g., 50GB)', '50GB')
    .option('-r, --referral <code>', 'Referral code')
    .option('--class <class>', 'Node class: lite, standard, full', '')
    .option('--staging', 'Use staging environment')
    .action(async (opts) => {
        console.log(chalk.bold('\n  Vision Node - Initialization\n'));

        // Load or create config
        configManager.load();

        if (configManager.isInitialized()) {
            console.log(chalk.yellow('  Node already initialized.'));
            console.log(`  Email: ${configManager.get().email}`);
            console.log(`  Node ID: ${configManager.get().nodeId || 'pending'}`);
            console.log('\n  Use "vision-node start" to run the node.');
            console.log('  Use "vision-node init --force" to reinitialize.\n');
            return;
        }

        // Parse storage size
        const storageGB = parseStorageSize(opts.storage);
        if (storageGB <= 0) {
            console.error(chalk.red(`  Invalid storage size: ${opts.storage}`));
            console.error('  Examples: 10GB, 50GB, 100GB, 500GB, 1TB');
            process.exit(1);
        }

        // Auto-detect node class or use specified
        const detectedClass = nodeManager.detectNodeClass();
        const nodeClass = opts.class || detectedClass;

        // Update config
        configManager.update({
            email: opts.email,
            storageMaxGB: storageGB,
            nodeClass: nodeClass as any,
            environment: opts.staging ? 'staging' : 'production',
            firstLaunch: new Date().toISOString(),
            referralCode: opts.referral || '',
        });

        console.log(`  Email:     ${chalk.cyan(opts.email)}`);
        console.log(`  Storage:   ${chalk.cyan(storageGB + 'GB')}`);
        console.log(`  Class:     ${chalk.cyan(nodeClass)}${opts.class ? '' : chalk.gray(' (auto-detected)')}`);
        console.log(`  Env:       ${chalk.cyan(opts.staging ? 'staging' : 'production')}`);

        if (opts.referral) {
            console.log(`  Referral:  ${chalk.cyan(opts.referral)}`);
        }

        // Register with backend
        console.log(chalk.gray('\n  Registering with Vision Chain...'));
        gatewayClient.refresh();
        const result = await gatewayClient.register(opts.email, opts.referral);

        if (result.success) {
            configManager.update({
                apiKey: result.api_key || '',
                nodeId: result.node_id || '',
                walletAddress: result.wallet_address || '',
                registered: true,
            });
            configManager.save();

            console.log(chalk.green('\n  Registration successful!'));
            console.log(`  Node ID:  ${chalk.cyan(result.node_id)}`);
            console.log(`  Wallet:   ${chalk.cyan(result.wallet_address)}`);
            console.log(`\n  Run ${chalk.bold('vision-node start')} to begin earning rewards.\n`);
        } else {
            // Save config anyway so user can retry
            configManager.save();
            console.error(chalk.red(`\n  Registration failed: ${result.error}`));
            console.error('  Config saved. Fix the issue and run "vision-node start".\n');
            process.exit(1);
        }
    });

// ─── START ───
program
    .command('start')
    .description('Start the Vision Node')
    .option('-d, --daemon', 'Run in background (daemon mode)')
    .action(async (opts) => {
        configManager.load();

        if (!configManager.isInitialized()) {
            console.error(chalk.red('\n  Node not initialized. Run "vision-node init" first.\n'));
            process.exit(1);
        }

        printBanner();

        const config = configManager.get();
        configManager.update({ lastLaunch: new Date().toISOString() });
        configManager.save();

        console.log(chalk.gray(`  Email:    ${config.email}`));
        console.log(chalk.gray(`  Class:    ${config.nodeClass}`));
        console.log(chalk.gray(`  Storage:  ${config.storageMaxGB}GB`));
        console.log(chalk.gray(`  Env:      ${config.environment}`));
        console.log('');

        if (opts.daemon) {
            console.log(chalk.yellow('  Daemon mode not yet implemented. Running in foreground.\n'));
        }

        // Start the node
        await nodeManager.start();

        console.log(chalk.green('\n  Node is running. Press Ctrl+C to stop.\n'));

        // Keep process alive
        const shutdown = async () => {
            console.log(chalk.yellow('\n  Shutting down...'));
            await nodeManager.stop();
            console.log(chalk.green('  Node stopped. Goodbye!\n'));
            process.exit(0);
        };

        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);

        // Keep alive
        await new Promise(() => { });
    });

// ─── STOP ───
program
    .command('stop')
    .description('Stop the running Vision Node')
    .action(async () => {
        // For daemon mode (future), this would send a signal
        console.log(chalk.yellow('\n  Use Ctrl+C to stop a foreground node.'));
        console.log('  Daemon stop will be available in a future version.\n');
    });

// ─── STATUS ───
program
    .command('status')
    .description('Show node status')
    .action(async () => {
        configManager.load();

        if (!configManager.isInitialized()) {
            console.error(chalk.red('\n  Node not initialized. Run "vision-node init" first.\n'));
            process.exit(1);
        }

        if (!configManager.isRegistered()) {
            console.log(chalk.yellow('\n  Node initialized but not registered with backend.'));
            console.log('  Run "vision-node start" to register.\n');
            return;
        }

        console.log(chalk.gray('\n  Fetching status from Vision Chain...\n'));

        gatewayClient.refresh();
        const result = await gatewayClient.status();

        if (result.success) {
            const config = configManager.get();
            console.log(chalk.bold('  Vision Node Status\n'));
            console.log(`  Node ID:      ${chalk.cyan(config.nodeId)}`);
            console.log(`  Class:        ${chalk.cyan(config.nodeClass)}`);
            console.log(`  Status:       ${chalk.green(result.status || 'active')}`);
            console.log(`  Uptime:       ${chalk.cyan((result.uptime_hours || 0).toFixed(1) + 'h')}`);
            console.log(`  Heartbeats:   ${chalk.cyan(String(result.total_heartbeats || 0))}`);
            console.log(`  Reward:       ${chalk.yellow((result.pending_reward || 0).toFixed(4) + ' VCN')}`);
            console.log(`  Rank:         ${chalk.cyan('#' + (result.rank || '?'))}`);
            console.log(`  Storage:      ${chalk.cyan(config.storageMaxGB + 'GB allocated')}`);
            console.log(`  Environment:  ${chalk.gray(config.environment)}`);
            console.log('');
        } else {
            console.error(chalk.red(`  Failed to get status: ${result.error}\n`));
        }
    });

// ─── CONFIG ───
program
    .command('config')
    .description('View or update node configuration')
    .option('--set <key=value>', 'Set a config value')
    .option('--json', 'Output as JSON')
    .action(async (opts) => {
        configManager.load();

        if (opts.set) {
            const [key, value] = opts.set.split('=');
            if (!key || value === undefined) {
                console.error(chalk.red('  Usage: vision-node config --set key=value\n'));
                process.exit(1);
            }

            const numericFields = ['storageMaxGB', 'heartbeatIntervalMs', 'dashboardPort', 'p2pPort'];
            const parsedValue = numericFields.includes(key) ? Number(value) : value;

            configManager.update({ [key]: parsedValue } as any);
            configManager.save();
            console.log(chalk.green(`  Set ${key} = ${value}\n`));
            return;
        }

        const config = configManager.get();

        if (opts.json) {
            console.log(JSON.stringify(config, null, 2));
        } else {
            console.log(chalk.bold('\n  Vision Node Configuration\n'));
            console.log(`  Email:          ${config.email || chalk.gray('(not set)')}`);
            console.log(`  Node ID:        ${config.nodeId || chalk.gray('(not registered)')}`);
            console.log(`  Class:          ${config.nodeClass}`);
            console.log(`  Environment:    ${config.environment}`);
            console.log(`  Storage Max:    ${config.storageMaxGB}GB`);
            console.log(`  Storage Path:   ${config.storagePath}`);
            console.log(`  HB Interval:    ${config.heartbeatIntervalMs / 1000}s`);
            console.log(`  Dashboard Port: ${config.dashboardPort}`);
            console.log(`  P2P Port:       ${config.p2pPort}`);
            console.log(`  Registered:     ${config.registered ? chalk.green('yes') : chalk.yellow('no')}`);
            console.log(`  Config Dir:     ${configManager.getConfigDir()}`);
            console.log('');
        }
    });

// ─── HELPERS ───

function parseStorageSize(input: string): number {
    const match = input.match(/^(\d+(?:\.\d+)?)\s*(MB|GB|TB)$/i);
    if (!match) return -1;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    switch (unit) {
        case 'MB': return value / 1024;
        case 'GB': return value;
        case 'TB': return value * 1024;
        default: return -1;
    }
}

function printBanner(): void {
    console.log(chalk.cyan(`
  ╔══════════════════════════════════════════╗
  ║                                          ║
  ║     V I S I O N   N O D E    v${version.padEnd(8)}║
  ║     Distributed Storage Network          ║
  ║                                          ║
  ╚══════════════════════════════════════════╝
`));
}

// Run CLI
program.parse();
