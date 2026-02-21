/**
 * Vision Mobile Node - Main App Entry
 *
 * Manages navigation between Register, Dashboard, Settings, and Leaderboard.
 * Initializes core services (network adapter, heartbeat, block observer, relay, cache).
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { loadCredentials, clearCredentials } from './src/services/storage';
import { firebaseSignOut } from './src/services/firebaseAuth';
import { networkAdapter } from './src/services/networkAdapter';
import { heartbeatService } from './src/services/heartbeat';
import { blockObserver } from './src/services/blockObserver';
import { microRelay } from './src/services/microRelay';
import { storageCache } from './src/services/storageCache';
import { startBackgroundService, stopBackgroundService } from './src/services/nativeService';

type Screen = 'loading' | 'register' | 'dashboard' | 'settings' | 'leaderboard';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('loading');

  useEffect(() => {
    const checkAuth = async () => {
      const creds = await loadCredentials();
      if (creds) {
        setScreen('dashboard');
      } else {
        setScreen('register');
      }
    };
    checkAuth();
  }, []);

  const handleRegistered = () => {
    startBackgroundService();
    setScreen('dashboard');
  };

  const handleLogout = async () => {
    // Stop all services
    heartbeatService.stop();
    await blockObserver.stop();
    microRelay.stop();
    await storageCache.stop();
    networkAdapter.stop();
    await stopBackgroundService();

    // Sign out from Firebase
    await firebaseSignOut();

    // Clear stored credentials
    await clearCredentials();

    setScreen('register');
  };

  const handleOpenSettings = () => setScreen('settings');
  const handleOpenLeaderboard = () => setScreen('leaderboard');
  const handleBackToDashboard = () => setScreen('dashboard');

  if (screen === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6c5ce7" />
      </View>
    );
  }

  if (screen === 'register') {
    return <RegisterScreen onRegistered={handleRegistered} />;
  }

  if (screen === 'settings') {
    return <SettingsScreen onBack={handleBackToDashboard} />;
  }

  if (screen === 'leaderboard') {
    return <LeaderboardScreen onBack={handleBackToDashboard} />;
  }

  return (
    <DashboardScreen
      onLogout={handleLogout}
      onOpenSettings={handleOpenSettings}
      onOpenLeaderboard={handleOpenLeaderboard}
    />
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: '#0a0a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;

