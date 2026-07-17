/**
 * CornerCard — one topic space on the Corners grid.
 *
 * A little scrapbook cover: soft tint (or the cover photo, once one is set)
 * with the corner's charms scattered at playful angles, title underneath.
 * Press = spring squish + tick haptic (motion-spec: touch answers in 100ms).
 */

import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { storage } from '@/lib/firebase';
import { elevation, haptics, pressScale, radius, spacing, spring, useTheme } from '@/theme';
import { tintColor } from './api';
import type { CornerWithId } from './hooks';
import { useStorageUrl } from './photos';

/** Scatter placements for up to 3 charms — tilted like stickers on a scrapbook. */
const CHARM_POSES = [
  { top: 10, left: 12, transform: [{ rotate: '-8deg' }] },
  { top: 26, right: 14, transform: [{ rotate: '6deg' }] },
  { bottom: 8, left: 46, transform: [{ rotate: '-4deg' }] },
] as const;

interface CornerCardProps {
  corner: CornerWithId;
  onPress: () => void;
  onLongPress?: () => void;
}

export function CornerCard({ corner, onPress, onLongPress }: CornerCardProps) {
  const { colors, isDark } = useTheme();
  const coverUrl = useStorageUrl(corner.coverPhoto, storage);
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open the ${corner.title} corner`}
        onPressIn={() => {
          scale.value = withSpring(pressScale, spring.press);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, spring.press);
        }}
        onPress={() => {
          haptics.tick();
          onPress();
        }}
        onLongPress={onLongPress}
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          style={[
            styles.cover,
            { backgroundColor: tintColor(corner.tint, isDark ? 'dark' : 'light') },
          ]}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : null}
          {corner.charms.slice(0, CHARM_POSES.length).map((charm, i) => (
            <Text key={`${charm}-${i}`} style={[styles.charm, CHARM_POSES[i]]}>
              {charm}
            </Text>
          ))}
        </View>
        <View style={styles.meta}>
          <Text variant="label" numberOfLines={2}>
            {corner.title}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...elevation.soft,
  },
  cover: {
    height: 92,
  },
  charm: {
    position: 'absolute',
    fontSize: 28,
  },
  meta: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 56,
    justifyContent: 'center',
  },
});
