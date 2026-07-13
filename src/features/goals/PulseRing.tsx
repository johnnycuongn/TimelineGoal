/**
 * PulseRing — the weekly pulse around the bulldog.
 *
 * Both partners fill one ring from opposite ends: partner A clockwise from the
 * top, partner B counter-clockwise — a full week closes the loop where the two
 * colors MEET (couple-growth: colors combine, never compete; there is no "whose
 * side is bigger" readout, just one shared circle warming up).
 *
 * Fill animates with springs (reduce-motion → quick fade-style timing).
 */

import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import Svg, { Circle } from 'react-native-svg';

import { reducedMotionFadeMs, spring, useTheme } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface PulseRingProps {
  /** Outer diameter of the ring. */
  size: number;
  strokeWidth?: number;
  /** Each partner's filled fraction of the whole ring (0..1; combined ≤ 1). */
  fractionA: number;
  fractionB: number;
  colorA: string;
  colorB: string;
  /** Sits in the middle of the ring (the bulldog). */
  children?: React.ReactNode;
}

export function PulseRing({
  size,
  strokeWidth = 6,
  fractionA,
  fractionB,
  colorA,
  colorB,
  children,
}: PulseRingProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  const fa = useSharedValue(fractionA);
  const fb = useSharedValue(fractionB);
  useEffect(() => {
    fa.value = reduceMotion
      ? withTiming(fractionA, { duration: reducedMotionFadeMs })
      : withSpring(fractionA, spring.default);
    fb.value = reduceMotion
      ? withTiming(fractionB, { duration: reducedMotionFadeMs })
      : withSpring(fractionB, spring.default);
  }, [fractionA, fractionB, reduceMotion, fa, fb]);

  // Never overlap even mid-spring: B yields to whatever A hasn't reached.
  const fbClamped = useDerivedValue(() => Math.min(fb.value, Math.max(0, 1 - fa.value)));

  const propsA = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - Math.min(fa.value, 1)),
    strokeOpacity: fa.value > 0.004 ? 1 : 0,
  }));
  const propsB = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - fbClamped.value),
    strokeOpacity: fbClamped.value > 0.004 ? 1 : 0,
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={cx} cy={cx} r={r} stroke={colors.border} strokeWidth={strokeWidth} fill="none" />
        {/* A: clockwise from 12 o'clock. */}
        <AnimatedCircle
          cx={cx}
          cy={cx}
          r={r}
          stroke={colorA}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={propsA}
          fill="none"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        {/* B: counter-clockwise from 12 o'clock (mirrored). */}
        <AnimatedCircle
          cx={cx}
          cy={cx}
          r={r}
          stroke={colorB}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          animatedProps={propsB}
          fill="none"
          transform={`translate(${size} 0) scale(-1 1) rotate(-90 ${cx} ${cx})`}
        />
      </Svg>
      {children}
    </View>
  );
}
