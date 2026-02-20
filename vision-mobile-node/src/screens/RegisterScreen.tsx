/**
 * Vision Mobile Node - Registration Screen
 *
 * First screen shown to new users. Handles node registration
 * and referral code input.
 */

import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
} from 'react-native';
import { register } from '../services/api';
import { saveCredentials } from '../services/storage';

interface Props {
    onRegistered: () => void;
}

const RegisterScreen: React.FC<Props> = ({ onRegistered }) => {
    const [email, setEmail] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRegister = async () => {
        if (!email.trim()) {
            setError('Email is required');
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            setError('Please enter a valid email');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const result = await register(email.trim(), referralCode.trim() || undefined);

            if (result.success) {
                await saveCredentials({
                    apiKey: result.api_key,
                    nodeId: result.node_id,
                    email: email.trim(),
                    walletAddress: result.wallet_address,
                    referralCode: result.referral_code,
                });
                onRegistered();
            } else {
                setError(result.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            setError('Network error. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar barStyle="light-content" backgroundColor="#0a0a1a" />

            <View style={styles.header}>
                <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                        <Text style={styles.logoText}>V</Text>
                    </View>
                </View>
                <Text style={styles.title}>Vision Node</Text>
                <Text style={styles.subtitle}>
                    Contribute to the Vision Chain network{'\n'}and earn VCN rewards
                </Text>
            </View>

            <View style={styles.form}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor="#555577"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />

                <Text style={styles.label}>Referral Code (optional)</Text>
                <TextInput
                    style={styles.input}
                    value={referralCode}
                    onChangeText={setReferralCode}
                    placeholder="Enter referral code"
                    placeholderTextColor="#555577"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleRegister}
                    disabled={loading}
                    activeOpacity={0.7}>
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>Start Node</Text>
                    )}
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                    By registering, your device will contribute to the Vision Chain network
                    by verifying blocks and relaying data. You can stop at any time.
                </Text>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a1a',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        marginBottom: 16,
    },
    logoCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1a1a3e',
        borderWidth: 2,
        borderColor: '#6c5ce7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoText: {
        fontSize: 32,
        fontWeight: '700',
        color: '#a29bfe',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#8888aa',
        textAlign: 'center',
        lineHeight: 20,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: '#8888aa',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: {
        backgroundColor: '#12122a',
        borderWidth: 1,
        borderColor: '#2a2a4a',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#ffffff',
        marginBottom: 16,
    },
    error: {
        color: '#e74c3c',
        fontSize: 13,
        marginBottom: 16,
        textAlign: 'center',
    },
    button: {
        backgroundColor: '#6c5ce7',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 8,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
    },
    disclaimer: {
        fontSize: 11,
        color: '#555577',
        textAlign: 'center',
        marginTop: 20,
        lineHeight: 16,
    },
});

export default RegisterScreen;
