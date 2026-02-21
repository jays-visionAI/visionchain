/**
 * Vision Mobile Node - Registration / Login Screen
 *
 * Redesigned with Sign In / Sign Up tabs, password field,
 * and premium glassmorphism UI matching Vision Chain web app.
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
    ScrollView,
    Dimensions,
} from 'react-native';
import { signIn, signUp, getIdToken } from '../services/firebaseAuth';
import { register } from '../services/api';
import { saveCredentials } from '../services/storage';

const { width } = Dimensions.get('window');

interface Props {
    onRegistered: () => void;
}

type AuthMode = 'signin' | 'signup';

const RegisterScreen: React.FC<Props> = ({ onRegistered }) => {
    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async () => {
        // Validation
        if (!email.trim()) {
            setError('Email is required');
            return;
        }
        if (!password) {
            setError('Password is required');
            return;
        }
        if (mode === 'signup' && password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (mode === 'signup' && password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Step 1: Firebase Auth
            const authResult = mode === 'signin'
                ? await signIn(email.trim(), password)
                : await signUp(email.trim(), password);

            if (!authResult.success) {
                setError(authResult.error || 'Authentication failed');
                setLoading(false);
                return;
            }

            // Step 2: Get Firebase ID Token
            const idToken = authResult.idToken || await getIdToken();
            if (!idToken) {
                setError('Failed to get authentication token');
                setLoading(false);
                return;
            }

            // Step 3: Register mobile node with backend
            const result = await register(
                email.trim(),
                referralCode.trim() || undefined,
                idToken,
            );

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
                setError(result.error || 'Node registration failed');
            }
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <StatusBar barStyle="light-content" backgroundColor="#06061a" />
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}>

                {/* Logo & Title */}
                <View style={styles.header}>
                    <View style={styles.logoOuter}>
                        <View style={styles.logoInner}>
                            <View style={styles.logoVShape}>
                                <View style={styles.logoLineLeft} />
                                <View style={styles.logoLineRight} />
                            </View>
                        </View>
                    </View>
                    <Text style={styles.title}>Vision Node</Text>
                    <Text style={styles.subtitle}>
                        Secure the network.{'\n'}Earn VCN rewards.
                    </Text>
                </View>

                {/* Tab Switcher */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, mode === 'signin' && styles.tabActive]}
                        onPress={() => { setMode('signin'); setError(''); }}
                        activeOpacity={0.8}>
                        <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                            Sign In
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, mode === 'signup' && styles.tabActive]}
                        onPress={() => { setMode('signup'); setError(''); }}
                        activeOpacity={0.8}>
                        <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                            Sign Up
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Form */}
                <View style={styles.formCard}>
                    <Text style={styles.label}>Email</Text>
                    <TextInput
                        style={styles.input}
                        value={email}
                        onChangeText={setEmail}
                        placeholder="your@email.com"
                        placeholderTextColor="#44446a"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                    />

                    <Text style={styles.label}>Password</Text>
                    <TextInput
                        style={styles.input}
                        value={password}
                        onChangeText={setPassword}
                        placeholder={mode === 'signup' ? 'Min 6 characters' : 'Enter password'}
                        placeholderTextColor="#44446a"
                        secureTextEntry
                        editable={!loading}
                    />

                    {mode === 'signup' && (
                        <>
                            <Text style={styles.label}>Confirm Password</Text>
                            <TextInput
                                style={styles.input}
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Re-enter password"
                                placeholderTextColor="#44446a"
                                secureTextEntry
                                editable={!loading}
                            />

                            <Text style={styles.label}>Referral Code (optional)</Text>
                            <TextInput
                                style={styles.input}
                                value={referralCode}
                                onChangeText={setReferralCode}
                                placeholder="Enter referral code"
                                placeholderTextColor="#44446a"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!loading}
                            />
                        </>
                    )}

                    {error ? (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleAuth}
                        disabled={loading}
                        activeOpacity={0.7}>
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>
                                {mode === 'signin' ? 'Sign In' : 'Create Account'}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <Text style={styles.disclaimer}>
                    {mode === 'signup'
                        ? 'By creating an account, your device will contribute to the Vision Chain network by verifying blocks and relaying data.'
                        : 'Sign in with your Vision Chain account to resume node operations.'}
                </Text>

                {mode === 'signin' && (
                    <TouchableOpacity
                        style={styles.signupPrompt}
                        onPress={() => { setMode('signup'); setError(''); }}>
                        <Text style={styles.signupPromptText}>
                            New to Vision Chain?{' '}
                            <Text style={styles.signupPromptLink}>Create Account</Text>
                        </Text>
                    </TouchableOpacity>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#06061a',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 48,
    },
    // Header
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoOuter: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(108, 92, 231, 0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(108, 92, 231, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    logoInner: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoVShape: {
        width: 28,
        height: 24,
        position: 'relative',
    },
    logoLineLeft: {
        position: 'absolute',
        width: 3,
        height: 28,
        backgroundColor: '#a29bfe',
        borderRadius: 1.5,
        transform: [{ rotate: '-20deg' }],
        left: 4,
        top: -2,
    },
    logoLineRight: {
        position: 'absolute',
        width: 3,
        height: 28,
        backgroundColor: '#6c5ce7',
        borderRadius: 1.5,
        transform: [{ rotate: '20deg' }],
        right: 4,
        top: -2,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#ffffff',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: '#7a7a9e',
        textAlign: 'center',
        lineHeight: 22,
    },
    // Tabs
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        padding: 3,
        marginBottom: 24,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(108, 92, 231, 0.4)',
    },
    tabText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#555577',
    },
    tabTextActive: {
        color: '#a29bfe',
    },
    // Form Card
    formCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        padding: 20,
        marginBottom: 16,
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6a6a8e',
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 14,
        fontSize: 16,
        color: '#ffffff',
        marginBottom: 16,
    },
    errorContainer: {
        backgroundColor: 'rgba(231, 76, 60, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.3)',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 16,
    },
    errorText: {
        color: '#e74c3c',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    button: {
        backgroundColor: '#6c5ce7',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: '#6c5ce7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.3,
    },
    disclaimer: {
        fontSize: 12,
        color: '#44446a',
        textAlign: 'center',
        lineHeight: 18,
        paddingHorizontal: 12,
    },
    signupPrompt: {
        marginTop: 20,
        alignItems: 'center',
    },
    signupPromptText: {
        fontSize: 14,
        color: '#7a7a9e',
    },
    signupPromptLink: {
        color: '#a29bfe',
        fontWeight: '700',
    },
});

export default RegisterScreen;
