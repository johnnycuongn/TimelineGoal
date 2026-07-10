import { ActivityIndicator } from 'react-native';

import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useTheme } from '@/theme';

/** Warm full-screen loading state (used while the session resolves). */
export function Loading({ message = 'One sec…' }: { message?: string }) {
  const { colors } = useTheme();
  return (
    <Screen center edges={['top', 'bottom']}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="body" color="textSecondary">
        {message}
      </Text>
    </Screen>
  );
}
