/**
 * Vision Mobile Node - Leaderboard Screen
 *
 * Shows the top contributing nodes ranked by uptime and weight.
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

    const getRankColor = (rank: number): string => {
        if (rank === 1) return '#ffd700';
        if (rank === 2) return '#c0c0c0';
        if (rank === 3) return '#cd7f32';
        return '#8888aa';
    };

    const renderItem = ({ item }: { item: LeaderboardEntry }) => (
        <View style={styles.row}>
            <View style={styles.rankCol}>
                <Text style={[styles.rankText, { color: getRankColor(item.rank) }]}>
                    #{item.rank}
                </Text>
            </View>
            <View style={styles.infoCol}>
                <Text style={styles.emailText}>{item.email_masked}</Text>
                <Text style={styles.uptimeText}>
                    Uptime: {formatUptime(item.total_uptime_seconds)}
                </Text>
            </View>
            <View style={styles.rewardCol}>
                <Text style={styles.rewardText}>
                    {parseFloat(item.total_earned).toFixed(2)}
                </Text>
                <Text style={styles.rewardLabel}>VCN</Text>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Leaderboard</Text>
                <View style={styles.headerSpacer} />
            </View>

            <View style={styles.totalBar}>
                <Text style={styles.totalText}>
                    {totalNodes} active nodes
                </Text>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <Text style={styles.loadingText}>Loading...</Text>
                </View>
            ) : (
                <FlatList
                    data={entries}
                    keyExtractor={(item) => `rank-${item.rank}`}
                    renderItem={renderItem}
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
    totalBar: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#12122a',
        borderBottomWidth: 1,
        borderBottomColor: '#1e1e40',
    },
    totalText: {
        fontSize: 13,
        color: '#8888aa',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingTop: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#12122a',
        borderRadius: 12,
        marginVertical: 4,
        padding: 14,
        borderWidth: 1,
        borderColor: '#1e1e40',
    },
    rankCol: {
        width: 44,
        alignItems: 'center',
    },
    rankText: {
        fontSize: 16,
        fontWeight: '700',
    },
    infoCol: {
        flex: 1,
        marginLeft: 8,
    },
    emailText: {
        fontSize: 14,
        color: '#ffffff',
        fontWeight: '500',
    },
    uptimeText: {
        fontSize: 12,
        color: '#666688',
        marginTop: 2,
    },
    rewardCol: {
        alignItems: 'flex-end',
    },
    rewardText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffd700',
    },
    rewardLabel: {
        fontSize: 11,
        color: '#8888aa',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#8888aa',
        fontSize: 14,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#555577',
        fontSize: 14,
        fontStyle: 'italic',
    },
});

export default LeaderboardScreen;
