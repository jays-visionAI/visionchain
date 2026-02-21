/**
 * Vision Mobile Node - Settings Screen
 *
 * Redesigned with glassmorphism cards and premium dark theme.
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    TouchableOpacity,
    StatusBar,
} from 'react-native';
import { loadSettings, saveSettings, AppSettings } from '../services/storage';
import { CONFIG } from '../services/config';

interface Props {
    onBack: () => void;
}

const SettingsScreen: React.FC<Props> = ({ onBack }) => {
    const [settings, setSettings] = useState<AppSettings>({
        cellularAllowed: false,
        autoPauseBelowBattery: 20,
        maxCacheSizeMb: 50,
        notificationsEnabled: true,
    });

    useEffect(() => {
        loadSettings().then(setSettings);
    }, []);

    const updateSetting = async <K extends keyof AppSettings>(
        key: K,
        value: AppSettings[K],
    ) => {
        const updated = { ...settings, [key]: value };
        setSettings(updated);
        await saveSettings(updated);
    };

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
                {/* Network Section */}
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

                {/* Battery Section */}
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

                {/* Storage Section */}
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

                {/* Notifications */}
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

                {/* About */}
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
