/**
 * Vision Mobile Node - Registration / Login Screen
 *
 * Redesigned with Sign In / Sign Up tabs, password field,
 * and premium glassmorphism UI matching Vision Chain web app.
 */

import React, { useRef, useState } from 'react';
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
import { signIn, signUp, getIdToken, AuthErrorCode } from '../services/firebaseAuth';
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
    const [errorSuggestion, setErrorSuggestion] = useState('');
    const [showSwitchPrompt, setShowSwitchPrompt] = useState<'signup' | 'signin' | null>(null);

    const clearErrors = () => {
        setError('');
        setErrorSuggestion('');
        setShowSwitchPrompt(null);
    };

    const handleAuthError = (errorCode: AuthErrorCode | undefined, errorMsg: string) => {
        setError(errorMsg);
        setShowSwitchPrompt(null);
        setErrorSuggestion('');

        switch (errorCode) {
            case 'user-not-found':
                setErrorSuggestion('This email is not registered yet.');
                setShowSwitchPrompt('signup');
                break;
            case 'wrong-password':
                setErrorSuggestion('Please check your password and try again.');
                break;
            case 'invalid-credential':
                if (mode === 'signin') {
                    setErrorSuggestion('Email or password is incorrect. Check and try again, or create a new account.');
                    setShowSwitchPrompt('signup');
                }
                break;
            case 'email-in-use':
                setErrorSuggestion('You already have an account.');
                setShowSwitchPrompt('signin');
                break;
            case 'too-many-requests':
                setErrorSuggestion('Please wait 30 seconds before trying again.');
                break;
            case 'network-error':
                setErrorSuggestion('Check your WiFi or cellular connection.');
                break;
            case 'weak-password':
                setErrorSuggestion('Use at least 6 characters with letters and numbers.');
                break;
            default:
                setErrorSuggestion('Please try again.');
                break;
        }
    };

    const handleSwitchPrompt = () => {
        if (showSwitchPrompt) {
            setMode(showSwitchPrompt);
            clearErrors();
        }
    };

    const handleAuth = async () => {
        // Validation
        if (!email.trim()) {
            setError('Email is required');
            setErrorSuggestion('Please enter your email address.');
            return;
        }
        if (!password) {
            setError('Password is required');
            setErrorSuggestion('Please enter your password.');
            return;
        }
        if (mode === 'signup' && password.length < 6) {
            setError('Password too short');
            setErrorSuggestion('Password must be at least 6 characters.');
            return;
        }
        if (mode === 'signup' && password !== confirmPassword) {
            setError('Passwords do not match');
            setErrorSuggestion('Please re-enter your password.');
            return;
        }

        setLoading(true);
        clearErrors();

        try {
            // Step 1: Firebase Auth
            console.log('[Auth] Starting Firebase auth, mode:', mode);
            let authResult;
            try {
                authResult = mode === 'signin'
                    ? await signIn(email.trim(), password)
                    : await signUp(email.trim(), password);
            } catch (authErr: any) {
                console.warn('[Auth] Firebase auth threw:', authErr);
                setError('Authentication service error');
                setErrorSuggestion('Please try again in a moment.');
                setLoading(false);
                return;
            }

            if (!authResult.success) {
                console.log('[Auth] Auth failed:', authResult.errorCode, authResult.error);
                handleAuthError(authResult.errorCode, authResult.error || 'Authentication failed');
                setLoading(false);
                return;
            }

            console.log('[Auth] Firebase auth succeeded');

            // Step 2: Get Firebase ID Token
            let idToken: string | null = null;
            try {
                idToken = authResult.idToken || await getIdToken();
            } catch (tokenErr: any) {
                console.warn('[Auth] getIdToken threw:', tokenErr);
            }

            if (!idToken) {
                setError('Failed to get authentication token');
                setErrorSuggestion('Please try signing in again.');
                setLoading(false);
                return;
            }

            console.log('[Auth] Got ID token, calling register API');

            // Step 3: Register mobile node with backend
            // For sign-in, the backend should return existing node info
            // For sign-up, it creates a new node
            try {
                const result = await register(
                    email.trim(),
                    referralCode.trim() || undefined,
                    idToken,
                );

                console.log('[Auth] Register result:', JSON.stringify(result));

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
                    // If sign-in and node already exists, backend might return error
                    // but with node info -- try to extract it
                    const errorMsg = result.error || 'Node registration failed';
                    console.warn('[Auth] Register failed:', errorMsg);
                    setError(errorMsg);
                    setErrorSuggestion('The server could not process your request. Please try again.');
                }
            } catch (regErr: any) {
                console.warn('[Auth] Register API threw:', regErr?.message || regErr);
                setError('Server connection failed');
                setErrorSuggestion('Could not reach the server. Please check your internet connection and try again.');
            }
        } catch (err: any) {
            console.warn('[Auth] Unexpected error:', err?.message || err);
            setError('An unexpected error occurred');
            setErrorSuggestion('Please close and reopen the app, then try again.');
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
                        onPress={() => { setMode('signin'); clearErrors(); }}
                        activeOpacity={0.8}>
                        <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                            Sign In
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, mode === 'signup' && styles.tabActive]}
                        onPress={() => { setMode('signup'); clearErrors(); }}
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
                            <Text style={styles.errorTitle}>{error}</Text>
                            {errorSuggestion ? (
                                <Text style={styles.errorText}>{errorSuggestion}</Text>
                            ) : null}
                            {showSwitchPrompt ? (
                                <TouchableOpacity
                                    style={styles.errorAction}
                                    onPress={handleSwitchPrompt}
                                    activeOpacity={0.7}>
                                    <Text style={styles.errorActionText}>
                                        {showSwitchPrompt === 'signup' ? 'Create New Account' : 'Go to Sign In'}
                                    </Text>
                                </TouchableOpacity>
                            ) : null}
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
                        onPress={() => { setMode('signup'); clearErrors(); }}>
                        <Text style={styles.signupPromptText}>
                            New to Vision Chain?{' '}
                            <Text style={styles.signupPromptLink}>Create Account</Text>
                        </Text>
                    </TouchableOpacity>
                )}
                {mode === 'signup' && (
                    <TouchableOpacity
                        style={styles.signupPrompt}
                        onPress={() => { setMode('signin'); clearErrors(); }}>
                        <Text style={styles.signupPromptText}>
                            Already have an account?{' '}
                            <Text style={styles.signupPromptLink}>Sign In</Text>
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
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(231, 76, 60, 0.25)',
        borderRadius: 14,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 16,
    },
    errorTitle: {
        color: '#e74c3c',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
        marginBottom: 4,
    },
    errorText: {
        color: '#cc8888',
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    errorAction: {
        marginTop: 10,
        backgroundColor: 'rgba(108, 92, 231, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(108, 92, 231, 0.4)',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 20,
        alignItems: 'center',
    },
    errorActionText: {
        color: '#a29bfe',
        fontSize: 14,
        fontWeight: '700',
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
