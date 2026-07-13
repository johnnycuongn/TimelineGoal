/**
 * ConfettiBurst — lightweight Reanimated particles for `party` moments
 * (motion-spec: "confetti = lightweight Reanimated particles, no heavy lib").
 *
 * A dozen flecks pop from the center, arc under pretend-gravity, spin and fade.
 * Whether a burst is live is DERIVED (nonce ≠ last expired nonce); a timer only
 * marks expiry afterwards. Fleck shapes are seeded from the nonce so render
 * stays pure. Renders nothing under Reduce Motion (the law: confetti off).
 */

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

// Celebration palette — decorative art constants (like Mochi's coat), not UI tokens.
const FLECK_COLORS = ['#BE185D', '#EC4899', '#F59E0B', '#0D9488', '#8B5CF6', '#F472B6'];
const FLECK_COUNT = 12;
const DURATION = 1000;

interface Fleck {
  color: string;
  w: number;
  h: number;
  vx: number; // horizontal reach, px
  up: number; // arc height, px
  fall: number; // extra drop past the start line, px
  spin: number; // total rotation, deg
}

/** Deterministic 0..1 "randomness" — pure, so bursts can be built during render. */
function rand(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function makeFlecks(seed: number, spread: number): Fleck[] {
  return Array.from({ length: FLECK_COUNT }, (_, i) => {
    const side = i % 2 === 0 ? 1 : -1;
    const r = (k: number) => rand(seed * 31 + i * 7 + k);
    return {
      color: FLECK_COLORS[i % FLECK_COLORS.length],
      w: 5 + r(1) * 4,
      h: 5 + r(2) * 4,
      vx: side * (spread * 0.25 + r(3) * spread * 0.55),
      up: spread * 0.35 + r(4) * spread * 0.45,
      fall: spread * 0.2 + r(5) * spread * 0.3,
      spin: side * (180 + r(6) * 360),
    };
  });
}

function FleckView({ fleck }: { fleck: Fleck }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.quad) });
  }, [t]);

  const style = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      transform: [
        { translateX: fleck.vx * p },
        // Parabolic arc (peaks mid-flight), plus a drop past the launch line.
        { translateY: -fleck.up * 4 * p * (1 - p) + fleck.fall * p * p },
        { rotate: `${fleck.spin * p}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.fleck,
        { backgroundColor: fleck.color, width: fleck.w, height: fleck.h },
        style,
      ]}
    />
  );
}

interface ConfettiBurstProps {
  /** Bump to fire a new burst; 0 = never fired. */
  nonce: number;
  /** Roughly how far flecks travel (≈ the bulldog's size). */
  spread?: number;
}

export function ConfettiBurst({ nonce, spread = 120 }: ConfettiBurstProps) {
  const reduceMotion = useReducedMotion();
  const [expiredNonce, setExpiredNonce] = useState(0);
  const active = nonce !== 0 && nonce !== expiredNonce && !reduceMotion;

  // Only the EXPIRY is state — set asynchronously once the burst has played out.
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setExpiredNonce(nonce), DURATION + 100);
    return () => clearTimeout(t);
  }, [active, nonce]);

  const flecks = useMemo(
    () => (active ? makeFlecks(nonce, spread) : []),
    [active, nonce, spread],
  );

  if (!active) return null;
  return (
    <View pointerEvents="none" style={styles.stage}>
      {flecks.map((f, i) => (
        <FleckView key={`${nonce}-${i}`} fleck={f} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  fleck: { position: 'absolute', borderRadius: 2 },
});
