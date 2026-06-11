import { Stack, useRouter, useSegments } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AudioModule } from 'expo-audio';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { supabase } from '@/client/supabase';
import { TradeStoreProvider } from '@/lib/tradeStore';
import { AuthProvider, useAuth } from '@/lib/authContext';
import { LanguageProvider } from '@/lib/langContext';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import '../global.css';

// ── Native splash hold: call immediately at module load so custom animation plays ──
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {
    // Already hidden or unsupported — ignore
  });
}

// ── Request microphone + notification permissions on first app launch ──
async function requestAppPermissions() {
  try {
    // Microphone — needed for voice-to-text in AI chat
    await AudioModule.requestRecordingPermissionsAsync();
  } catch {
    // Permission denied or unavailable — handled per-feature
  }

  try {
    // Notifications — only prompt on iOS/Android (web has no native push)
    if (Platform.OS !== 'web') {
      await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }
  } catch {
    // Permission denied — app works without notifications
  }
}

// Route guards: redirect based on auth state
function AuthRedirect() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === '(auth)';
    // If logged in and on auth screen → go to tabs
    if (session && inAuth) {
      router.replace('/(tabs)');
      return;
    }
    // If NOT logged in and on a protected screen → go to sign-in
    if (!session && !inAuth) {
      router.replace('/(auth)/sign-in');
    }
  }, [session, isLoading, segments, router]);

  return null;
}

function RootLayoutNav() {
  const { isLoading, session } = useAuth();
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);
  const [appReady, setAppReady] = useState(false);

  // Request permissions once when the app first mounts
  useEffect(() => {
    requestAppPermissions();
  }, []);

  // Track when auth and stores are fully ready
  useEffect(() => {
    if (!isLoading) {
      setAppReady(true);
    }
  }, [isLoading]);

  const handleSplashComplete = useCallback(async () => {
    setShowSplash(false);
    if (Platform.OS !== 'web') {
      try {
        await SplashScreen.hideAsync();
      } catch {
        // Ignore on platforms where native splash isn't available
      }
    }
  }, []);

  // Show animated splash on first launch; auth loads in background
  if (showSplash) {
    return <AnimatedSplashScreen onComplete={handleSplashComplete} />;
  }

  // Keep showing blank until app is fully ready to prevent jank
  if (!appReady) return null;

  return (
    <>
      <AuthRedirect />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          contentStyle: { backgroundColor: '#000' },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="about" />
      </Stack>
      <PortalHost />
    </>
  );
}

const RootLayout: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LanguageProvider>
        <TradeStoreProvider>
          <AuthProvider>
            <RootLayoutNav />
          </AuthProvider>
        </TradeStoreProvider>
      </LanguageProvider>
    </GestureHandlerRootView>
  );
};

export default RootLayout;
