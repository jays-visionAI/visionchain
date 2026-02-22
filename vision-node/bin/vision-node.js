#!/usr/bin/env node

/**
 * Vision Node CLI Entry Point
 *
 * This is the main executable that gets installed globally via npm.
 * Usage: vision-node <command> [options]
 */

import('../dist/index.js').catch((err) => {
    console.error('Failed to start Vision Node:', err.message);
    console.error('Try running: npm run build');
    process.exit(1);
});
