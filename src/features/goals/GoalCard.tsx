/**
 * GoalCard — a weekly goal with paw-print progress.
 *
 * Tap the card = check in (stamp the next paw): ink-splat spring + tick haptic,
 * bulldog goes happy, success haptic when the goal completes (per motion-spec).
 * Colors: own goals in your color, partner's in theirs, shared = both (gradient-ish
 * via a two-dot badge until we add a gradient lib).
 */

import { PawPrint } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBulldogStore } from '@/features/bulldog/store';
import { checkIn } from '@/features/goals/api';
import { useCheckIns, type GoalWithId } from '@/features/goals/hooks';
import { db } from '@/lib/firebase';
import { elevation, haptics, pressScale, radius, spacing, spring, useTheme } from '@/theme';

interface GoalCardProps {
  coupleId: string;
  goal: GoalWithId;
  /** partnerColors from the couple doc, keyed by uid. */
  partnerColors: Record<string, string>;
  onLongPress?: () => void;
}

export function GoalCard({ coupleId, goal, partnerColors, onLongPress }: GoalCardProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { checkIns } = useCheckIns(coupleId, goal.id);
  const triggerBulldog = useBulldogStore((s) => s.trigger);
  const busyRef = useRef(false);

  const done = checkIns.length;
  const complete = done >= goal.targetUnits;

  const cardScale = useSharedValue(1);
  const stampScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: cardScale.value }] }));
  const stampStyle = useAnimatedStyle(() => ({ transform: [{ scale: stampScale.value }] }));

  // Ink-splat when a paw actually fills (synced to data, so partner check-ins splat too).
  const prevDone = useRef(done);
  useEffect(() => {
    if (done > prevDone.current) {
      stampScale.value = withSequence(withSpring(1.5, spring.bouncy), withSpring(1, spring.default));
    }
    prevDone.current = done;
  }, [done, stampScale]);

  const isShared = goal.owner === 'shared';
  const accent = isShared
    ? colors.primary
    : (partnerColors[goal.owner] ?? colors.primary);

  async function handleCheckIn() {
    if (!user || complete || busyRef.current) return;
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
      triggerBulldog('happy');
      if (done + 1 >= goal.targetUnits) {
        haptics.success();
      }
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${goal.title}: ${done} of ${goal.targetUnits} done. Tap to check in.`}
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
            borderColor: complete ? accent : colors.border,
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
              {complete ? ' · done! 🎉' : ''}
            </Text>
          </View>
          {isShared ? (
            <View style={styles.sharedBadge}>
              {Object.values(partnerColors)
                .slice(0, 2)
                .map((c, i) => (
                  <View key={i} style={[styles.sharedDot, { backgroundColor: c }]} />
                ))}
            </View>
          ) : (
            <View style={[styles.ownerDot, { backgroundColor: accent }]} />
          )}
        </View>

        <View style={styles.paws}>
          {Array.from({ length: goal.targetUnits }, (_, i) => {
            const stamped = i < done;
            const isLatest = i === done - 1; // the paw that just filled carries the splat
            const paw = (
              <PawPrint
                color={stamped ? accent : colors.border}
                fill={stamped ? accent : 'transparent'}
                size={26}
                strokeWidth={2}
              />
            );
            return (
              <View key={i}>
                {isLatest ? <Animated.View style={stampStyle}>{paw}</Animated.View> : paw}
              </View>
            );
          })}
        </View>
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
  sharedBadge: { flexDirection: 'row' },
  sharedDot: { width: 14, height: 14, borderRadius: 999, marginLeft: -4 },
  paws: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
