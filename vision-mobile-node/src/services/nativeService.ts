/**
 * Vision Mobile Node - Native Service Bridge
 *
 * JavaScript wrapper for the Android Foreground Service native module.
 * Controls the background service lifecycle from the React Native layer.
 */

import { NativeModules, Platform, AppRegistry } from 'react-native';
import { sendHeartbeat } from './api';
import { networkAdapter } from './networkAdapter';
import { loadCredentials } from './storage';

const { NodeServiceModule } = NativeModules;

/**
 * Start the Android Foreground Service.
 * Shows a persistent notification and keeps heartbeat running.
 */
export const startBackgroundService = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
        console.log('[NativeService] Not Android, skipping foreground service');
        return false;
    }

    if (!NodeServiceModule) {
        console.error('[NativeService] NodeServiceModule not available');
        return false;
    }

    try {
        const result = await NodeServiceModule.startService();
        console.log('[NativeService] Foreground service started:', result);
        return result;
    } catch (err) {
        console.error('[NativeService] Failed to start service:', err);
        return false;
    }
};

/**
 * Stop the Android Foreground Service.
 */
export const stopBackgroundService = async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || !NodeServiceModule) {
        return false;
    }

    try {
        const result = await NodeServiceModule.stopService();
        console.log('[NativeService] Foreground service stopped:', result);
        return result;
    } catch (err) {
        console.error('[NativeService] Failed to stop service:', err);
        return false;
    }
};

/**
 * HeadlessJS Task Handler
 *
 * This function is registered with AppRegistry and called by the
 * native VisionHeadlessTaskService when the app is in the background.
 * It sends a heartbeat and optionally runs block verification.
 */
const headlessHeartbeatTask = async (): Promise<void> => {
    console.log('[HeadlessTask] Running background heartbeat');

    try {
        const creds = await loadCredentials();
        if (!creds) {
            console.log('[HeadlessTask] No credentials found, skipping');
            return;
        }

        // Refresh network state
        const level = await networkAdapter.refresh();

        if (level.mode === 'offline') {
            console.log('[HeadlessTask] Offline, skipping heartbeat');
            return;
        }

        // Map network mode to server-expected format
        const apiMode = level.mode === 'wifi' ? 'wifi_full' : 'cellular_min';

        // Send heartbeat
        const result = await sendHeartbeat(creds.apiKey, apiMode);
        if (result.success) {
            console.log(
                `[HeadlessTask] Heartbeat OK - weight: ${result.weight}x, reward: ${result.pending_reward}`,
            );
        } else {
            console.warn('[HeadlessTask] Heartbeat failed:', result.error);
        }
    } catch (err) {
        console.error('[HeadlessTask] Error:', err);
    }
};

// Register the HeadlessJS task so the native side can invoke it
AppRegistry.registerHeadlessTask('VisionNodeHeartbeat', () => headlessHeartbeatTask);
