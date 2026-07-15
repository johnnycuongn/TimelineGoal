import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import RealisticPupStage from '@/features/bulldog/pup3d/RealisticPupStage';
import { useBulldogStore } from '@/features/bulldog/store';
import { haptics, radius, spacing, useTheme } from '@/theme';

/**
 * DEV-ONLY test harness for the realistic 3D pup — reachable without auth via:
 *   exp://<host>:8081/--/frenchie-test
 * Emotion chips drive the same shared mood store the real app uses (check-ins →
 * happy, quiet days → pout), so this is a faithful preview of in-app behavior.
 * Remove before ship (M5), together with /pup3d-test.
 */
export default function FrenchieTestScreen() {
  const { colors } = useTheme();
  const trigger = useBulldogStore((s) => s.trigger);
  const setIdle = useBulldogStore((s) => s.setIdle);
  const mood = useBulldogStore((s) => s.mood);

  const chips = [
    { label: 'happy', active: mood === 'happy' || mood === 'party', onPress: () => trigger('happy') },
    { label: 'sad', active: mood === 'pout', onPress: () => trigger('pout') },
    { label: 'neutral', active: mood === 'idle', onPress: setIdle },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text variant="title" style={styles.title}>
        realistic pup test rig
      </Text>
      <RealisticPupStage height={420} />
      <View style={styles.row}>
        {chips.map((c) => (
          <Pressable
            key={c.label}
            accessibilityRole="button"
            accessibilityState={{ selected: c.active }}
            onPress={() => {
              haptics.tick();
              c.onPress();
            }}
            style={[
              styles.chip,
              {
                backgroundColor: c.active ? colors.primary : colors.muted,
                borderColor: c.active ? colors.primary : colors.border,
              },
            ]}>
            <Text variant="caption" color={c.active ? 'onPrimary' : 'textSecondary'}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  title: { textAlign: 'center', paddingBottom: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  chip: {
    minHeight: 44,
    minWidth: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
});
