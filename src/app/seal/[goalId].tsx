/**
 * Seal-the-deal (modal) — the shared-goal commitment ritual.
 *
 * Creating a shared goal lands here with `armed=1`: a 10-second window while the
 * wax is hot. Each partner presses their paw into the wax (sealGoal writes only
 * their key); the moment BOTH are in — on either phone, live via onSnapshot —
 * the stamp slams down, the screen edges glow in both colors, and the bulldog
 * parties. If the window passes, nothing is lost: the goal stays saved, the wax
 * "stays warm", and the other partner can seal from their Den nudge any time.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stamp } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '@/components/button';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBulldogStore } from '@/features/bulldog/store';
import { sealGoal } from '@/features/goals/api';
import { useGoal } from '@/features/goals/hooks';
import { isSealed } from '@/features/goals/ladder';
import { useCouple } from '@/features/couple/CoupleProvider';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, spring, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const WAX_SIZE = 132;
const RING_SIZE = WAX_SIZE + 28;
const RING_STROKE = 5;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;
const WINDOW_MS = 10_000;

export default function SealScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId, couple } = useCouple();
  const params = useLocalSearchParams<{ goalId: string; armed?: string }>();
  const goalId = typeof params.goalId === 'string' ? params.goalId : null;
  const { goal, loading } = useGoal(coupleId, goalId);
  const reduceMotion = useReducedMotion();
  const triggerBulldog = useBulldogStore((s) => s.trigger);

  const [waxWarm, setWaxWarm] = useState(params.armed === '1'); // countdown running
  const busyRef = useRef(false);

  const myUid = user?.uid ?? '';
  const partnerUid = (couple?.members ?? []).find((m) => m !== myUid);
  const myColor = couple?.partnerColors?.[myUid] ?? colors.primary;
  const partnerColor =
    (partnerUid && couple?.partnerColors?.[partnerUid]) || colors.secondary;

  const iSealed = Boolean(goal?.seals?.[myUid]);
  const sealed = goal ? isSealed(goal) : false;

  // ── animation state ────────────────────────────────────────────────
  const waxScale = useSharedValue(1);
  const waxTilt = useSharedValue(0);
  const glow = useSharedValue(0);
  const ringProgress = useSharedValue(1);

  const waxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: waxScale.value }, { rotate: `${waxTilt.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }));
  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - ringProgress.value),
  }));

  // The 10s wax-is-hot window (theatre, not a deadline — expiry only softens copy).
  useEffect(() => {
    if (!waxWarm || sealed) return;
    ringProgress.value = 1;
    ringProgress.value = withTiming(0, { duration: WINDOW_MS, easing: Easing.linear });
    const t = setTimeout(() => setWaxWarm(false), WINDOW_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waxWarm, sealed]);

  // THE SLAM — fires on the live transition to fully-sealed, on both phones.
  const prevSealed = useRef(sealed);
  useEffect(() => {
    if (sealed && !prevSealed.current) {
      haptics.celebration();
      triggerBulldog('party');
      if (!reduceMotion) {
        waxScale.value = withSequence(
          withTiming(1.7, { duration: 0 }),
          withSpring(1, spring.bouncy),
        );
        waxTilt.value = withSequence(withSpring(-7, spring.bouncy), withSpring(0, spring.default));
      }
      glow.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0, { duration: 900 }),
      );
    }
    prevSealed.current = sealed;
  }, [sealed, reduceMotion, waxScale, waxTilt, glow, triggerBulldog]);

  async function pressPaw() {
    if (!coupleId || !goalId || !user || iSealed || busyRef.current) return;
    busyRef.current = true;
    haptics.success(); // seal armed
    if (!reduceMotion) {
      waxScale.value = withSequence(withSpring(0.9, spring.press), withSpring(1, spring.bouncy));
    }
    try {
      await sealGoal(db, { coupleId, goalId, uid: user.uid });
    } finally {
      busyRef.current = false;
    }
  }

  if (loading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <Loading message="Warming the wax…" />
      </Screen>
    );
  }

  if (!goal || !coupleId) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.centerFill}>
          <Text variant="bodyLarge" color="textSecondary" style={styles.center}>
            This pact wandered off 🐾
          </Text>
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const status = sealed
    ? { title: 'Sealed together!', caption: 'this one’s a promise now 💞' }
    : iSealed
      ? { title: 'Your paw is in', caption: 'waiting for your love’s paw… 🐾' }
      : waxWarm
        ? { title: 'Seal the deal', caption: 'press your paw into the wax!' }
        : { title: 'Seal the deal', caption: 'no rush — the wax stays warm 💌' };

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Edge glow in both colors on the slam. */}
      <Animated.View pointerEvents="none" style={[styles.glowLeft, { backgroundColor: myColor }, glowStyle]} />
      <Animated.View pointerEvents="none" style={[styles.glowRight, { backgroundColor: partnerColor }, glowStyle]} />

      <View style={styles.body}>
        <Text variant="title" style={styles.center}>
          {status.title}
        </Text>

        <View style={[styles.goalChip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Text style={styles.charm}>{goal.charm}</Text>
          <Text variant="label" numberOfLines={2} style={styles.goalTitle}>
            {goal.title}
          </Text>
        </View>

        <View style={styles.waxArea}>
          {waxWarm && !sealed ? (
            <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
              <Circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={colors.border}
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                stroke={colors.secondary}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${RING_C} ${RING_C}`}
                animatedProps={ringProps}
                fill="none"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </Svg>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              sealed ? 'Sealed together' : iSealed ? 'Waiting for your partner' : 'Press your paw into the wax'
            }
            disabled={iSealed || sealed}
            onPress={pressPaw}>
            <Animated.View
              style={[
                styles.wax,
                {
                  backgroundColor: sealed ? colors.primary : iSealed ? myColor : colors.primary,
                  // Their side of the rim warms up once your paw is in.
                  borderColor: iSealed && !sealed ? partnerColor : colors.surface,
                },
                waxStyle,
              ]}>
              <Stamp size={52} color={colors.onPrimary} strokeWidth={1.75} />
            </Animated.View>
          </Pressable>
        </View>

        <Text variant="bodyLarge" color="textSecondary" style={styles.center}>
          {status.caption}
        </Text>
        <Text variant="caption" color="textSecondary" style={styles.center}>
          {sealed
            ? 'sealed pacts glow on the Timeline'
            : 'a pact needs both paws — it’s saved either way'}
        </Text>
      </View>

      <View style={styles.footer}>
        <Button
          label={sealed ? 'Back to our world' : iSealed ? 'Done for now' : 'Maybe later'}
          variant={sealed ? 'primary' : 'ghost'}
          onPress={() => router.back()}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '90%',
  },
  charm: { fontSize: 22 },
  goalTitle: { flexShrink: 1 },
  waxArea: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.md,
  },
  wax: {
    width: WAX_SIZE,
    height: WAX_SIZE,
    borderRadius: WAX_SIZE / 2,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 10,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  glowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 10,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  footer: { gap: spacing.xs, paddingTop: spacing.md },
});
