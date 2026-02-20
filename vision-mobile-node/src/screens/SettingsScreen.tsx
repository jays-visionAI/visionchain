/**
 * Vision Mobile Node - Settings Screen
 *
 * User preferences for network usage, battery, cache, and notifications.
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
            <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Settings</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.scroll}>
                {/* Network */}
                <Text style={styles.sectionTitle}>Network</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Allow Cellular Data</Text>
                            <Text style={styles.settingDesc}>
                                Send heartbeats over cellular network (~3MB/month)
                            </Text>
                        </View>
                        <Switch
                            value={settings.cellularAllowed}
                            onValueChange={v => updateSetting('cellularAllowed', v)}
                            trackColor={{ false: '#2a2a4a', true: '#6c5ce744' }}
                            thumbColor={settings.cellularAllowed ? '#6c5ce7' : '#555577'}
                        />
                    </View>
                </View>

                {/* Battery */}
                <Text style={styles.sectionTitle}>Battery</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Auto-Pause Below 20%</Text>
                            <Text style={styles.settingDesc}>
                                Pause node when battery drops below 20%
                            </Text>
                        </View>
                        <Switch
                            value={settings.autoPauseBelowBattery > 0}
                            onValueChange={v => updateSetting('autoPauseBelowBattery', v ? 20 : 0)}
                            trackColor={{ false: '#2a2a4a', true: '#6c5ce744' }}
                            thumbColor={settings.autoPauseBelowBattery > 0 ? '#6c5ce7' : '#555577'}
                        />
                    </View>
                </View>

                {/* Storage */}
                <Text style={styles.sectionTitle}>Storage Cache</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Cache Limit</Text>
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
                <Text style={styles.sectionTitle}>Notifications</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Push Notifications</Text>
                            <Text style={styles.settingDesc}>
                                Rewards claimed, network alerts
                            </Text>
                        </View>
                        <Switch
                            value={settings.notificationsEnabled}
                            onValueChange={v => updateSetting('notificationsEnabled', v)}
                            trackColor={{ false: '#2a2a4a', true: '#6c5ce744' }}
                            thumbColor={settings.notificationsEnabled ? '#6c5ce7' : '#555577'}
                        />
                    </View>
                </View>

                {/* About */}
                <Text style={styles.sectionTitle}>About</Text>
                <View style={styles.card}>
                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Version</Text>
                        <Text style={styles.settingValue}>{CONFIG.APP_VERSION}</Text>
                    </View>
                    <View style={styles.settingRow}>
                        <Text style={styles.settingLabel}>Chain ID</Text>
                        <Text style={styles.settingValue}>{CONFIG.CHAIN_ID}</Text>
                    </View>
                    <View style={[styles.settingRow, styles.lastRow]}>
                        <Text style={styles.settingLabel}>Block Period</Text>
                        <Text style={styles.settingValue}>
                            {CONFIG.BLOCK_PERIOD_SECONDS}s
                        </Text>
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
        backgroundColor: '#0a0a1a',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 16,
        backgroundColor: '#0a0a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a3e',
    },
    backButton: {
        paddingVertical: 6,
        paddingRight: 12,
    },
    backText: {
        color: '#a29bfe',
        fontSize: 16,
        fontWeight: '600',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
    },
    headerSpacer: {
        width: 60,
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8888aa',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginTop: 24,
        marginBottom: 8,
        paddingLeft: 4,
    },
    card: {
        backgroundColor: '#12122a',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1e1e40',
    },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a3e',
    },
    lastRow: {
        borderBottomWidth: 0,
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingLabel: {
        fontSize: 15,
        color: '#ffffff',
        fontWeight: '500',
    },
    settingDesc: {
        fontSize: 12,
        color: '#666688',
        marginTop: 2,
    },
    settingValue: {
        fontSize: 15,
        color: '#a29bfe',
        fontWeight: '600',
    },
    cacheButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        gap: 8,
    },
    cacheOption: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#2a2a4a',
        alignItems: 'center',
    },
    cacheOptionActive: {
        borderColor: '#6c5ce7',
        backgroundColor: '#6c5ce722',
    },
    cacheOptionText: {
        fontSize: 13,
        color: '#666688',
        fontWeight: '600',
    },
    cacheOptionTextActive: {
        color: '#a29bfe',
    },
    bottomSpacer: {
        height: 40,
    },
});

export default SettingsScreen;
