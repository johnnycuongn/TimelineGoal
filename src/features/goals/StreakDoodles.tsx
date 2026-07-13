/**
 * StreakDoodles — consecutive completed weeks draw doodles on the den wall.
 * History becomes decor (couple-growth: story, not metric): hearts, bones and
 * stars accumulate softly behind the bulldog, one per streak week.
 *
 * Positions are deterministic (golden-angle spiral) so the wall doesn't
 * reshuffle between renders. No streak = an empty wall, never a message.
 */

import { Bone, Heart, PawPrint, Star } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { staggerMs, useTheme } from '@/theme';

const DOODLES = [Heart, Bone, Star, PawPrint];
const MAX_SHOWN = 10;
const GOLDEN_ANGLE = 2.399963;

interface StreakDoodlesProps {
  /** Consecutive completed weeks. */
  streak: number;
  /** Width/height of the wall area the doodles scatter across. */
  size: number;
}

export function StreakDoodles({ streak, size }: StreakDoodlesProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const n = Math.min(streak, MAX_SHOWN);
  if (n <= 0) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wall]}>
      {Array.from({ length: n }, (_, i) => {
        const Doodle = DOODLES[i % DOODLES.length];
        // Deterministic spiral outward from the center — older doodles sit closer in.
        const angle = i * GOLDEN_ANGLE + 0.8;
        const radius = size * (0.38 + 0.14 * ((i * 0.618) % 1));
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.7; // squash vertically to hug the pup
        const doodleSize = 13 + ((i * 7) % 3) * 3;
        return (
          <Animated.View
            key={i}
            entering={reduceMotion ? undefined : FadeIn.delay(i * staggerMs).duration(250)}
            style={[
              styles.doodle,
              { transform: [{ translateX: x }, { translateY: y }, { rotate: `${((i * 47) % 40) - 20}deg` }] },
            ]}>
            <Doodle color={colors.secondary} size={doodleSize} strokeWidth={2} opacity={0.4} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: { alignItems: 'center', justifyContent: 'center' },
  doodle: { position: 'absolute' },
});
