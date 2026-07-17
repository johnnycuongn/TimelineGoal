/**
 * EmptyState — Mochi holding a little sign (see .claude/skills/cuteness:
 * "empty states have character: bulldog holds a sign, never a bare No data").
 * SVG Mochi keeps breathing/blinking via the shared mood store, the sign hangs
 * at a sticker tilt, and there's always a warm next step.
 */

import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Text } from '@/components/text';
import { BulldogView } from '@/features/bulldog/BulldogView';
import { elevation, radius, spacing, useTheme } from '@/theme';

interface EmptyStateProps {
  /** What Mochi's sign says — short, warm, never guilt. */
  message: string;
  /** Optional next step. */
  cta?: string;
  onPress?: () => void;
}

export function EmptyState({ message, cta, onPress }: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <BulldogView size={116} />
      <View
        style={[
          styles.sign,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}>
        <Text variant="bodyLarge" style={styles.signText}>
          {message}
        </Text>
      </View>
      {cta && onPress ? <Button label={cta} onPress={onPress} style={styles.cta} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  sign: {
    maxWidth: 300,
    marginTop: -14, // tucks under Mochi's paws — he's holding it
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    transform: [{ rotate: '-2.5deg' }],
    ...elevation.soft,
  },
  signText: { textAlign: 'center' },
  cta: { marginTop: spacing.xl, alignSelf: 'stretch' },
});
