/**
 * Vision Node - Process Lock
 *
 * Ensures only ONE node instance runs per machine.
 * Both CLI and Desktop App use the same lockfile at ~/.visionnode/node.lock
 *
 * The lockfile contains:
 *   { pid, client, startedAt }
 *
 * On start, we check:
 *   1. Does lockfile exist?
 *   2. Is the PID in lockfile still alive?
 *   3. If alive → refuse to start (show which client holds the lock)
 *   4. If dead → remove stale lockfile and proceed
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_DIR = join(homedir(), '.visionnode');
const LOCK_PATH = join(CONFIG_DIR, 'node.lock');

export interface LockInfo {
    pid: number;
    client: 'cli' | 'app';
    startedAt: string;
    version: string;
}

/**
 * Check if a process is still running
 */
function isProcessAlive(pid: number): boolean {
    try {
        process.kill(pid, 0); // signal 0 = just check existence
        return true;
    } catch {
        return false;
    }
}

/**
 * Read the current lockfile (if exists)
 */
export function readLock(): LockInfo | null {
    if (!existsSync(LOCK_PATH)) return null;
    try {
        const raw = readFileSync(LOCK_PATH, 'utf-8');
        return JSON.parse(raw) as LockInfo;
    } catch {
        return null;
    }
}

/**
 * Try to acquire the lock. Returns null on success, or LockInfo of the holder on failure.
 */
export function acquireLock(client: 'cli' | 'app'): LockInfo | null {
    if (!existsSync(CONFIG_DIR)) {
        mkdirSync(CONFIG_DIR, { recursive: true });
    }

    const existing = readLock();
    if (existing) {
        if (isProcessAlive(existing.pid)) {
            // Another instance is genuinely running
            return existing;
        }
        // Stale lockfile from a crashed process — remove it
        try { unlinkSync(LOCK_PATH); } catch { }
    }

    // Write our lock
    const lock: LockInfo = {
        pid: process.pid,
        client,
        startedAt: new Date().toISOString(),
        version: '1.0.0',
    };
    writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2), 'utf-8');
    return null; // success
}

/**
 * Release the lock (only if we hold it)
 */
export function releaseLock(): void {
    const existing = readLock();
    if (existing && existing.pid === process.pid) {
        try { unlinkSync(LOCK_PATH); } catch { }
    }
}

/**
 * Get a human-readable description of the lock holder
 */
export function lockHolderDescription(lock: LockInfo): string {
    const clientName = lock.client === 'app' ? 'Vision Node App' : 'Vision Node CLI';
    return `${clientName} (PID ${lock.pid}, started ${lock.startedAt})`;
}
