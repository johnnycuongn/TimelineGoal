import {
  Fredoka_400Regular,
  Fredoka_500Medium,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
} from '@expo-google-fonts/fredoka';
import {
  Nunito_400Regular,
  Nunito_500Medium,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/features/auth/AuthProvider';
import { CoupleProvider } from '@/features/couple/CoupleProvider';
import { useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

// Known framework noise on every cold boot: expo-router's ContextNavigator gets a
// router-store update from the async initial-URL resolution before its first commit
// (React 19 dev-only warning; component stack is 100% framework frames — verified
// 2026-07-17, unchanged in expo-router 57.0.6). Upstream: expo/expo#35224,
// software-mansion/react-native-screens#2876. Remove once fixed upstream.
// App-code setState-in-render is still caught statically by the React Compiler lint.
LogBox.ignoreLogs([/Can't perform a React state update on a component that hasn't mounted yet/]);

const queryClient = new QueryClient();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fredoka_400Regular,
    Fredoka_500Medium,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CoupleProvider>
              <ThemedStatusBar />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="new-goal" options={{ presentation: 'modal' }} />
                <Stack.Screen name="seal/[goalId]" options={{ presentation: 'modal' }} />
                <Stack.Screen name="new-corner" options={{ presentation: 'modal' }} />
                <Stack.Screen name="corner/[cornerId]" />
              </Stack>
            </CoupleProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}
