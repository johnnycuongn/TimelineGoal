import { Redirect, useRouter } from 'expo-router';
import { HeartHandshake } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { spacing, useTheme } from '@/theme';

/** First onboarding step: create a new couple, or join a partner's with a code. */
export default function OnboardingHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coupleId } = useCouple();

  // Already paired/created (e.g. relaunch mid-setup) → skip straight to naming.
  if (coupleId) {
    return <Redirect href="/(onboarding)/name-bulldog" />;
  }

  return (
    <Screen center edges={['top', 'bottom']}>
      <HeartHandshake color={colors.primary} size={72} strokeWidth={2} />
      <Text variant="display" style={styles.center}>
        Just the two of you
      </Text>
      <Text variant="body" color="textSecondary" style={styles.center}>
        Start your shared world, or hop into{'\n'}the one your partner already made.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Start our world"
          onPress={() => router.push('/(onboarding)/create')}
        />
        <Button
          label="I have an invite code"
          variant="secondary"
          onPress={() => router.push('/(onboarding)/join')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: spacing.md, marginTop: spacing.lg },
});
