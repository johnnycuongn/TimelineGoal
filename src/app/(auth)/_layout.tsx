import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/loading';
import { routeForStatus, useSession } from '@/features/session';

/** Auth group — only reachable when signed out. */
export default function AuthLayout() {
  const { status } = useSession();
  if (status === 'loading') return <Loading />;
  if (status !== 'signed-out') return <Redirect href={routeForStatus[status]} />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
