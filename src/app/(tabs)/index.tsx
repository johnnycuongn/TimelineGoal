import { useFocusEffect, useRouter } from 'expo-router';
import { Stamp } from 'lucide-react-native';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { BulldogView } from '@/features/bulldog/BulldogView';
import { useBulldogStore } from '@/features/bulldog/store';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { GoalCard } from '@/features/goals/GoalCard';
import { useActivity, useAllGoals } from '@/features/goals/hooks';
import {
  completedWeeks,
  goalsForPeriod,
  isSealed,
  pendingSeals,
  weeklyPulse,
  weeklyStreak,
} from '@/features/goals/ladder';
import { quarterPeriod, weekPeriod, yearPeriod } from '@/features/goals/period';
import { PulseRing } from '@/features/goals/PulseRing';
import { StreakDoodles } from '@/features/goals/StreakDoodles';
import { Ticker } from '@/features/goals/Ticker';
import { haptics, radius, spacing, useTheme } from '@/theme';

// Experimental 3D pup — lazy so three.js only evaluates when toggled on.
// Currently the realistic CC-BY bulldog puppy (docs/design/frenchie-3d-design.md);
// swap back to './Pup3DStage' for the stylized animated shiba.
const Pup3DStage = lazy(() => import('@/features/bulldog/pup3d/RealisticPupStage'));

const QUIET_DAYS_FOR_POUT = 3;

/** The Den — bulldog + weekly pulse + today strip + partner ticker. The daily landing. */
export default function DenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId, couple } = useCouple();
  const { goals } = useAllGoals(coupleId);
  const { items: activity } = useActivity(coupleId, 5);
  const trigger = useBulldogStore((s) => s.trigger);
  const mood = useBulldogStore((s) => s.mood);
  const [show3d, setShow3d] = useState(false);

  const bulldogName = couple?.bulldog.name || 'Your bulldog';
  const paired = (couple?.members.length ?? 1) >= 2;
  const thisWeek = weekPeriod();

  // Quiet couple → pout (both partners, 3+ days — a face, never a message).
  // Otherwise: evening with nothing happening → sleepy. Boop fixes either.
  useEffect(() => {
    if (mood !== 'idle') return;
    const latest =
      activity[0]?.at?.toMillis?.() ?? couple?.createdAt?.toMillis?.() ?? Date.now();
    const quietDays = (Date.now() - latest) / 86_400_000;
    if (quietDays >= QUIET_DAYS_FOR_POUT) {
      trigger('pout');
    } else if (new Date().getHours() >= 20) {
      trigger('sleepy');
    }
    // React to activity arriving, not to every mood flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity]);

  // A shared goal getting its second paw while we're HERE → party on this phone
  // too (the seal screen handles its own slam; focus check = exactly one party).
  const focusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );
  const sealedSeen = useRef(new Map<string, boolean>());
  useEffect(() => {
    for (const g of goals) {
      if (g.owner !== 'shared') continue;
      const was = sealedSeen.current.get(g.id);
      const now = isSealed(g);
      if (was === false && now && focusedRef.current) {
        haptics.celebration();
        trigger('party');
      }
      sealedSeen.current.set(g.id, now);
    }
  }, [goals, trigger]);

  if (!coupleId || !couple) return null;

  const weeklyGoals = goalsForPeriod(goals, 'week', thisWeek);
  const strip = weeklyGoals.slice(0, 4);

  // Weekly pulse: both partners fill the ring from opposite ends.
  const pulse = weeklyPulse(goals, thisWeek, couple.members);
  const [uidA, uidB] = couple.members;
  const fractionOf = (uid?: string) =>
    pulse.targetTotal > 0 && uid ? (pulse.byUid[uid] ?? 0) / pulse.targetTotal : 0;

  // Streak doodles on the den wall.
  const streak = weeklyStreak(completedWeeks(goals), thisWeek);

  // Shared pacts still waiting for MY paw in the wax.
  const needsSeal = user
    ? pendingSeals(goals, user.uid, [thisWeek, quarterPeriod(), yearPeriod()])
    : [];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {show3d ? (
            <Suspense fallback={<Loading message="Fetching the 3D pup…" />}>
              <Pup3DStage height={240} />
            </Suspense>
          ) : (
            <View style={styles.pupWall}>
              <StreakDoodles streak={streak} size={130} />
              <PulseRing
                size={164}
                fractionA={fractionOf(uidA)}
                fractionB={fractionOf(uidB)}
                colorA={couple.partnerColors[uidA] ?? colors.primary}
                colorB={(uidB && couple.partnerColors[uidB]) || colors.secondary}>
                <BulldogView size={118} />
              </PulseRing>
            </View>
          )}
          <Text variant="title">{bulldogName}’s Den</Text>
          <Text variant="caption" color="textSecondary">
            {paired ? 'boop the pup · tap a goal to check in' : 'waiting for your partner 🐾'}
          </Text>
          {streak >= 2 ? (
            <Text variant="caption" color="textSecondary">
              {streak} weeks of doodles on the wall 🖍️
            </Text>
          ) : null}
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

        {needsSeal.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Seal ${needsSeal[0].title}`}
            onPress={() => {
              haptics.tick();
              router.push(`/seal/${needsSeal[0].id}`);
            }}
            style={[styles.sealNudge, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Stamp size={22} color={colors.primary} />
            <View style={styles.sealNudgeText}>
              <Text variant="label" numberOfLines={1}>
                “{needsSeal[0].title}” is waiting for your paw
              </Text>
              <Text variant="caption" color="textSecondary">
                a pact needs both seals 💌
              </Text>
            </View>
          </Pressable>
        ) : null}

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
  pupWall: { alignItems: 'center', justifyContent: 'center' },
  betaChip: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sealNudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
  },
  sealNudgeText: { flex: 1, gap: 2 },
  section: { gap: spacing.sm },
  cards: { gap: spacing.md },
  center: { textAlign: 'center' },
});
