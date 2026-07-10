import { Redirect } from 'expo-router';

import { Loading } from '@/components/loading';
import { routeForStatus, useSession } from '@/features/session';

/** Entry route: sends the user to the right group once the session resolves. */
export default function Index() {
  const { status } = useSession();
  if (status === 'loading') {
    return <Loading message="Warming up the den…" />;
  }
  return <Redirect href={routeForStatus[status]} />;
}
