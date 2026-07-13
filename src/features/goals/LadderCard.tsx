/**
 * LadderCard — a quarterly/yearly goal with its ladder of children.
 *
 * The bar fills from the rollup (direct check-ins + each child's completion
 * fraction — see ./ladder). When progress lands, a little paw pops up off the
 * bar's tip and the bar bumps (the "ladder nudge"). Children are listed as
 * climbing paw rows. Completing a big goal = `proud` bulldog + celebration
 * haptic (motion-spec state machine). Shared goals wear their wax-seal badge;
 * an unsealed one shows "seal pending" and the badge opens the seal screen.
 *
 * Tap = direct check-in (one unit), same feel as the week cards.
 */

import { PawPrint, Stamp } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBulldogStore } from '@/features/bulldog/store';
import { checkIn } from '@/features/goals/api';
import { type GoalWithId } from '@/features/goals/hooks';
import { childUnits, goalDone, isSealed, rollup } from '@/features/goals/ladder';
import { db } from '@/lib/firebase';
import { elevation, haptics, pressScale, radius, spacing, spring, useTheme } from '@/theme';

interface LadderCardProps {
  coupleId: string;
  goal: GoalWithId;
  /** Every goal in the couple's world — the rollup finds its own children. */
  allGoals: GoalWithId[];
  partnerColors: Record<string, string>;
  onSealPress?: () => void;
  onLongPress?: () => void;
}

/** "2" or "2.5" — fractional child-units earn half-paws on the big bar. */
function formatUnits(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function LadderCard({
  coupleId,
  goal,
  allGoals,
  partnerColors,
  onSealPress,
  onLongPress,
}: LadderCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const triggerBulldog = useBulldogStore((s) => s.trigger);
  const busyRef = useRef(false);

  const r = rollup(goal, allGoals);
  const isShared = goal.owner === 'shared';
  const accent = isShared ? colors.primary : (partnerColors[goal.owner] ?? colors.primary);
  const sealed = isSealed(goal);

  const cardScale = useSharedValue(1);
  const fill = useSharedValue(r.fraction);
  const barBump = useSharedValue(1);
  const pawPop = useSharedValue(0);
  const pawOpacity = useSharedValue(0);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: fill.value }, { scaleY: barBump.value }],
  }));
  const pawStyle = useAnimatedStyle(() => ({
    opacity: pawOpacity.value,
    // Rides the tip of the fill; springs upward when progress lands.
    left: `${Math.min(fill.value, 1) * 100}%`,
    transform: [{ translateY: pawPop.value }, { translateX: -9 }],
  }));

  // Ladder nudge, synced to DATA — a weekly check-in from either phone (or a
  // direct check-in here) springs the bar and pops a paw off its tip.
  const prevDone = useRef(r.done);
  const prevComplete = useRef(r.complete);
  useEffect(() => {
    if (r.done > prevDone.current + 1e-9) {
      if (reduceMotion) {
        fill.value = r.fraction;
      } else {
        fill.value = withSpring(r.fraction, spring.default);
        barBump.value = withSequence(withSpring(1.35, spring.bouncy), withSpring(1, spring.default));
        pawPop.value = 0;
        pawPop.value = withSpring(-18, spring.bouncy);
        pawOpacity.value = withSequence(
          withTiming(1, { duration: 120 }),
          withDelay(420, withTiming(0, { duration: 170 })),
        );
      }
    } else if (r.done < prevDone.current) {
      fill.value = r.fraction; // e.g. a child goal was deleted — settle quietly
    }
    prevDone.current = r.done;

    // Big-goal completion (from either partner, any screen feeding it) → proud.
    if (r.complete && !prevComplete.current) {
      haptics.celebration();
      triggerBulldog('proud');
    }
    prevComplete.current = r.complete;
  }, [r.done, r.fraction, r.complete, reduceMotion, fill, barBump, pawPop, pawOpacity, triggerBulldog]);

  async function handleCheckIn() {
    if (!user || r.complete || busyRef.current) return;
    busyRef.current = true;
    haptics.tick();
    try {
      await checkIn(db, {
        coupleId,
        uid: user.uid,
        goalId: goal.id,
        goalTitle: goal.title,
        charm: goal.charm,
      });
      // The data-synced effect above animates + handles completion (proud).
      if (!(r.done + 1 >= goal.targetUnits)) {
        haptics.success();
        triggerBulldog('happy');
      }
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.title}: ${formatUnits(r.done)} of ${goal.targetUnits} done. Tap to check in.`}
      onPressIn={() => {
        cardScale.value = withSpring(pressScale, spring.press);
      }}
      onPressOut={() => {
        cardScale.value = withSpring(1, spring.press);
      }}
      onPress={handleCheckIn}
      onLongPress={onLongPress}>
      <Animated.View
        style={[
          styles.card,
          elevation.soft,
          {
            backgroundColor: colors.surface,
            borderColor: r.complete ? accent : colors.border,
          },
          cardStyle,
        ]}>
        <View style={styles.header}>
          <Text variant="bodyLarge" style={styles.charm}>
            {goal.charm}
          </Text>
          <View style={styles.titleWrap}>
            <Text variant="label" numberOfLines={1}>
              {goal.title}
            </Text>
            <Text variant="caption" color="textSecondary">
              {isShared ? 'together' : goal.owner === user?.uid ? 'you' : 'your partner'}
              {r.complete ? ' · we made it! 🎉' : ''}
            </Text>
          </View>
          {isShared ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={sealed ? 'Sealed together' : 'Seal pending — open the wax'}
              hitSlop={10}
              onPress={sealed ? undefined : onSealPress}
              style={[
                styles.sealBadge,
                sealed
                  ? { backgroundColor: colors.primary, borderColor: colors.primary }
                  : { backgroundColor: colors.muted, borderColor: colors.border },
              ]}>
              <Stamp size={16} color={sealed ? colors.onPrimary : colors.textSecondary} />
            </Pressable>
          ) : (
            <View style={[styles.ownerDot, { backgroundColor: accent }]} />
          )}
        </View>

        {/* The big bar. Fill scales from the left (transform-only animation). */}
        <View style={styles.barRow}>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <Animated.View
              style={[styles.fill, { backgroundColor: accent }, fillStyle]}
            />
            <Animated.View pointerEvents="none" style={[styles.tipPaw, pawStyle]}>
              <PawPrint color={accent} fill={accent} size={16} />
            </Animated.View>
          </View>
          <Text variant="caption" color="textSecondary" style={styles.barLabel}>
            {formatUnits(r.done)} / {goal.targetUnits} 🐾
          </Text>
        </View>

        {isShared && !sealed ? (
          <Text variant="caption" color="textSecondary">
            seal pending — the wax is still warm 💌
          </Text>
        ) : null}

        {r.children.length > 0 ? (
          <View style={styles.children}>
            {r.children.map((child) => {
              const c = child as GoalWithId;
              const frac = childUnits(c);
              return (
                <View key={c.id} style={styles.childRow}>
                  <Text style={styles.childCharm}>{c.charm}</Text>
                  <View style={styles.childBody}>
                    <Text variant="caption" numberOfLines={1}>
                      {c.title}
                    </Text>
                    <View style={[styles.childTrack, { backgroundColor: colors.muted }]}>
                      <View
                        style={[
                          styles.childFill,
                          { backgroundColor: accent, width: `${frac * 100}%` },
                        ]}
                      />
                    </View>
                  </View>
                  <Text variant="caption" color="textSecondary">
                    {goalDone(c)}/{c.targetUnits}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : (
          <Text variant="caption" color="textSecondary">
            no weekly steps feed this yet — link one when you add a goal 🪜
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  charm: { fontSize: 24 },
  titleWrap: { flex: 1, gap: 2 },
  ownerDot: { width: 14, height: 14, borderRadius: 999 },
  sealBadge: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 999,
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    transformOrigin: 'left center',
  },
  tipPaw: { position: 'absolute', top: -4 },
  barLabel: { minWidth: 64, textAlign: 'right' },
  children: { gap: spacing.sm },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  childCharm: { fontSize: 16 },
  childBody: { flex: 1, gap: 3 },
  childTrack: { height: 5, borderRadius: 999, overflow: 'hidden' },
  childFill: { height: '100%', borderRadius: 999 },
});
