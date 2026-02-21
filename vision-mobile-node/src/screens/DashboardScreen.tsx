/**
 * Vision Mobile Node - Dashboard Screen
 *
 * Redesigned with Hash Rate display, glassmorphism cards,
 * and premium UI matching Vision Chain web app.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    StatusBar,
    RefreshControl,
    ActivityIndicator,
    Animated,
} from 'react-native';
import { getStatus, claimReward, StatusResponse } from '../services/api';
import { heartbeatService, HeartbeatData } from '../services/heartbeat';
import { NetworkMode, networkAdapter } from '../services/networkAdapter';
import { blockObserver, BlockObserverStats } from '../services/blockObserver';
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
                return 'Light Mode';
            case 'offline':
                return 'Offline';
        }
    };

    /**
     * Calculate Hash Rate from block verification stats
     * Hash Rate = verified blocks per 5min interval, scaled for display
     */
    const getHashRate = (): string => {
        if (!blockStats || !blockStats.isRunning || blockStats.blocksVerified === 0) {
            return '0.0';
        }
        // Calculate blocks per minute, multiply by a display factor
        const elapsedMs = blockStats.lastBlockTime
            ? Date.now() - (blockStats.lastBlockTime - blockStats.blocksVerified * 5000)
            : 60000;
        const elapsedMinutes = Math.max(elapsedMs / 60000, 1);
        const blocksPerMinute = blockStats.blocksVerified / elapsedMinutes;
        const hashRate = blocksPerMinute * 10; // scale factor for display
        return hashRate.toFixed(1);
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#06061a" />

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
                    <View style={styles.settingsIcon}>
                        <View style={styles.settingsGear} />
                    </View>
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

                {/* Hash Rate Card */}
                <View style={styles.heroCard}>
                    <View style={styles.heroCardGlow} />
                    <Text style={styles.heroLabel}>HASH RATE</Text>
                    <View style={styles.heroValueRow}>
                        <Text style={styles.heroValue}>{getHashRate()}</Text>
                        <Text style={styles.heroUnit}>H/s</Text>
                    </View>
                    <View style={styles.heroDivider} />
                    <View style={styles.heroSubRow}>
                        <View style={styles.heroSubItem}>
                            <View
                                style={[
                                    styles.heroSubDot,
                                    { backgroundColor: blockStats?.isRunning ? '#00b894' : '#e74c3c' },
                                ]}
                            />
                            <Text style={styles.heroSubText}>
                                {blockStats?.isRunning
                                    ? `${blockStats.blocksVerified} blocks verified`
                                    : 'Block Observer off'}
                            </Text>
                        </View>
                        <Text style={styles.heroSubText}>
                            {blockStats?.accuracy || 100}% accuracy
                        </Text>
                    </View>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Uptime</Text>
                        <Text style={styles.statValue}>
                            {formatUptime(status?.today_uptime_seconds || heartbeat?.sessionUptimeSeconds || 0)}
                        </Text>
                    </View>
                    <View style={[styles.statCard, styles.statCardMiddle]}>
                        <Text style={styles.statLabel}>Streak</Text>
                        <Text style={styles.statValue}>
                            {status?.current_streak || 0}
                            <Text style={styles.statUnit}> days</Text>
                        </Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={styles.statLabel}>Heartbeat</Text>
                        <Text style={styles.statValue}>
                            {heartbeat ? (
                                <Text style={{ color: '#00b894' }}>Live</Text>
                            ) : (
                                <Text style={{ color: '#555' }}>--</Text>
                            )}
                        </Text>
                    </View>
                </View>

                {/* Rewards Card */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>REWARDS</Text>
                    <View style={styles.rewardsRow}>
                        <View style={styles.rewardCol}>
                            <Text style={styles.rewardAmount}>
                                {parseFloat(status?.pending_reward || heartbeat?.pendingReward || '0').toFixed(4)}
                            </Text>
                            <Text style={styles.rewardLabel}>Pending VCN</Text>
                        </View>
                        <View style={styles.rewardDivider} />
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

                {/* Block Verification Card */}
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardLabel}>BLOCK VERIFICATION</Text>
                        <View
                            style={[
                                styles.statusBadge,
                                {
                                    backgroundColor: blockStats?.isRunning
                                        ? 'rgba(0, 184, 148, 0.12)'
                                        : 'rgba(231, 76, 60, 0.12)',
                                    borderColor: blockStats?.isRunning
                                        ? 'rgba(0, 184, 148, 0.3)'
                                        : 'rgba(231, 76, 60, 0.3)',
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
                                : networkMode === 'cellular'
                                    ? 'Block verification available on WiFi'
                                    : 'Go online to verify blocks'}
                        </Text>
                    )}
                </View>

                {/* Node Info */}
                <View style={styles.card}>
                    <Text style={styles.cardLabel}>NODE INFO</Text>
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
                        <Text style={[styles.infoValue, { color: '#a29bfe' }]}>
                            {credentials?.referralCode || '-'}
                        </Text>
                    </View>
                </View>

                {/* Network Services */}
                {networkMode === 'wifi' && (
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>NETWORK SERVICES</Text>
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
                    style={styles.leaderboardBtn}
                    onPress={onOpenLeaderboard}
                    activeOpacity={0.7}>
                    <Text style={styles.leaderboardBtnText}>View Leaderboard</Text>
                    <Text style={styles.leaderboardArrow}>&gt;</Text>
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
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
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
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsIcon: {
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    settingsGear: {
        width: 14,
        height: 14,
        borderRadius: 7,
        borderWidth: 2,
        borderColor: '#8888aa',
    },
    scroll: {
        flex: 1,
        paddingHorizontal: 16,
    },
    // Hero Hash Rate Card
    heroCard: {
        backgroundColor: 'rgba(108, 92, 231, 0.08)',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: 'rgba(108, 92, 231, 0.2)',
        padding: 24,
        marginBottom: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    heroCardGlow: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(108, 92, 231, 0.15)',
    },
    heroLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7a7a9e',
        letterSpacing: 1.5,
        marginBottom: 8,
    },
    heroValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    heroValue: {
        fontSize: 48,
        fontWeight: '800',
        color: '#a29bfe',
        letterSpacing: -1,
    },
    heroUnit: {
        fontSize: 18,
        fontWeight: '600',
        color: '#6c5ce7',
        marginLeft: 6,
    },
    heroDivider: {
        height: 1,
        backgroundColor: 'rgba(108, 92, 231, 0.15)',
        marginVertical: 16,
    },
    heroSubRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroSubItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroSubDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    heroSubText: {
        fontSize: 12,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    // Stats Row
    statsRow: {
        flexDirection: 'row',
        marginBottom: 12,
        gap: 8,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        paddingVertical: 16,
        paddingHorizontal: 12,
    },
    statCardMiddle: {
        marginHorizontal: 0,
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#555577',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#ffffff',
    },
    statUnit: {
        fontSize: 12,
        fontWeight: '500',
        color: '#7a7a9e',
    },
    // Generic Card
    card: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        padding: 20,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6a6a8e',
        letterSpacing: 1,
        marginBottom: 16,
    },
    // Rewards
    rewardsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rewardCol: {
        flex: 1,
        alignItems: 'center',
    },
    rewardDivider: {
        width: 1,
        height: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    rewardAmount: {
        fontSize: 22,
        fontWeight: '700',
        color: '#00b894',
        marginBottom: 4,
    },
    rewardLabel: {
        fontSize: 12,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    claimButton: {
        backgroundColor: '#6c5ce7',
        borderRadius: 14,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 20,
        shadowColor: '#6c5ce7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 4,
    },
    claimButtonDisabled: {
        backgroundColor: 'rgba(108, 92, 231, 0.3)',
        shadowOpacity: 0,
        elevation: 0,
    },
    claimButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    // Block Stats
    statusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    blockStatsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    blockStatItem: {
        alignItems: 'center',
    },
    blockStatValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 4,
    },
    blockStatLabel: {
        fontSize: 11,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    inactiveText: {
        color: '#555577',
        fontSize: 13,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    // Node Info
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    },
    infoLabel: {
        fontSize: 13,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 13,
        color: '#ccccdd',
        fontWeight: '600',
        fontFamily: 'monospace',
    },
    // Leaderboard
    leaderboardBtn: {
        backgroundColor: 'rgba(162, 155, 254, 0.08)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(162, 155, 254, 0.2)',
        paddingVertical: 16,
        paddingHorizontal: 20,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    leaderboardBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#a29bfe',
    },
    leaderboardArrow: {
        fontSize: 18,
        color: '#a29bfe',
        fontWeight: '700',
    },
    // Logout
    logoutButton: {
        paddingVertical: 14,
        alignItems: 'center',
    },
    logoutText: {
        color: '#e74c3c',
        fontSize: 14,
        fontWeight: '600',
    },
    bottomSpacer: {
        height: 40,
    },
});

export default DashboardScreen;
