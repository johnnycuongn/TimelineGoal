/**
 * BulldogView — Mochi the Marshmallow, layered-SVG edition.
 *
 * A puppet of stacked SVG layers (see ./mochi/parts) driven by the mood store and
 * Reanimated springs, per the approved character spec
 * (docs/superpowers/specs/2026-07-11-mochi-bulldog-design.md).
 *
 * idle: breathing + randomized blinks + occasional ear flick
 * happy: whole-pup wiggle + hop, jowls/ears lag a beat behind, ^^ arc eyes + open mouth
 * sleepy: heavy lids, slower breath, drifting zzz — boop to snort awake
 * love: lean + arc eyes + heart pop
 * boop: squish + eye squeeze (pure joy, no mechanics)
 *
 * Reduce Motion → static pose per mood (no loops, no blinks).
 * A Rive artboard can replace these internals later; the interface stays { size }.
 */

import { Heart } from 'lucide-react-native';
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

import { useCouple } from '@/features/couple/CoupleProvider';
import { haptics, spring, useTheme } from '@/theme';
import {
  BackLayer,
  BandanaLayer,
  BodyLayer,
  EyesLayer,
  HappyArcsLayer,
  HeadLayer,
  JowlsLayer,
  MouthLayer,
  OpenMouthLayer,
  SleepyLidsLayer,
  ZzzLayer,
} from './mochi/parts';
import { useBulldogStore } from './store';

interface BulldogViewProps {
  size?: number;
}

export function BulldogView({ size = 120 }: BulldogViewProps) {
  const { colors } = useTheme();
  const { couple } = useCouple();
  const reduceMotion = useReducedMotion();
  const mood = useBulldogStore((s) => s.mood);
  const nonce = useBulldogStore((s) => s.nonce);
  const setIdle = useBulldogStore((s) => s.setIdle);

  // Bandana wears both partners' colors (rose/pink until both have picked).
  const partnerHexes = Object.values(couple?.partnerColors ?? {});
  const colorA = partnerHexes[0] ?? colors.primary;
  const colorB = partnerHexes[1] ?? colors.secondary;

  // ── shared values ────────────────────────────────────────────────
  const breathe = useSharedValue(1); // body scale loop
  const squish = useSharedValue(1); // whole-pup boop squish
  const wiggle = useSharedValue(0); // whole-pup rotate (deg)
  const hop = useSharedValue(0); // whole-pup translateY
  const backLag = useSharedValue(0); // ears+tail lagged rotate (deg)
  const jowlDrop = useSharedValue(0); // jowls lagged translateY
  const eyeScaleY = useSharedValue(1); // blink / boop squeeze
  const pupilShift = useSharedValue(0); // idle pupil drift (translateX)
  const arcsOpacity = useSharedValue(0); // happy ^^ overlay
  const lidsOpacity = useSharedValue(0); // sleepy lids overlay
  const openMouthOpacity = useSharedValue(0);
  const zzzOpacity = useSharedValue(0);
  const zzzDrift = useSharedValue(0);
  const heartOpacity = useSharedValue(0);
  const heartY = useSharedValue(0);

  const sleepy = mood === 'sleepy';

  // ── idle life: breathing loop ────────────────────────────────────
  useEffect(() => {
    if (reduceMotion) {
      breathe.value = 1;
      return;
    }
    const period = sleepy ? 2400 : 1600; // slower breath while asleep
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: period, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: period, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(breathe);
  }, [reduceMotion, sleepy, breathe]);

  // ── idle life: randomized blinks + occasional ear flick + pupil drift ──
  useEffect(() => {
    if (reduceMotion || sleepy) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        // blink (fast lid dip — autonomous micro-motion, not interaction feedback)
        eyeScaleY.value = withSequence(
          withTiming(0.12, { duration: 80 }),
          withTiming(1, { duration: 110 }),
        );
        // every ~3rd blink: ear flick + a pupil drift to a new resting spot
        if (Math.random() < 0.34) {
          backLag.value = withSequence(withSpring(-3, spring.bouncy), withSpring(0, spring.default));
        }
        pupilShift.value = withSpring((Math.random() - 0.5) * 3.5, spring.default);
        schedule();
      }, 3200 + Math.random() * 3000);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [reduceMotion, sleepy, eyeScaleY, backLag, pupilShift]);

  // ── expression overlays follow the mood (crossfades = timing, fades only) ──
  useEffect(() => {
    const happyFace = mood === 'happy' || mood === 'love';
    const fade = (to: number) => withTiming(to, { duration: reduceMotion ? 0 : 160 });
    arcsOpacity.value = fade(happyFace ? 1 : 0);
    openMouthOpacity.value = fade(mood === 'happy' ? 1 : 0);
    lidsOpacity.value = fade(sleepy ? 1 : 0);
    zzzOpacity.value = sleepy ? fade(1) : fade(0);
  }, [mood, sleepy, reduceMotion, arcsOpacity, openMouthOpacity, lidsOpacity, zzzOpacity]);

  // ── zzz drift loop while asleep ──────────────────────────────────
  useEffect(() => {
    if (!sleepy || reduceMotion) {
      zzzDrift.value = 0;
      return;
    }
    zzzDrift.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
    return () => cancelAnimation(zzzDrift);
  }, [sleepy, reduceMotion, zzzDrift]);

  // ── transient mood choreography ──────────────────────────────────
  useEffect(() => {
    if (mood === 'idle' || mood === 'sleepy' || reduceMotion) return;

    if (mood === 'happy') {
      wiggle.value = withSequence(
        withSpring(-8, spring.bouncy),
        withSpring(8, spring.bouncy),
        withSpring(0, spring.default),
      );
      hop.value = withSequence(withSpring(-14, spring.bouncy), withSpring(0, spring.default));
      // soft-body lag: jowls and ears follow a beat behind
      jowlDrop.value = withDelay(
        80,
        withSequence(withSpring(4, spring.bouncy), withSpring(0, spring.default)),
      );
      backLag.value = withDelay(
        60,
        withSequence(withSpring(-4, spring.bouncy), withSpring(4, spring.bouncy), withSpring(0, spring.default)),
      );
    } else if (mood === 'love') {
      wiggle.value = withSequence(withSpring(6, spring.bouncy), withSpring(0, spring.default));
      heartOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withDelay(650, withTiming(0, { duration: 170 })),
      );
      heartY.value = withSequence(
        withTiming(0, { duration: 0 }),
        withSpring(-Math.max(24, size * 0.3), spring.default),
      );
    }

    const t = setTimeout(() => setIdle(), 1100);
    return () => clearTimeout(t);
  }, [mood, nonce, reduceMotion, wiggle, hop, jowlDrop, backLag, heartOpacity, heartY, setIdle, size]);

  // ── boop: squish + eye squeeze; wakes a sleepy pup with a snort ──
  function boop() {
    haptics.tick();
    if (sleepy) {
      // snort awake
      if (!reduceMotion) {
        wiggle.value = withSequence(
          withSpring(-5, spring.press),
          withSpring(5, spring.press),
          withSpring(0, spring.default),
        );
      }
      setIdle();
      return;
    }
    if (reduceMotion) return;
    squish.value = withSequence(withSpring(0.88, spring.press), withSpring(1, spring.bouncy));
    eyeScaleY.value = withSequence(
      withSpring(0.15, spring.press),
      withSpring(1, spring.default),
    );
    jowlDrop.value = withDelay(
      70,
      withSequence(withSpring(3.5, spring.bouncy), withSpring(0, spring.default)),
    );
  }

  // ── animated styles ──────────────────────────────────────────────
  const px = size / 200; // viewBox unit → device px

  const wholeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: hop.value },
      { rotate: `${wiggle.value}deg` },
      { scale: squish.value },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${backLag.value}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));
  // Blink pivots at the eye line (y = 80/200 of the box), not the layer center.
  const eyePivot = -0.1 * size;
  const eyesStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pupilShift.value * px * 2 },
      { translateY: eyePivot },
      { scaleY: eyeScaleY.value },
      { translateY: -eyePivot },
    ],
  }));
  const jowlStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: jowlDrop.value * px * 2 }],
  }));
  const arcsStyle = useAnimatedStyle(() => ({ opacity: arcsOpacity.value }));
  const lidsStyle = useAnimatedStyle(() => ({ opacity: lidsOpacity.value }));
  const openMouthStyle = useAnimatedStyle(() => ({ opacity: openMouthOpacity.value }));
  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzzOpacity.value,
    transform: [{ translateY: zzzDrift.value }],
  }));
  const heartStyle = useAnimatedStyle(() => ({
    opacity: heartOpacity.value,
    transform: [{ translateY: heartY.value }],
  }));

  const layer = StyleSheet.absoluteFill;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Boop the bulldog" onPress={boop}>
      <Animated.View style={[{ width: size, height: size }, wholeStyle]}>
        <Animated.View style={[layer, backStyle]}>
          <BackLayer size={size} />
        </Animated.View>
        <Animated.View style={[layer, bodyStyle]}>
          <BodyLayer size={size} />
        </Animated.View>
        <View style={layer}>
          <HeadLayer size={size} />
        </View>
        <Animated.View style={[layer, jowlStyle]}>
          <JowlsLayer size={size} />
        </Animated.View>
        <Animated.View style={[layer, eyesStyle]}>
          <EyesLayer size={size} />
        </Animated.View>
        <Animated.View style={[layer, arcsStyle]}>
          <HappyArcsLayer size={size} />
        </Animated.View>
        <Animated.View style={[layer, lidsStyle]}>
          <SleepyLidsLayer size={size} />
        </Animated.View>
        <View style={layer}>
          <MouthLayer size={size} />
        </View>
        <Animated.View style={[layer, openMouthStyle]}>
          <OpenMouthLayer size={size} />
        </Animated.View>
        <View style={layer}>
          <BandanaLayer size={size} colorA={colorA} colorB={colorB} />
        </View>
        <Animated.View style={[layer, zzzStyle]}>
          <ZzzLayer size={size} />
        </Animated.View>
        <Animated.View style={[styles.heart, heartStyle]}>
          <Heart
            color={colors.secondary}
            fill={colors.secondary}
            size={Math.max(20, size * 0.24)}
          />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heart: { position: 'absolute', top: 0, alignSelf: 'center', zIndex: 1 },
});
