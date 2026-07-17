/**
 * PinBoard — the scrapbook area at the top of a corner.
 *
 * Pins render at shared normalized coordinates with sticker tilts, so both
 * partners see the same collage. Drag a pin to tidy it (spring-follows the
 * finger, position syncs on release — your partner watches it glide live).
 * Tap a link pin to open it; long-press any pin to unpin.
 */

import { openBrowserAsync } from 'expo-web-browser';
import { Link2, StickyNote } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Text } from '@/components/text';
import { db } from '@/lib/firebase';
import { elevation, haptics, radius, spacing, spring, useTheme } from '@/theme';
import { tintColor } from './api';
import type { PinWithId } from './hooks';
import { deletePin, movePin } from './pins';

const PIN_W = 128;
const PIN_H = 84;

interface PinBoardProps {
  coupleId: string;
  cornerId: string;
  pins: PinWithId[];
  height: number;
}

export function PinBoard({ coupleId, cornerId, pins, height }: PinBoardProps) {
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[styles.board, { height }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0
        ? pins.map((pin) => (
            <PinSticker
              key={pin.id}
              coupleId={coupleId}
              cornerId={cornerId}
              pin={pin}
              boardW={width}
              boardH={height}
            />
          ))
        : null}
    </View>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function PinSticker({
  coupleId,
  cornerId,
  pin,
  boardW,
  boardH,
}: {
  coupleId: string;
  cornerId: string;
  pin: PinWithId;
  boardW: number;
  boardH: number;
}) {
  const { colors, isDark } = useTheme();

  // Board coords → pixels (anchor = sticker center). Primitives only from here
  // down — worklet closures must never capture `pin` itself (its Firestore
  // Timestamp can't be copied to the UI runtime).
  const rot = pin.position.rot;
  const pinId = pin.id;
  const maxX = Math.max(1, boardW - PIN_W);
  const maxY = Math.max(1, boardH - PIN_H);
  const px = Math.min(maxX, Math.max(0, pin.position.x * boardW - PIN_W / 2));
  const py = Math.min(maxY, Math.max(0, pin.position.y * boardH - PIN_H / 2));

  const x = useSharedValue(px);
  const y = useSharedValue(py);
  const dragging = useSharedValue(false);

  // Partner moved it (or a fresh snapshot landed): glide to the synced spot —
  // unless this finger is mid-drag (the drag owns the position until release).
  useEffect(() => {
    if (!dragging.value) {
      x.value = withSpring(px, spring.default);
      y.value = withSpring(py, spring.default);
    }
  }, [px, py, x, y, dragging]);

  const isLink = pin.type === 'link';
  const url = pin.url;

  const gesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activateAfterLongPress(120) // don't fight vertical scrolls; a beat of hold = pick up
      .runOnJS(true)
      .onStart(() => {
        dragging.value = true;
      })
      .onChange((e) => {
        x.value = Math.min(maxX, Math.max(0, x.value + e.changeX));
        y.value = Math.min(maxY, Math.max(0, y.value + e.changeY));
      })
      .onEnd(() => {
        dragging.value = false;
        const cx = Math.min(1, Math.max(0, (x.value + PIN_W / 2) / boardW));
        const cy = Math.min(1, Math.max(0, (y.value + PIN_H / 2) / boardH));
        void movePin(db, {
          coupleId,
          cornerId,
          pinId,
          position: { x: cx, y: cy, rot },
        });
      })
      .onFinalize(() => {
        dragging.value = false;
      });

    const tap = Gesture.Tap()
      .runOnJS(true)
      .onEnd(() => {
        if (isLink && url) {
          haptics.tick();
          void openBrowserAsync(url);
        }
      });

    const unpin = Gesture.LongPress()
      .minDuration(600)
      .runOnJS(true)
      .onStart(() => {
        haptics.tick();
        Alert.alert('Unpin this?', 'It comes off the board for both of you.', [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Unpin',
            style: 'destructive',
            onPress: () => void deletePin(db, coupleId, cornerId, pinId),
          },
        ]);
      });

    return Gesture.Exclusive(pan, unpin, tap);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [boardW, boardH, coupleId, cornerId, pinId, rot, isLink, url, maxX, maxY]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${rot}deg` },
      { scale: withSpring(dragging.value ? 1.06 : 1, spring.press) },
    ],
  }));

  const noteBg = tintColor('butter', isDark ? 'dark' : 'light');

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityLabel={
          pin.type === 'note'
            ? `Note: ${pin.note}`
            : pin.type === 'link'
              ? `Link to ${hostOf(pin.url ?? '')}`
              : 'Photo pin'
        }
        style={[
          styles.pin,
          style,
          pin.type === 'note'
            ? { backgroundColor: noteBg }
            : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        ]}>
        {pin.decided ? <Text style={styles.stamp}>⭐</Text> : null}
        {pin.type === 'note' ? (
          <>
            <StickyNote color={colors.textSecondary} size={14} />
            <Text variant="caption" numberOfLines={3}>
              {pin.note}
            </Text>
          </>
        ) : pin.type === 'link' ? (
          <>
            <Link2 color={colors.primary} size={14} />
            <Text variant="caption" color="primary" numberOfLines={1}>
              {hostOf(pin.url ?? '')}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={2}>
              {pin.url}
            </Text>
          </>
        ) : (
          <Text variant="caption" color="textSecondary">
            📷 photo — soon
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  board: { alignSelf: 'stretch' },
  pin: {
    position: 'absolute',
    width: PIN_W,
    minHeight: PIN_H,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
    ...elevation.soft,
  },
  stamp: {
    position: 'absolute',
    top: -8,
    right: -6,
    fontSize: 16,
    zIndex: 1,
  },
});
