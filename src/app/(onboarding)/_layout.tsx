import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/loading';
import { useSession } from '@/features/session';

/** Onboarding group — reachable only while signed in and not yet fully set up. */
export default function OnboardingLayout() {
  const { status } = useSession();
  if (status === 'loading') return <Loading />;
  if (status === 'signed-out') return <Redirect href="/(auth)/sign-in" />;
  if (status === 'ready') return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
