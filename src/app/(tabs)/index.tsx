import { useRouter } from 'expo-router';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { BulldogView } from '@/features/bulldog/BulldogView';
import { useBulldogStore } from '@/features/bulldog/store';
import { useCouple } from '@/features/couple/CoupleProvider';
import { GoalCard } from '@/features/goals/GoalCard';
import { useWeeklyGoals } from '@/features/goals/hooks';
import { Ticker } from '@/features/goals/Ticker';
import { haptics, radius, spacing, useTheme } from '@/theme';

// Experimental 3D pup — lazy so three.js only evaluates when toggled on.
const Pup3DStage = lazy(() => import('@/features/bulldog/pup3d/Pup3DStage'));

/** The Den — bulldog + today strip + partner ticker. The daily landing. */
export default function DenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coupleId, couple } = useCouple();
  const { goals } = useWeeklyGoals(coupleId);
  const trigger = useBulldogStore((s) => s.trigger);
  const mood = useBulldogStore((s) => s.mood);
  const [show3d, setShow3d] = useState(false);

  const bulldogName = couple?.bulldog.name || 'Your bulldog';
  const paired = (couple?.members.length ?? 1) >= 2;

  // Evening with nothing checked in today → sleepy pup (boop to wake).
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 20 && mood === 'idle') {
      trigger('sleepy');
    }
    // Run once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!coupleId || !couple) return null;

  // Today strip: up to 4 unfinished-first goals to act on now.
  const strip = [...goals]
    .sort((a, b) => Number(a.owner !== 'shared') - Number(b.owner !== 'shared'))
    .slice(0, 4);

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {show3d ? (
            <Suspense fallback={<Loading message="Fetching the 3D pup…" />}>
              <Pup3DStage height={240} />
            </Suspense>
          ) : (
            <BulldogView size={120} />
          )}
          <Text variant="title">{bulldogName}’s Den</Text>
          <Text variant="caption" color="textSecondary">
            {paired ? 'boop the pup · tap a goal to check in' : 'waiting for your partner 🐾'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: show3d }}
            onPress={() => {
              haptics.tick();
              setShow3d((v) => !v);
            }}
            style={[
              styles.betaChip,
              {
                backgroundColor: show3d ? colors.primary : colors.muted,
                borderColor: show3d ? colors.primary : colors.border,
              },
            ]}>
            <Text variant="caption" color={show3d ? 'onPrimary' : 'textSecondary'}>
              {show3d ? '↩ back to Mochi' : '✨ try the 3D pup (beta)'}
            </Text>
          </Pressable>
        </View>

        {strip.length > 0 ? (
          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Today
            </Text>
            <View style={styles.cards}>
              {strip.map((goal) => (
                <GoalCard
                  key={goal.id}
                  coupleId={coupleId}
                  goal={goal}
                  partnerColors={couple.partnerColors}
                />
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text variant="body" color="textSecondary" style={styles.center}>
              Nothing on the list this week yet.
            </Text>
            <Button label="Dream one up" onPress={() => router.push('/new-goal')} />
          </View>
        )}

        <Ticker coupleId={coupleId} partnerColors={couple.partnerColors} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.md },
  betaChip: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  section: { gap: spacing.sm },
  cards: { gap: spacing.md },
  center: { textAlign: 'center' },
});
