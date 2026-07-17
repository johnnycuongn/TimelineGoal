/**
 * Inside a corner — tinted cover header with scattered charms; the scrapbook
 * pin area and chat land next in M4 (items 2–3).
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { tintColor } from '@/features/corners/api';
import { useCorner } from '@/features/corners/hooks';
import { haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

export default function CornerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { cornerId } = useLocalSearchParams<{ cornerId: string }>();
  const { coupleId } = useCouple();
  const { corner, loading } = useCorner(coupleId, cornerId ?? null);

  if (loading) {
    return <Loading message="Opening the corner…" />;
  }
  if (!corner) {
    return (
      <Screen center>
        <Text variant="title">This corner has been tidied away</Text>
        <Text variant="body" color="textSecondary">
          It may have been closed from the other phone.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']} style={styles.noPad}>
      <View
        style={[
          styles.cover,
          { backgroundColor: tintColor(corner.tint, isDark ? 'dark' : 'light') },
        ]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to all corners"
          onPress={() => {
            haptics.tick();
            router.back();
          }}
          style={[styles.backBtn, { backgroundColor: colors.surface }]}>
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <View style={styles.charmRow}>
          {corner.charms.map((c, i) => (
            <Text key={`${c}-${i}`} style={[styles.charm, { transform: [{ rotate: i % 2 ? '6deg' : '-6deg' }] }]}>
              {c}
            </Text>
          ))}
        </View>
        <Text variant="title" style={styles.title}>
          {corner.title}
        </Text>
      </View>

      <View style={styles.body}>
        <Text variant="body" color="textSecondary" style={styles.placeholder}>
          Pins and chat move in here next 🛠️🐾
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  noPad: { paddingHorizontal: 0, paddingTop: 0 },
  cover: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.sm,
  },
  backBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charmRow: { flexDirection: 'row', gap: spacing.sm },
  charm: { fontSize: 30 },
  title: { paddingTop: spacing.xs },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  placeholder: { textAlign: 'center' },
});
