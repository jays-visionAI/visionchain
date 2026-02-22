/**
 * Vision Mobile Node - Main App Entry
 *
 * Manages navigation between Onboarding, Register, Dashboard, Settings, and Leaderboard.
 * Shows onboarding flow on first launch, then register/login.
 * Handles Android back button and battery-based auto-pause/resume.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, NativeModules, StyleSheet, View } from 'react-native';
import OnboardingScreen from './src/screens/OnboardingScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import { loadCredentials, clearCredentials, loadSettings } from './src/services/storage';
import { firebaseSignOut } from './src/services/firebaseAuth';
import { networkAdapter } from './src/services/networkAdapter';
import { heartbeatService } from './src/services/heartbeat';
import { blockObserver } from './src/services/blockObserver';
import { microRelay } from './src/services/microRelay';
import { storageCache } from './src/services/storageCache';
import { startBackgroundService, stopBackgroundService } from './src/services/nativeService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { NodeServiceModule } = NativeModules;
const ONBOARDING_KEY = '@vision_onboarding_complete';

type Screen = 'loading' | 'onboarding' | 'register' | 'dashboard' | 'settings' | 'leaderboard';

const App: React.FC = () => {
  const [screen, setScreen] = useState<Screen>('loading');
  const [batteryPaused, setBatteryPaused] = useState(false);
  const batteryCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const creds = await loadCredentials();
      if (creds) {
        setScreen('dashboard');
        return;
      }

      // Check if onboarding was completed
      const onboardingDone = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (onboardingDone) {
        setScreen('register');
      } else {
        setScreen('onboarding');
      }
    };
    checkAuth();
  }, []);

  // ─── Android Hardware Back Button Handler ───
  useEffect(() => {
    const onBackPress = () => {
      // If on settings or leaderboard, go back to dashboard
      if (screen === 'settings' || screen === 'leaderboard') {
        setScreen('dashboard');
        return true; // Prevent default (app exit)
      }
      // On dashboard, let the default behavior happen (minimize app, NOT exit)
      if (screen === 'dashboard') {
        return true; // Prevent app exit, just stay on dashboard
      }
      // On other screens, allow default behavior
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [screen]);

  // ─── Battery Monitoring for Auto-Pause/Resume ───
  useEffect(() => {
    // Only monitor battery when on dashboard (node is active)
    if (screen !== 'dashboard') {
      return;
    }

    const checkBattery = async () => {
      try {
        const settings = await loadSettings();
        const threshold = settings.autoPauseBelowBattery || 0;

        // If auto-pause is disabled (threshold = 0), skip
        if (threshold <= 0) {
          if (batteryPaused) {
            // Re-enable if was paused and setting got disabled
            resumeNode();
          }
          return;
        }

        if (!NodeServiceModule?.getBatteryLevel) {
          return;
        }

        const level = await NodeServiceModule.getBatteryLevel();
        if (level < 0) return; // Unable to read battery

        if (level < threshold && !batteryPaused) {
          // Battery dropped below threshold -> pause node
          console.log(`[Battery] Level ${level}% < ${threshold}% threshold, pausing node`);
          pauseNode();
        } else if (level >= threshold && batteryPaused) {
          // Battery recovered above threshold -> resume node
          console.log(`[Battery] Level ${level}% >= ${threshold}% threshold, resuming node`);
          resumeNode();
        }
      } catch (err) {
        console.warn('[Battery] Check failed:', err);
      }
    };

    // Check battery every 30 seconds
    checkBattery();
    batteryCheckRef.current = setInterval(checkBattery, 30000);

    return () => {
      if (batteryCheckRef.current) {
        clearInterval(batteryCheckRef.current);
        batteryCheckRef.current = null;
      }
    };
  }, [screen, batteryPaused]);

  const pauseNode = useCallback(() => {
    setBatteryPaused(true);
    heartbeatService.stop();
    blockObserver.stop();
    microRelay.stop();
    storageCache.stop();
    console.log('[Battery] Node paused due to low battery');
  }, []);

  const resumeNode = useCallback(async () => {
    setBatteryPaused(false);
    const creds = await loadCredentials();
    if (creds) {
      networkAdapter.start();
      heartbeatService.start(creds.apiKey);
      const level = networkAdapter.getContributionLevel();
      if (level.blockObserverEnabled) {
        try {
          await blockObserver.start(creds.apiKey);
          microRelay.start(creds.apiKey);
          await storageCache.start(creds.apiKey);
        } catch (err) {
          console.warn('[Battery] Failed to restart block observer:', err);
        }
      }
    }
    console.log('[Battery] Node resumed after battery recovery');
  }, []);

  const handleOnboardingComplete = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setScreen('register');
  };

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

    // Stop battery monitoring
    if (batteryCheckRef.current) {
      clearInterval(batteryCheckRef.current);
      batteryCheckRef.current = null;
    }
    setBatteryPaused(false);

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

  if (screen === 'onboarding') {
    return <OnboardingScreen onComplete={handleOnboardingComplete} />;
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
    backgroundColor: '#06061a',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
