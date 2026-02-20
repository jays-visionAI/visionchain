/**
 * Vision Mobile Node - Dashboard Screen
 *
 * Main screen showing node status, block verification stats,
 * rewards, and network contribution.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
    Platform,
} from 'react-native';
import { getStatus, StatusResponse, claimReward } from '../services/api';
import { heartbeatService, HeartbeatData } from '../services/heartbeat';
import { blockObserver, BlockObserverStats } from '../services/blockObserver';
import { networkAdapter, NetworkMode } from '../services/networkAdapter';
import { loadCredentials, NodeCredentials } from '../services/storage';
import { microRelay, RelayStats } from '../services/microRelay';
import { storageCache, CacheStats } from '../services/storageCache';

interface Props {
    onLogout: () => void;
    onOpenSettings: () => void;
    onOpenLeaderboard: () => void;
}

const DashboardScreen: React.FC<Props> = ({ onLogout, onOpenSettings, onOpenLeaderboard }) => {
    const [credentials, setCredentials] = useState<NodeCredentials | null>(null);
    const [status, setStatus] = useState<StatusResponse | null>(null);
    const [heartbeat, setHeartbeat] = useState<HeartbeatData | null>(null);
    const [blockStats, setBlockStats] = useState<BlockObserverStats | null>(null);
    const [networkMode, setNetworkMode] = useState<NetworkMode>('offline');
    const [relayStats, setRelayStats] = useState<RelayStats | null>(null);
    const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [claiming, setClaiming] = useState(false);

    // Initialize
    useEffect(() => {
        const init = async () => {
            const creds = await loadCredentials();
            if (!creds) {
                return;
            }
            setCredentials(creds);

            // Start services
            networkAdapter.start();
            heartbeatService.start(creds.apiKey);

            // Start block observer if on WiFi
            const level = networkAdapter.getContributionLevel();
            setNetworkMode(level.mode);
            if (level.blockObserverEnabled) {
                try {
                    await blockObserver.start(creds.apiKey);
                } catch (err) {
                    console.warn('[Dashboard] Block observer failed to start:', err);
                }
                // Start relay and cache on WiFi
                microRelay.start(creds.apiKey);
                await storageCache.start(creds.apiKey);
            }

            // Fetch initial status
            try {
                const s = await getStatus(creds.apiKey);
                if (s.success) {
                    setStatus(s);
                }
            } catch (err) {
                console.warn('[Dashboard] Status fetch failed:', err);
            }
        };

        init();

        // Subscribe to updates
        const unsubHB = heartbeatService.onChange(data => setHeartbeat(data));
        const unsubBO = blockObserver.onChange(stats => setBlockStats(stats));
        const unsubRelay = microRelay.onChange(stats => setRelayStats(stats));
        const unsubCache = storageCache.onChange(stats => setCacheStats(stats));
        const unsubNet = networkAdapter.onChange(level => {
            setNetworkMode(level.mode);
            if (level.blockObserverEnabled && !blockObserver.getStats().isRunning) {
                loadCredentials().then(creds => {
                    if (creds) {
                        blockObserver.start(creds.apiKey).catch(() => { });
                        microRelay.start(creds.apiKey);
                        storageCache.start(creds.apiKey).catch(() => { });
                    }
                });
            } else if (!level.blockObserverEnabled && blockObserver.getStats().isRunning) {
                blockObserver.stop();
                microRelay.stop();
                storageCache.stop();
            }
        });

        return () => {
            unsubHB();
            unsubBO();
            unsubRelay();
            unsubCache();
            unsubNet();
        };
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        if (credentials) {
            try {
                const s = await getStatus(credentials.apiKey);
                if (s.success) {
                    setStatus(s);
                }
            } catch { }
        }
        setRefreshing(false);
    }, [credentials]);

    const handleClaim = async () => {
        if (!credentials || claiming) {
            return;
        }
        setClaiming(true);
        try {
            const result = await claimReward(credentials.apiKey);
            if (result.success) {
                // Refresh status
                await onRefresh();
            }
        } catch (err) {
            console.error('Claim failed:', err);
        }
        setClaiming(false);
    };

    const formatUptime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const getModeColor = (mode: NetworkMode): string => {
        switch (mode) {
            case 'wifi':
                return '#00b894';
            case 'cellular':
                return '#fdcb6e';
            case 'offline':
                return '#e74c3c';
        }
    };

    const getModeLabel = (mode: NetworkMode): string => {
        switch (mode) {
            case 'wifi':
                return 'Full Mode';
            case 'cellular':
                return 'Minimal Mode';
            case 'offline':
                return 'Offline';
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

            {/* Header */}
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>Vision Node</Text>
                    <View style={styles.statusRow}>
                        <View
                            style={[styles.statusDot, { backgroundColor: getModeColor(networkMode) }]}
                        />
                        <Text
                            style={[styles.statusLabel, { color: getModeColor(networkMode) }]}>
                            {getModeLabel(networkMode)}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
                    <Text style={styles.settingsBtnText}>Settings</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#6c5ce7"
                    />
                }>
                {/* Weight Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Current Weight</Text>
                    <Text style={styles.weightValue}>
                        {heartbeat?.weight?.toFixed(1) || '0.0'}x
                    </Text>
                    <View style={styles.weightBreakdown}>
                        <Text style={styles.breakdownItem}>
                            Base: {networkMode === 'wifi' ? '0.5x' : networkMode === 'cellular' ? '0.1x' : '0x'}
                        </Text>
                        {blockStats && blockStats.blocksVerified > 0 && (
                            <Text style={styles.breakdownItem}>
                                + Block Verify: +0.2x
                            </Text>
                        )}
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={[styles.statCard, styles.statCardLeft]}>
                        <Text style={styles.statLabel}>Uptime</Text>
                        <Text style={styles.statValue}>
                            {formatUptime(status?.today_uptime_seconds || heartbeat?.sessionUptimeSeconds || 0)}
                        </Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardRight]}>
                        <Text style={styles.statLabel}>Streak</Text>
                        <Text style={styles.statValue}>
                            {status?.current_streak || 0} days
                        </Text>
                    </View>
                </View>

                {/* Rewards Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Rewards</Text>
                    <View style={styles.rewardsRow}>
                        <View style={styles.rewardCol}>
                            <Text style={styles.rewardAmount}>
                                {parseFloat(status?.pending_reward || heartbeat?.pendingReward || '0').toFixed(4)}
                            </Text>
                            <Text style={styles.rewardLabel}>Pending VCN</Text>
                        </View>
                        <View style={styles.rewardCol}>
                            <Text style={styles.rewardAmount}>
                                {parseFloat(status?.total_earned || '0').toFixed(4)}
                            </Text>
                            <Text style={styles.rewardLabel}>Total Earned</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.claimButton,
                            (claiming || parseFloat(status?.pending_reward || '0') === 0) &&
                            styles.claimButtonDisabled,
                        ]}
                        onPress={handleClaim}
                        disabled={claiming || parseFloat(status?.pending_reward || '0') === 0}>
                        <Text style={styles.claimButtonText}>
                            {claiming ? 'Claiming...' : 'Claim Rewards'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Block Observer Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardLabel}>Block Verification</Text>
                        <View
                            style={[
                                styles.statusBadge,
                                {
                                    backgroundColor: blockStats?.isRunning
                                        ? '#00b89422'
                                        : '#e74c3c22',
                                },
                            ]}>
                            <Text
                                style={[
                                    styles.statusBadgeText,
                                    {
                                        color: blockStats?.isRunning ? '#00b894' : '#e74c3c',
                                    },
                                ]}>
                                {blockStats?.isRunning ? 'Active' : 'Inactive'}
                            </Text>
                        </View>
                    </View>

                    {blockStats?.isRunning ? (
                        <View style={styles.blockStatsGrid}>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    {blockStats.blocksVerified}
                                </Text>
                                <Text style={styles.blockStatLabel}>Verified</Text>
                            </View>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    {blockStats.accuracy}%
                                </Text>
                                <Text style={styles.blockStatLabel}>Accuracy</Text>
                            </View>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    #{blockStats.lastBlockNumber}
                                </Text>
                                <Text style={styles.blockStatLabel}>Last Block</Text>
                            </View>
                        </View>
                    ) : (
                        <Text style={styles.inactiveText}>
                            {networkMode === 'wifi'
                                ? 'Connecting to blockchain...'
                                : 'Connect to WiFi to verify blocks'}
                        </Text>
                    )}
                </View>

                {/* Node Info */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>Node Info</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Node ID</Text>
                        <Text style={styles.infoValue}>
                            {credentials?.nodeId?.substring(0, 12)}...
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Wallet</Text>
                        <Text style={styles.infoValue}>
                            {credentials?.walletAddress
                                ? `${credentials.walletAddress.substring(0, 8)}...${credentials.walletAddress.substring(credentials.walletAddress.length - 6)}`
                                : '-'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Referral Code</Text>
                        <Text style={styles.infoValue}>
                            {credentials?.referralCode || '-'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Network Rank</Text>
                        <Text style={styles.infoValue}>
                            #{status?.referral_count || '-'}
                        </Text>
                    </View>
                </View>

                {/* Relay & Cache Card */}
                {networkMode === 'wifi' && (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Network Services</Text>
                        <View style={styles.blockStatsGrid}>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    {(relayStats?.messagesRelayed || 0) + (relayStats?.transactionsRelayed || 0)}
                                </Text>
                                <Text style={styles.blockStatLabel}>Relayed</Text>
                            </View>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    {cacheStats?.totalEntries || 0}
                                </Text>
                                <Text style={styles.blockStatLabel}>Cached</Text>
                            </View>
                            <View style={styles.blockStatItem}>
                                <Text style={styles.blockStatValue}>
                                    {cacheStats?.hitRate || 0}%
                                </Text>
                                <Text style={styles.blockStatLabel}>Hit Rate</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Leaderboard Button */}
                <TouchableOpacity
                    style={[styles.card, { alignItems: 'center' }]}
                    onPress={onOpenLeaderboard}
                    activeOpacity={0.7}>
                    <Text style={[styles.cardLabel, { marginBottom: 0, color: '#a29bfe' }]}>View Leaderboard</Text>
                </TouchableOpacity>

                {/* Logout */}
                <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
                    <Text style={styles.logoutText}>Disconnect Node</Text>
                </TouchableOpacity>

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
    headerTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#ffffff',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    settingsBtn: {
        backgroundColor: '#1a1a3e',
        borderRadius: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    settingsBtnText: {
        color: '#a29bfe',
        fontSize: 13,
        fontWeight: '600',
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
    },
    card: {
        backgroundColor: '#12122a',
        borderRadius: 16,
        padding: 20,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#1e1e40',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8888aa',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
    },
    weightValue: {
        fontSize: 48,
        fontWeight: '800',
        color: '#a29bfe',
        textAlign: 'center',
    },
    weightBreakdown: {
        alignItems: 'center',
        marginTop: 8,
    },
    breakdownItem: {
        fontSize: 12,
        color: '#666688',
    },
    statsRow: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#12122a',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#1e1e40',
    },
    statCardLeft: {
        marginRight: 6,
    },
    statCardRight: {
        marginLeft: 6,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8888aa',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffffff',
        marginTop: 4,
    },
    rewardsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    rewardCol: {
        alignItems: 'center',
    },
    rewardAmount: {
        fontSize: 24,
        fontWeight: '700',
        color: '#ffd700',
    },
    rewardLabel: {
        fontSize: 12,
        color: '#8888aa',
        marginTop: 4,
    },
    claimButton: {
        backgroundColor: '#6c5ce7',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    claimButtonDisabled: {
        opacity: 0.5,
    },
    claimButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
    },
    statusBadge: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    statusBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    blockStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    blockStatItem: {
        alignItems: 'center',
    },
    blockStatValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    blockStatLabel: {
        fontSize: 11,
        color: '#8888aa',
        marginTop: 4,
    },
    inactiveText: {
        fontSize: 13,
        color: '#555577',
        textAlign: 'center',
        fontStyle: 'italic',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a3e',
    },
    infoLabel: {
        fontSize: 14,
        color: '#8888aa',
    },
    infoValue: {
        fontSize: 14,
        color: '#ffffff',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    logoutButton: {
        marginTop: 24,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e74c3c44',
        alignItems: 'center',
    },
    logoutText: {
        color: '#e74c3c',
        fontSize: 15,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 40,
    },
});

export default DashboardScreen;
