/**
 * Vision Mobile Node - Settings Screen
 *
 * Redesigned with glassmorphism cards, premium dark theme,
 * and Distributed Storage allocation management.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    StatusBar,
    Alert,
} from 'react-native';
import { loadSettings, saveSettings, AppSettings } from '../services/storage';
import { CONFIG } from '../services/config';
import { chunkStorage, ChunkStorageStats } from '../services/chunkStorage';

interface Props {
    onBack: () => void;
}

// Storage allocation tiers (in MB)
const STORAGE_TIERS = [
    { label: 'OFF', value: 0 },
    { label: '500MB', value: 500 },
    { label: '1 GB', value: 1024 },
    { label: '2 GB', value: 2048 },
    { label: '5 GB', value: 5120 },
    { label: '10 GB', value: 10240 },
];

const SettingsScreen: React.FC<Props> = ({ onBack }) => {
    const [settings, setSettings] = useState<AppSettings>({
        cellularAllowed: false,
        autoPauseBelowBattery: 20,
        maxCacheSizeMb: 50,
        storageAllocationMb: 10240,
        notificationsEnabled: true,
    });
    const [storageStats, setStorageStats] = useState<ChunkStorageStats>(
        chunkStorage.getStats(),
    );
    const [resizing, setResizing] = useState(false);

    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    // Subscribe to chunk storage stats
    useEffect(() => {
        const unsubscribe = chunkStorage.onChange(stats => {
            setStorageStats(stats);
        });
        // Get initial stats
        setStorageStats(chunkStorage.getStats());
        return unsubscribe;
    }, []);

    const updateSetting = async <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K],
    ) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        await saveSettings(updated);
    };

    const formatBytes = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    };

    const formatAllocation = (mb: number): string => {
        if (mb === 0) return 'OFF';
        if (mb < 1024) return `${mb} MB`;
        return `${(mb / 1024).toFixed(0)} GB`;
    };

    const handleStorageTierChange = useCallback(async (newMb: number) => {
        if (resizing) return;

        const currentUsage = storageStats.totalSizeBytes;
        const newMaxBytes = newMb * 1024 * 1024;

        // Warn if reducing below current usage
        if (newMb > 0 && newMaxBytes < currentUsage) {
            Alert.alert(
                'Reduce Storage',
                `Current usage (${formatBytes(currentUsage)}) exceeds the new limit (${formatAllocation(newMb)}). Excess data will be removed using LRU eviction.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Continue',
                        style: 'destructive',
                        onPress: () => applyStorageChange(newMb),
                    },
                ],
            );
            return;
        }

        if (newMb === 0 && currentUsage > 0) {
            Alert.alert(
                'Disable Distributed Storage',
                `This will remove all ${formatBytes(currentUsage)} of cached chunk data. Your node will no longer contribute storage to the network.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Disable',
                        style: 'destructive',
                        onPress: () => applyStorageChange(0),
                    },
                ],
            );
            return;
        }

        await applyStorageChange(newMb);
    }, [resizing, storageStats]);

    const applyStorageChange = async (newMb: number) => {
        setResizing(true);
        try {
            if (newMb === 0) {
                await chunkStorage.clearAll();
            } else {
                await chunkStorage.resize(newMb);
            }
            await updateSetting('storageAllocationMb', newMb);
        } catch (err) {
            console.error('[Settings] Storage resize failed:', err);
            Alert.alert('Error', 'Failed to update storage allocation.');
        } finally {
            setResizing(false);
        }
    };

    const usagePercent = storageStats.maxSizeBytes > 0
        ? Math.min(100, Math.round((storageStats.totalSizeBytes / storageStats.maxSizeBytes) * 100))
        : 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#06061a" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <View style={styles.backIcon}>
                        <View style={styles.backArrowTop} />
                        <View style={styles.backArrowBottom} />
                    </View>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* ─── Distributed Storage Section ─── */}
                <Text style={styles.sectionTitle}>DISTRIBUTED STORAGE</Text>
                <View style={styles.card}>
                    {/* Storage Header */}
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingHeader}>
                                <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 206, 209, 0.12)' }]}>
                                    <View style={styles.storageIconStack}>
                                        <View style={[styles.storageIconDisk, { backgroundColor: '#00ced1' }]} />
                                        <View style={[styles.storageIconDisk, { backgroundColor: '#00ced1', opacity: 0.7, marginTop: -2 }]} />
                                        <View style={[styles.storageIconDisk, { backgroundColor: '#00ced1', opacity: 0.4, marginTop: -2 }]} />
                                    </View>
                                </View>
                                <View>
                                    <Text style={styles.settingLabel}>Storage Allocation</Text>
                                    <Text style={[styles.settingDesc, { paddingLeft: 0, marginTop: 1 }]}>
                                        Contribute storage to the network
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Text style={styles.storageAllocationValue}>
                            {formatAllocation(settings.storageAllocationMb)}
                        </Text>
                    </View>

                    {/* Usage Progress Bar */}
                    {settings.storageAllocationMb > 0 && (
                        <View style={styles.usageSection}>
                            <View style={styles.usageHeader}>
                                <Text style={styles.usageLabel}>
                                    {formatBytes(storageStats.totalSizeBytes)} used
                                </Text>
                                <Text style={styles.usageLabel}>
                                    {usagePercent}%
                                </Text>
                            </View>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        {
                                            width: `${usagePercent}%`,
                                            backgroundColor: usagePercent > 90
                                                ? '#e17055'
                                                : usagePercent > 70
                                                    ? '#fdcb6e'
                                                    : '#00ced1',
                                        },
                                    ]}
                                />
                            </View>
                            <View style={styles.usageStats}>
                                <View style={styles.usageStatItem}>
                                    <View style={[styles.usageStatDot, { backgroundColor: '#00ced1' }]} />
                                    <Text style={styles.usageStatText}>
                                        {storageStats.totalChunks} chunks
                                    </Text>
                                </View>
                                <View style={styles.usageStatItem}>
                                    <View style={[styles.usageStatDot, { backgroundColor: '#a29bfe' }]} />
                                    <Text style={styles.usageStatText}>
                                        {storageStats.chunksServed} served
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}

                    {/* Tier Selector */}
                    <View style={styles.tierGrid}>
                        {STORAGE_TIERS.map(tier => {
                            const isActive = settings.storageAllocationMb === tier.value;
                            const isOff = tier.value === 0;
                            return (
                                <TouchableOpacity
                                    key={tier.value}
                                    disabled={resizing}
                                    style={[
                                        styles.tierButton,
                                        isActive && (isOff
                                            ? styles.tierButtonActiveOff
                                            : styles.tierButtonActive),
                                        resizing && styles.tierButtonDisabled,
                                    ]}
                                    onPress={() => handleStorageTierChange(tier.value)}>
                                    <Text
                                        style={[
                                            styles.tierButtonText,
                                            isActive && (isOff
                                                ? styles.tierButtonTextActiveOff
                                                : styles.tierButtonTextActive),
                                        ]}>
                                        {tier.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* Weight Info */}
                    <View style={styles.weightInfo}>
                        <View style={[styles.weightInfoDot, { backgroundColor: '#00ced1' }]} />
                        <Text style={styles.weightInfoText}>
                            {settings.storageAllocationMb > 0
                                ? 'Contributing storage earns +0.1x weight bonus'
                                : 'Enable storage to earn extra weight'}
                        </Text>
                    </View>
                </View>

                {/* ─── Network Section ─── */}
                <Text style={styles.sectionTitle}>NETWORK</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingHeader}>
                                <View style={[styles.settingIcon, { backgroundColor: 'rgba(108, 92, 231, 0.15)' }]}>
                                    <View style={[styles.iconDot, { backgroundColor: '#6c5ce7' }]} />
                                    <View style={[styles.iconDot, { backgroundColor: '#6c5ce7', marginTop: 3 }]} />
                                    <View style={[styles.iconDot, { backgroundColor: '#6c5ce7', marginTop: 3 }]} />
                                </View>
                                <Text style={styles.settingLabel}>Cellular Data</Text>
                            </View>
                            <Text style={styles.settingDesc}>
                                Send heartbeats over cellular (~3MB/month)
                            </Text>
                        </View>
                        <Switch
                            value={settings.cellularAllowed}
                            onValueChange={v => updateSetting('cellularAllowed', v)}
                            trackColor={{ false: 'rgba(255, 255, 255, 0.08)', true: 'rgba(108, 92, 231, 0.4)' }}
                            thumbColor={settings.cellularAllowed ? '#a29bfe' : '#555577'}
                        />
                    </View>
                </View>

                {/* ─── Battery Section ─── */}
                <Text style={styles.sectionTitle}>BATTERY</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingHeader}>
                                <View style={[styles.settingIcon, { backgroundColor: 'rgba(0, 184, 148, 0.15)' }]}>
                                    <View style={[styles.batteryBody, { borderColor: '#00b894' }]} />
                                    <View style={[styles.batteryTip, { backgroundColor: '#00b894' }]} />
                                </View>
                                <Text style={styles.settingLabel}>Auto-Pause at 20%</Text>
                            </View>
                            <Text style={styles.settingDesc}>
                                Pause node when battery drops below 20%
                            </Text>
                        </View>
                        <Switch
                            value={settings.autoPauseBelowBattery > 0}
                            onValueChange={v => updateSetting('autoPauseBelowBattery', v ? 20 : 0)}
                            trackColor={{ false: 'rgba(255, 255, 255, 0.08)', true: 'rgba(0, 184, 148, 0.4)' }}
                            thumbColor={settings.autoPauseBelowBattery > 0 ? '#00b894' : '#555577'}
                        />
                    </View>
                </View>

                {/* ─── Storage Cache Section ─── */}
                <Text style={styles.sectionTitle}>STORAGE CACHE</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingHeader}>
                                <View style={[styles.settingIcon, { backgroundColor: 'rgba(253, 203, 110, 0.15)' }]}>
                                    <View style={[styles.storageBar, { backgroundColor: '#fdcb6e', width: 8 }]} />
                                    <View style={[styles.storageBar, { backgroundColor: '#fdcb6e', width: 12, marginTop: 2 }]} />
                                    <View style={[styles.storageBar, { backgroundColor: '#fdcb6e', width: 6, marginTop: 2 }]} />
                                </View>
                                <Text style={styles.settingLabel}>Cache Limit</Text>
                            </View>
                            <Text style={styles.settingDesc}>
                                Maximum local cache for network data
                            </Text>
                        </View>
                        <Text style={styles.settingValue}>{settings.maxCacheSizeMb} MB</Text>
                    </View>
                    <View style={styles.cacheButtons}>
                        {[10, 25, 50, 100].map(size => (
                            <TouchableOpacity
                                key={size}
                                style={[
                                    styles.cacheOption,
                                    settings.maxCacheSizeMb === size && styles.cacheOptionActive,
                                ]}
                                onPress={() => updateSetting('maxCacheSizeMb', size)}>
                                <Text
                                    style={[
                                        styles.cacheOptionText,
                                        settings.maxCacheSizeMb === size &&
                                        styles.cacheOptionTextActive,
                                    ]}>
                                    {size}MB
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ─── Notifications ─── */}
                <Text style={styles.sectionTitle}>NOTIFICATIONS</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <View style={styles.settingHeader}>
                                <View style={[styles.settingIcon, { backgroundColor: 'rgba(162, 155, 254, 0.15)' }]}>
                                    <View style={[styles.bellBody, { borderColor: '#a29bfe' }]} />
                                    <View style={[styles.bellClapper, { backgroundColor: '#a29bfe' }]} />
                                </View>
                                <Text style={styles.settingLabel}>Push Notifications</Text>
                            </View>
                            <Text style={styles.settingDesc}>
                                Rewards claimed, network alerts
                            </Text>
                        </View>
                        <Switch
                            value={settings.notificationsEnabled}
                            onValueChange={v => updateSetting('notificationsEnabled', v)}
                            trackColor={{ false: 'rgba(255, 255, 255, 0.08)', true: 'rgba(162, 155, 254, 0.4)' }}
                            thumbColor={settings.notificationsEnabled ? '#a29bfe' : '#555577'}
                        />
                    </View>
                </View>

                {/* ─── About ─── */}
                <Text style={styles.sectionTitle}>ABOUT</Text>
                <View style={styles.card}>
                    <View style={styles.aboutRow}>
                        <Text style={styles.aboutLabel}>Version</Text>
                        <Text style={styles.aboutValue}>{CONFIG.APP_VERSION}</Text>
                    </View>
                    <View style={styles.aboutRow}>
                        <Text style={styles.aboutLabel}>Chain ID</Text>
                        <Text style={styles.aboutValue}>{CONFIG.CHAIN_ID}</Text>
                    </View>
                    <View style={[styles.aboutRow, { borderBottomWidth: 0 }]}>
                        <Text style={styles.aboutLabel}>Block Period</Text>
                        <Text style={styles.aboutValue}>{CONFIG.BLOCK_PERIOD_SECONDS}s</Text>
                    </View>
                </View>

                <View style={styles.bottomSpacer} />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#06061a',
    },
    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 52,
        paddingBottom: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    backIcon: {
        width: 14,
        height: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backArrowTop: {
        width: 10,
        height: 2,
        backgroundColor: '#a29bfe',
        borderRadius: 1,
        transform: [{ rotate: '-45deg' }, { translateY: 2 }],
    },
    backArrowBottom: {
        width: 10,
        height: 2,
        backgroundColor: '#a29bfe',
        borderRadius: 1,
        transform: [{ rotate: '45deg' }, { translateY: -2 }],
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.3,
    },
    headerSpacer: {
        width: 40,
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
    },
    // Section
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6a6a8e',
        letterSpacing: 1,
        marginTop: 24,
        marginBottom: 8,
        paddingLeft: 4,
    },
    // Card
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        padding: 16,
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    settingIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    iconDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    batteryBody: {
        width: 12,
        height: 8,
        borderWidth: 1.5,
        borderRadius: 2,
    },
    batteryTip: {
        width: 2,
        height: 4,
        borderRadius: 1,
        position: 'absolute',
        right: 6,
    },
    storageBar: {
        height: 2,
        borderRadius: 1,
    },
    bellBody: {
        width: 10,
        height: 8,
        borderWidth: 1.5,
        borderRadius: 5,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
    },
    bellClapper: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        marginTop: 1,
    },
    settingLabel: {
        fontSize: 15,
        color: '#ffffff',
        fontWeight: '600',
    },
    settingDesc: {
        fontSize: 12,
        color: '#7a7a9e',
        marginTop: 2,
        paddingLeft: 38,
    },
    settingValue: {
        fontSize: 15,
        color: '#a29bfe',
        fontWeight: '700',
    },
    // ─── Distributed Storage ───
    storageIconStack: {
        alignItems: 'center',
    },
    storageIconDisk: {
        width: 14,
        height: 4,
        borderRadius: 2,
    },
    storageAllocationValue: {
        fontSize: 16,
        color: '#00ced1',
        fontWeight: '800',
        letterSpacing: -0.3,
    },
    // Usage section
    usageSection: {
        marginTop: 16,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.04)',
    },
    usageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    usageLabel: {
        fontSize: 12,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    progressBarBg: {
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        overflow: 'hidden',
    },
    progressBarFill: {
        height: 6,
        borderRadius: 3,
    },
    usageStats: {
        flexDirection: 'row',
        marginTop: 10,
        gap: 16,
    },
    usageStatItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    usageStatDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 5,
    },
    usageStatText: {
        fontSize: 11,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    // Tier selector
    tierGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    tierButton: {
        width: '30%',
        flexGrow: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        alignItems: 'center',
    },
    tierButtonActive: {
        borderColor: 'rgba(0, 206, 209, 0.5)',
        backgroundColor: 'rgba(0, 206, 209, 0.1)',
    },
    tierButtonActiveOff: {
        borderColor: 'rgba(225, 112, 85, 0.4)',
        backgroundColor: 'rgba(225, 112, 85, 0.08)',
    },
    tierButtonDisabled: {
        opacity: 0.5,
    },
    tierButtonText: {
        fontSize: 13,
        color: '#555577',
        fontWeight: '600',
    },
    tierButtonTextActive: {
        color: '#00ced1',
    },
    tierButtonTextActiveOff: {
        color: '#e17055',
    },
    // Weight info
    weightInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.04)',
    },
    weightInfoDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 6,
    },
    weightInfoText: {
        fontSize: 12,
        color: '#6a6a8e',
        fontWeight: '500',
    },
    // Cache
    cacheButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 16,
        gap: 8,
    },
    cacheOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        alignItems: 'center',
    },
    cacheOptionActive: {
        borderColor: 'rgba(108, 92, 231, 0.4)',
        backgroundColor: 'rgba(108, 92, 231, 0.12)',
    },
    cacheOptionText: {
        fontSize: 13,
        color: '#555577',
        fontWeight: '600',
    },
    cacheOptionTextActive: {
        color: '#a29bfe',
    },
    // About
    aboutRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    },
    aboutLabel: {
        fontSize: 14,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    aboutValue: {
        fontSize: 14,
        color: '#ccccdd',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    bottomSpacer: {
        height: 40,
    },
});

export default SettingsScreen;
