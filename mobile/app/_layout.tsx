import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import * as Sentry from '@sentry/react-native';
import { logger } from '../utils/logger';

Sentry.init({
  dsn: 'https://b99f587e416bd6510cce46af64b4fbf1@o4510794867671040.ingest.de.sentry.io/4510874270433360',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Prevent the splash screen from auto-hiding
SplashScreen.preventAutoHideAsync();

// ✅ BLOQUEIO GLOBAL DE LOGS
if (__DEV__) {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  const allow = (text: string) =>
    text.includes('📸 [PHOTOS]') ||
    text.includes('☁️ [SYNC]') ||
    text.includes('🧩 [SERVICO]') ||
    text.includes('🏗️ [OBRA]') ||
    text.includes('🗂️ [STORAGE]') ||
    text.includes('🔎 [DEBUG]') ||
    text.includes('⚠️ [WARN]') ||
    text.includes('🔥 [ERROR]');

  console.log = (...args) => {
    const first = String(args[0] ?? '');
    if (allow(first)) originalLog(...args);
  };

  console.warn = (...args) => {
    const first = String(args[0] ?? '');
    if (allow(first)) originalWarn(...args);
  };

  console.error = (...args) => {
    const first = String(args[0] ?? '');
    if (allow(first)) originalError(...args);
  };
}

// NOTA: Sentry é inicializado no index.js (antes de tudo)
export default function RootLayout() {
  useEffect(() => {

    // Hide the splash screen after a minimum delay to ensure visibility
    const hideSplash = async () => {
      // Wait at least 3 seconds before hiding
      await new Promise(resolve => setTimeout(resolve, 3000));
      await SplashScreen.hideAsync();
    };

    hideSplash();
  }, []);

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(comp)" />
      </Stack>
    </ErrorBoundary>
  );
}
