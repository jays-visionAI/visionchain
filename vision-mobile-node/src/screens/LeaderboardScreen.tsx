/**
 * Vision Mobile Node - Leaderboard Screen
 *
 * Redesigned with glassmorphism cards, top-3 podium, and premium dark theme.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    RefreshControl,
    StatusBar,
} from 'react-native';
import { getLeaderboard, LeaderboardEntry } from '../services/api';

interface Props {
    onBack: () => void;
}

const LeaderboardScreen: React.FC<Props> = ({ onBack }) => {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [totalNodes, setTotalNodes] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchLeaderboard = useCallback(async () => {
        try {
            const result = await getLeaderboard();
            if (result.success) {
                setEntries(result.leaderboard);
                setTotalNodes(result.total_nodes);
            }
        } catch (err) {
            console.error('Failed to load leaderboard:', err);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard().then(() => setLoading(false));
    }, [fetchLeaderboard]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchLeaderboard();
        setRefreshing(false);
    }, [fetchLeaderboard]);

    const formatUptime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days}d ${hours % 24}h`;
        }
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) {
            return { color: '#ffd700', bg: 'rgba(255, 215, 0, 0.1)', border: 'rgba(255, 215, 0, 0.25)' };
        }
        if (rank === 2) {
            return { color: '#c0c0c0', bg: 'rgba(192, 192, 192, 0.08)', border: 'rgba(192, 192, 192, 0.2)' };
        }
        if (rank === 3) {
            return { color: '#cd7f32', bg: 'rgba(205, 127, 50, 0.08)', border: 'rgba(205, 127, 50, 0.2)' };
        }
        return { color: '#7a7a9e', bg: 'rgba(255, 255, 255, 0.03)', border: 'rgba(255, 255, 255, 0.06)' };
    };

    const renderItem = ({ item }: { item: LeaderboardEntry }) => {
        const rankStyle = getRankStyle(item.rank);
        const isTop3 = item.rank <= 3;
        return (
            <View
                style={[
                    styles.row,
                    {
                        backgroundColor: rankStyle.bg,
                        borderColor: rankStyle.border,
                    },
                    isTop3 && styles.rowTop3,
                ]}>
                {/* Rank */}
                <View style={[styles.rankBadge, { backgroundColor: `${rankStyle.color}18` }]}>
                    <Text style={[styles.rankText, { color: rankStyle.color }]}>
                        {item.rank}
                    </Text>
                </View>

                {/* Info */}
                <View style={styles.infoCol}>
                    <Text style={styles.emailText}>{item.email_masked}</Text>
                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <View style={[styles.metaDot, { backgroundColor: '#00b894' }]} />
                            <Text style={styles.metaText}>
                                {formatUptime(item.total_uptime_seconds)}
                            </Text>
                        </View>
                        <View style={styles.metaItem}>
                            <View style={[styles.metaDot, { backgroundColor: '#6c5ce7' }]} />
                            <Text style={styles.metaText}>
                                {item.streak_days || 0}d streak
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Reward */}
                <View style={styles.rewardCol}>
                    <Text style={[styles.rewardText, isTop3 && { color: rankStyle.color }]}>
                        {parseFloat(item.total_earned).toFixed(2)}
                    </Text>
                    <Text style={styles.rewardLabel}>VCN</Text>
                </View>
            </View>
        );
    };

    const ListHeader = () => (
        <View style={styles.statsBar}>
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalNodes}</Text>
                <Text style={styles.statLabel}>Active Nodes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
                <Text style={styles.statValue}>{entries.length}</Text>
                <Text style={styles.statLabel}>Ranked</Text>
            </View>
        </View>
    );

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
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <View style={styles.headerSpacer} />
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading rankings...</Text>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => `rank-${item.rank}`}
                    renderItem={renderItem}
                    ListHeaderComponent={ListHeader}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor="#6c5ce7"
                        />
                    }
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No active nodes yet</Text>
                            <Text style={styles.emptySubtext}>Be the first to start earning!</Text>
                        </View>
                    }
                />
            )}
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
    // Stats Bar
    statsBar: {
        flexDirection: 'row',
        backgroundColor: 'rgba(108, 92, 231, 0.08)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(108, 92, 231, 0.15)',
        marginBottom: 16,
        padding: 16,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '800',
        color: '#a29bfe',
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 12,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    // List
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 16,
        marginBottom: 8,
        padding: 14,
        borderWidth: 1,
    },
    rowTop3: {
        paddingVertical: 18,
    },
    rankBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        fontSize: 15,
        fontWeight: '800',
    },
    infoCol: {
        flex: 1,
        marginLeft: 12,
    },
    emailText: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '600',
        marginBottom: 4,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        marginRight: 4,
    },
    metaText: {
        fontSize: 11,
        color: '#7a7a9e',
        fontWeight: '500',
    },
    rewardCol: {
        alignItems: 'flex-end',
    },
    rewardText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#ffffff',
    },
    rewardLabel: {
        fontSize: 10,
        color: '#7a7a9e',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    // Loading & Empty
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#7a7a9e',
        fontSize: 14,
    },
    emptyContainer: {
        paddingVertical: 60,
        alignItems: 'center',
    },
    emptyText: {
        color: '#555577',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 6,
    },
    emptySubtext: {
        color: '#44446a',
        fontSize: 13,
    },
});

export default LeaderboardScreen;
