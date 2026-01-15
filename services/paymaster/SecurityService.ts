import { getFirebaseDb } from '../firebaseService';
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore';

export const SecurityService = {
    /**
     * Add Entity to Denylist
     * Target: 'DAPP' | 'USER' | 'IP'
     */
    addToDenylist: async (targetType: 'DAPP' | 'USER', targetId: string, reason: string) => {
        const db = getFirebaseDb();
        const docId = `deny_${targetType}_${targetId}`;

        await setDoc(doc(db, 'paymaster_denylist', docId), {
            targetType,
            targetId,
            reason,
            timestamp: Date.now(),
            active: true
        });

        console.log(`[Security] Blocked ${targetType}: ${targetId} (${reason})`);

        // If DApp, auto-suspend account
        if (targetType === 'DAPP') {
            const dappRef = doc(db, 'paymaster_dapps', targetId);
            await updateDoc(dappRef, {
                'compliance.isDenylisted': true,
                status: 'BANNED'
            });
        }
    },

    /**
     * Check if Entity is Allowed
     */
    isBlocked: async (targetType: 'DAPP' | 'USER', targetId: string): Promise<boolean> => {
        const db = getFirebaseDb();
        const docId = `deny_${targetType}_${targetId}`;
        const snap = await getDoc(doc(db, 'paymaster_denylist', docId));
        return snap.exists() && snap.data()?.active;
    },

    /**
     * Fraud Detection: High Velocity Check
     * Simple Rule: > 100 tx in 1 min from same user -> Flag
     */
    checkFraudVelocity: async (userId: string, txCountLastMin: number): Promise<boolean> => {
        if (txCountLastMin > 100) {
            console.warn(`[Fraud] High Velocity detected for User ${userId} (${txCountLastMin} tx/min)`);
            return true;
        }
        return false;
    }
};
