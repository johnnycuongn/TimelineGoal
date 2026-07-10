/**
 * BulldogView — the couple's mascot, placeholder edition.
 *
 * Expo Go can't load Rive (native module), so this renders the bulldog as a Lucide
 * glyph driven by the SAME mood store the Rive artboard will consume. When we cut a
 * dev build, this file swaps its internals for the Rive state machine — no screen changes.
 *
 * Motion (per motion-spec): idle = slow breathing loop · happy = wiggle+jump spring ·
 * love = lean + heart pop · sleepy = slumped + slow breath · boop (poke) = squish spring.
 * All transient moods return to idle. Reduce Motion → static glyph, no loops.
 */

import { Dog, Heart, MoonStar } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics, spring, useTheme } from '@/theme';
import { useBulldogStore } from './store';

interface BulldogViewProps {
  size?: number;
}

export function BulldogView({ size = 120 }: BulldogViewProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  const breathe = useSharedValue(1);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0);
  const bounceY = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartY = useSharedValue(0);

  // Idle breathing loop (the bulldog is alive). One focal animation — this is it.
  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, breathe]);

  // Transient mood choreography.
  useEffect(() => {
    if (mood === 'idle' || reduceMotion) return;

    if (mood === 'happy') {
      // Wiggle + a happy hop, then settle back to idle.
      rotate.value = withSequence(
        withSpring(-8, spring.bouncy),
        withSpring(8, spring.bouncy),
        withSpring(0, spring.default),
      );
      bounceY.value = withSequence(
        withSpring(-14, spring.bouncy),
        withSpring(0, spring.default),
      );
    } else if (mood === 'love') {
      // Lean in and pop a heart.
      rotate.value = withSequence(withSpring(6, spring.bouncy), withSpring(0, spring.default));
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(650, withTiming(0, { duration: 170 })),
      );
      heartY.value = withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(-Math.max(28, size * 0.4), spring.default),
      );
    }

    const t = setTimeout(() => setIdle(), 1100);
    return () => clearTimeout(t);
    // nonce retriggers the same mood
  }, [mood, nonce, reduceMotion, rotate, bounceY, heartOpacity, heartY, setIdle, size]);

  function boop() {
    // Free-play squish — pure joy, no mechanics attached.
    haptics.tick();
    if (reduceMotion) return;
    scale.value = withSequence(withSpring(0.88, spring.press), withSpring(1, spring.bouncy));
  }

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: breathe.value * scale.value },
      { rotate: `${rotate.value}deg` },
      { translateY: bounceY.value },
    ],
  }));
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ translateY: heartY.value }],
  }));

  const sleepy = mood === 'sleepy';

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Boop the bulldog" onPress={boop}>
      <View style={styles.stage}>
        <Animated.View style={[styles.heart, heartStyle]}>
          <Heart color={colors.secondary} fill={colors.secondary} size={Math.max(20, size * 0.24)} />
        </Animated.View>
        <Animated.View style={bodyStyle}>
          <Dog
            color={colors.primary}
            size={size}
            strokeWidth={2}
            opacity={sleepy ? 0.75 : 1}
          />
        </Animated.View>
        {sleepy ? (
          <View style={styles.moon}>
            <MoonStar color={colors.textSecondary} size={Math.max(16, size * 0.2)} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center' },
  heart: { position: 'absolute', top: 0, zIndex: 1 },
  moon: { position: 'absolute', top: -4, right: -8 },
});
