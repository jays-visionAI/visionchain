/**
 * Notification Service
 * Handles creation and management of various notification types
 */

import { getFirebaseDb } from './firebaseService';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { NotificationType, NotificationData } from '../components/wallet/WalletNotifications';

interface CreateNotificationParams {
    userEmail: string;
    type: NotificationType;
    title: string;
    content: string;
    data?: NotificationData;
    category?: 'transaction' | 'staking' | 'referral' | 'event' | 'system' | 'security';
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    actionable?: boolean;
}

/**
 * Create a notification in Firestore
 */
export async function createNotification(params: CreateNotificationParams): Promise<string | null> {
    try {
        const db = getFirebaseDb();
        const email = params.userEmail.toLowerCase();

        const notificationRef = collection(db, 'users', email, 'notifications');

        const notificationDoc = await addDoc(notificationRef, {
            type: params.type,
            title: params.title,
            content: params.content,
            timestamp: serverTimestamp(),
            read: false,
            data: params.data || {},
            category: params.category || getCategoryFromType(params.type),
            priority: params.priority || 'normal',
            actionable: params.actionable || false,
        });

        console.log(`[Notification] Created: ${params.type} for ${email}`);
        return notificationDoc.id;
    } catch (error) {
        console.error('[Notification] Failed to create:', error);
        return null;
    }
}

/**
 * Determine category from notification type
 */
function getCategoryFromType(type: NotificationType): string {
    if (type.startsWith('transfer') || type.startsWith('multi_send')) return 'transaction';
    if (type.startsWith('staking')) return 'staking';
    if (type.startsWith('timelock')) return 'transaction';
    if (type.startsWith('referral') || type === 'level_up') return 'referral';
    if (type.startsWith('event') || type.startsWith('prize') || type.startsWith('ranking')) return 'event';
    if (type.startsWith('bridge') || type === 'challenge_raised') return 'transaction';
    if (type.startsWith('system') || type === 'alert') return 'system';
    if (type === 'security_alert') return 'security';
    return 'system';
}

// ============================================================================
// Notification Builders - Pre-built notification creators for common events
// ============================================================================

/**
 * Transfer Notifications
 */
export const TransferNotifications = {
    received: (userEmail: string, amount: string, token: string, from: string, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'transfer_received',
            title: 'Transfer Received',
            content: `You received ${amount} ${token} from ${from.slice(0, 8)}...${from.slice(-6)}`,
            data: { amount, token, from, txHash },
            priority: 'normal',
        }),

    sent: (userEmail: string, amount: string, token: string, to: string, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'transfer_sent',
            title: 'Transfer Sent',
            content: `You sent ${amount} ${token} to ${to.slice(0, 8)}...${to.slice(-6)}`,
            data: { amount, token, to, txHash },
            priority: 'normal',
        }),

    scheduled: (userEmail: string, amount: string, token: string, to: string, unlockTime: Date) =>
        createNotification({
            userEmail,
            type: 'transfer_scheduled',
            title: 'Transfer Scheduled',
            content: `${amount} ${token} scheduled to ${to.slice(0, 8)}...${to.slice(-6)} on ${unlockTime.toLocaleDateString()}`,
            data: { amount, token, to, unlockTime: unlockTime.toISOString() },
            priority: 'normal',
        }),
};

/**
 * Staking Notifications
 */
export const StakingNotifications = {
    deposit: (userEmail: string, amount: string, duration: number, stakingId?: string) =>
        createNotification({
            userEmail,
            type: 'staking_deposit',
            title: 'Staking Confirmed',
            content: `Successfully staked ${amount} VCN for ${duration} days`,
            data: { stakingAmount: amount, stakingDuration: duration, stakingId },
            priority: 'normal',
        }),

    withdrawal: (userEmail: string, amount: string, rewardAmount?: string, stakingId?: string) =>
        createNotification({
            userEmail,
            type: 'staking_withdrawal',
            title: 'Unstaking Complete',
            content: rewardAmount
                ? `Withdrawn ${amount} VCN + ${rewardAmount} VCN rewards`
                : `Withdrawn ${amount} VCN from staking`,
            data: { stakingAmount: amount, rewardAmount, stakingId },
            priority: 'normal',
        }),

    pending: (userEmail: string, amount: string, unlockDate: Date, stakingId?: string) =>
        createNotification({
            userEmail,
            type: 'staking_pending',
            title: 'Staking Period Ending Soon',
            content: `Your ${amount} VCN stake will unlock on ${unlockDate.toLocaleDateString()}`,
            data: { stakingAmount: amount, expiresAt: unlockDate.toISOString(), stakingId },
            priority: 'normal',
        }),

    reward: (userEmail: string, rewardAmount: string, stakingId?: string) =>
        createNotification({
            userEmail,
            type: 'staking_reward',
            title: 'Staking Reward Received',
            content: `You earned ${rewardAmount} VCN from staking rewards`,
            data: { rewardAmount, stakingId },
            priority: 'normal',
        }),
};

/**
 * TimeLock (Scheduled Transfer) Notifications
 */
export const TimeLockNotifications = {
    scheduled: (userEmail: string, amount: string, to: string, unlockTime: Date, scheduleId?: string) =>
        createNotification({
            userEmail,
            type: 'timelock_scheduled',
            title: 'TimeLock Created',
            content: `${amount} VCN locked until ${unlockTime.toLocaleDateString()} for ${to.slice(0, 8)}...`,
            data: { amount, to, expiresAt: unlockTime.toISOString(), stakingId: scheduleId },
            priority: 'normal',
        }),

    executed: (userEmail: string, amount: string, to: string, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'timelock_executed',
            title: 'TimeLock Executed',
            content: `Successfully transferred ${amount} VCN to ${to.slice(0, 8)}...`,
            data: { amount, to, txHash },
            priority: 'normal',
        }),

    cancelled: (userEmail: string, amount: string, reason?: string) =>
        createNotification({
            userEmail,
            type: 'timelock_cancelled',
            title: 'TimeLock Cancelled',
            content: reason || `TimeLock transfer of ${amount} VCN was cancelled`,
            data: { amount },
            priority: 'high',
        }),
};

/**
 * Multi-Send Notifications
 */
export const MultiSendNotifications = {
    complete: (userEmail: string, totalAmount: string, recipientCount: number, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'multi_send_complete',
            title: 'Multi-Send Complete',
            content: `Successfully sent ${totalAmount} VCN to ${recipientCount} recipients`,
            data: { amount: totalAmount, txHash },
            priority: 'normal',
        }),

    partial: (userEmail: string, successCount: number, failCount: number, totalAmount: string) =>
        createNotification({
            userEmail,
            type: 'multi_send_partial',
            title: 'Multi-Send Partial Success',
            content: `${successCount} transfers succeeded, ${failCount} failed. Total: ${totalAmount} VCN`,
            data: { amount: totalAmount },
            priority: 'high',
        }),
};

/**
 * Referral & Level Notifications
 */
export const ReferralNotifications = {
    signup: (userEmail: string, referredUser: string) =>
        createNotification({
            userEmail,
            type: 'referral_signup',
            title: 'New Referral Signup!',
            content: `${referredUser} joined Vision Chain using your invite link!`,
            data: { referredUser },
            priority: 'normal',
        }),

    reward: (userEmail: string, bonusAmount: string, referredUser: string, level?: number) =>
        createNotification({
            userEmail,
            type: 'referral_reward',
            title: 'Referral Bonus Earned',
            content: `You earned ${bonusAmount} VCN from ${referredUser}'s activity`,
            data: { bonusAmount, referredUser, referralLevel: level },
            priority: 'normal',
        }),

    levelUp: (userEmail: string, previousLevel: number, newLevel: number, bonusAmount?: string) =>
        createNotification({
            userEmail,
            type: 'level_up',
            title: `Level Up! You reached Level ${newLevel}`,
            content: bonusAmount
                ? `Congratulations! You advanced from Level ${previousLevel} to Level ${newLevel}. Bonus: ${bonusAmount} VCN`
                : `Congratulations! You advanced from Level ${previousLevel} to Level ${newLevel}`,
            data: { previousLevel, newLevel, bonusAmount },
            priority: 'high',
        }),
};

/**
 * Event & Prize Notifications
 */
export const EventNotifications = {
    participation: (userEmail: string, eventName: string, eventId?: string) =>
        createNotification({
            userEmail,
            type: 'event_participation',
            title: 'Event Joined',
            content: `You're now participating in "${eventName}"`,
            data: { eventName, eventId },
            priority: 'normal',
        }),

    result: (userEmail: string, eventName: string, rank?: number, prizeAmount?: string) =>
        createNotification({
            userEmail,
            type: 'event_result',
            title: 'Event Results',
            content: rank
                ? `${eventName} ended. You ranked #${rank}${prizeAmount ? ` and won ${prizeAmount} VCN!` : ''}`
                : `${eventName} has ended. Check your results.`,
            data: { eventName, rank, prizeAmount },
            priority: rank && rank <= 10 ? 'high' : 'normal',
        }),

    winner: (userEmail: string, eventName: string, rank: number, prizeAmount: string) =>
        createNotification({
            userEmail,
            type: 'prize_winner',
            title: 'Congratulations! You Won!',
            content: `You ranked #${rank} in ${eventName} and won ${prizeAmount} VCN!`,
            data: { eventName, rank, prizeAmount },
            priority: 'urgent',
        }),

    rankingUpdate: (userEmail: string, eventName: string, previousRank: number, currentRank: number) =>
        createNotification({
            userEmail,
            type: 'ranking_update',
            title: 'Ranking Update',
            content: currentRank < previousRank
                ? `You moved up to #${currentRank} in ${eventName}!`
                : `Your rank changed to #${currentRank} in ${eventName}`,
            data: { eventName, rank: currentRank },
            priority: currentRank <= 10 ? 'high' : 'normal',
        }),
};

/**
 * System Notifications
 */
export const SystemNotifications = {
    announcement: (userEmail: string, title: string, content: string, actionUrl?: string) =>
        createNotification({
            userEmail,
            type: 'system_announcement',
            title,
            content,
            data: { actionUrl },
            priority: 'high',
            actionable: !!actionUrl,
        }),

    notice: (userEmail: string, title: string, content: string) =>
        createNotification({
            userEmail,
            type: 'system_notice',
            title,
            content,
            priority: 'normal',
        }),

    securityAlert: (userEmail: string, title: string, content: string, actionUrl?: string) =>
        createNotification({
            userEmail,
            type: 'security_alert',
            title,
            content,
            data: { actionUrl },
            priority: 'urgent',
            actionable: !!actionUrl,
        }),

    alert: (userEmail: string, title: string, content: string) =>
        createNotification({
            userEmail,
            type: 'alert',
            title,
            content,
            priority: 'high',
        }),
};

/**
 * Bridge Notifications
 */
export const BridgeNotifications = {
    pending: (userEmail: string, amount: string, fromChain: string, toChain: string, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'bridge_pending',
            title: 'Bridge Transfer Pending',
            content: `${amount} VCN bridging from ${fromChain} to ${toChain}. This may take a few minutes.`,
            data: { amount, from: fromChain, to: toChain, txHash },
            priority: 'normal',
        }),

    finalized: (userEmail: string, amount: string, fromChain: string, toChain: string, txHash?: string) =>
        createNotification({
            userEmail,
            type: 'bridge_finalized',
            title: 'Bridge Transfer Complete',
            content: `Successfully bridged ${amount} VCN from ${fromChain} to ${toChain}`,
            data: { amount, from: fromChain, to: toChain, txHash },
            priority: 'normal',
        }),

    challengeRaised: (userEmail: string, amount: string, reason?: string) =>
        createNotification({
            userEmail,
            type: 'challenge_raised',
            title: 'Bridge Challenge Raised',
            content: reason || `A challenge was raised on your ${amount} VCN bridge transfer`,
            data: { amount },
            priority: 'urgent',
        }),
};

/**
 * Broadcast notification to multiple users
 */
export async function broadcastNotification(
    userEmails: string[],
    type: NotificationType,
    title: string,
    content: string,
    data?: NotificationData
): Promise<number> {
    let successCount = 0;

    for (const email of userEmails) {
        const result = await createNotification({
            userEmail: email,
            type,
            title,
            content,
            data,
        });
        if (result) successCount++;
    }

    console.log(`[Notification] Broadcast complete: ${successCount}/${userEmails.length} sent`);
    return successCount;
}
