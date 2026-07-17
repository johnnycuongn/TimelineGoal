/**
 * PinBoard — the scrapbook area at the top of a corner.
 *
 * Pins render at shared normalized coordinates with sticker tilts, so both
 * partners see the same collage. Drag a pin to tidy it (spring-follows the
 * finger, position syncs on release — your partner watches it glide live).
 * Tap a link pin to open it; long-press any pin to unpin.
 */

import { openBrowserAsync } from 'expo-web-browser';
import { BarChart3, Link2, StickyNote } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
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
import { decidePin, votePoll } from './polls';

const PIN_W = 128;
const POLL_W = 208;
const PIN_H = 84;

interface PinBoardProps {
  coupleId: string;
  cornerId: string;
  pins: PinWithId[];
  height: number;
  /** My uid + the couple's partner colors + member count — polls need all three. */
  myUid: string;
  partnerColors: Record<string, string>;
  memberCount: number;
  /** "Make it a goal →" tapped on a decided poll. */
  onMakeGoal: (pin: PinWithId) => void;
}

export function PinBoard({
  coupleId,
  cornerId,
  pins,
  height,
  myUid,
  partnerColors,
  memberCount,
  onMakeGoal,
}: PinBoardProps) {
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
              myUid={myUid}
              partnerColors={partnerColors}
              memberCount={memberCount}
              onMakeGoal={onMakeGoal}
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
  myUid,
  partnerColors,
  memberCount,
  onMakeGoal,
}: {
  coupleId: string;
  cornerId: string;
  pin: PinWithId;
  boardW: number;
  boardH: number;
  myUid: string;
  partnerColors: Record<string, string>;
  memberCount: number;
  onMakeGoal: (pin: PinWithId) => void;
}) {
  const { colors, isDark } = useTheme();

  // Board coords → pixels (anchor = sticker center). Primitives only from here
  // down — worklet closures must never capture `pin` itself (its Firestore
  // Timestamp can't be copied to the UI runtime).
  const rot = pin.position.rot;
  const pinId = pin.id;
  const w = pin.type === 'poll' ? POLL_W : PIN_W;
  const maxX = Math.max(1, boardW - w);
  const maxY = Math.max(1, boardH - PIN_H);
  const px = Math.min(maxX, Math.max(0, pin.position.x * boardW - w / 2));
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
        const cx = Math.min(1, Math.max(0, (x.value + w / 2) / boardW));
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

    // Polls keep taps for their option rows (child Pressables) — a quick tap
    // activates no gesture (pan needs a 120ms hold, unpin 600ms), so it falls
    // through to the children.
    return isLink ? Gesture.Exclusive(pan, unpin, tap) : Gesture.Exclusive(pan, unpin);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shared values are stable refs
  }, [boardW, boardH, coupleId, cornerId, pinId, rot, isLink, url, maxX, maxY, w]);

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
              : pin.type === 'poll'
                ? `Poll: ${pin.poll?.question ?? ''}`
                : 'Photo pin'
        }
        style={[
          styles.pin,
          pin.type === 'poll' ? styles.poll : null,
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
        ) : pin.type === 'poll' && pin.poll ? (
          <PollBody
            pin={pin}
            coupleId={coupleId}
            cornerId={cornerId}
            myUid={myUid}
            partnerColors={partnerColors}
            memberCount={memberCount}
            onMakeGoal={onMakeGoal}
          />
        ) : (
          <Text variant="caption" color="textSecondary">
            📷 photo — soon
          </Text>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * The voting face of a poll pin. One changeable vote per partner (dots in each
 * partner's color). When everyone's vote lands on the same option, the couple
 * can stamp it ⭐ official; a stamped poll offers "Make it a goal →".
 */
function PollBody({
  pin,
  coupleId,
  cornerId,
  myUid,
  partnerColors,
  memberCount,
  onMakeGoal,
}: {
  pin: PinWithId;
  coupleId: string;
  cornerId: string;
  myUid: string;
  partnerColors: Record<string, string>;
  memberCount: number;
  onMakeGoal: (pin: PinWithId) => void;
}) {
  const { colors } = useTheme();
  const poll = pin.poll!;
  const voteEntries = Object.entries(poll.votes);
  const consensus =
    voteEntries.length >= Math.max(1, memberCount) &&
    voteEntries.every(([, v]) => v === voteEntries[0][1]);

  return (
    <>
      <View style={styles.pollHead}>
        <BarChart3 color={colors.primary} size={14} />
        <Text variant="label" numberOfLines={2} style={styles.pollQuestion}>
          {poll.question}
        </Text>
      </View>
      {poll.options.map((opt, idx) => {
        const voters = voteEntries.filter(([, v]) => v === idx);
        const iChose = poll.votes[myUid] === idx;
        return (
          <Pressable
            key={`${opt}-${idx}`}
            accessibilityRole="button"
            accessibilityState={{ selected: iChose }}
            accessibilityLabel={`Vote ${opt}`}
            onPress={() => {
              haptics.tick();
              void votePoll(db, { coupleId, cornerId, pinId: pin.id, uid: myUid, optionIndex: idx });
            }}
            style={[
              styles.pollOption,
              {
                backgroundColor: iChose ? colors.muted : 'transparent',
                borderColor: iChose ? colors.primary : colors.border,
              },
            ]}>
            <Text variant="caption" numberOfLines={1} style={styles.pollOptionText}>
              {opt}
            </Text>
            <View style={styles.voteDots}>
              {voters.map(([uid]) => (
                <View
                  key={uid}
                  style={[
                    styles.voteDot,
                    { backgroundColor: partnerColors[uid] ?? colors.secondary },
                  ]}
                />
              ))}
            </View>
          </Pressable>
        );
      })}
      {consensus && !pin.decided ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.success();
            void decidePin(db, { coupleId, cornerId, pinId: pin.id, decided: true });
          }}
          style={[styles.pollCta, { backgroundColor: colors.primary }]}>
          <Text variant="caption" color="onPrimary">
            ⭐ make it official
          </Text>
        </Pressable>
      ) : null}
      {pin.decided && !pin.linkedGoalId ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            haptics.tick();
            onMakeGoal(pin);
          }}
          style={[styles.pollCta, { backgroundColor: colors.muted, borderColor: colors.primary, borderWidth: 1 }]}>
          <Text variant="caption" color="primary">
            Make it a goal →
          </Text>
        </Pressable>
      ) : null}
      {pin.linkedGoalId ? (
        <Text variant="caption" color="textSecondary">
          on the Timeline 🪜
        </Text>
      ) : null}
    </>
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
  poll: { width: POLL_W, gap: spacing.xs },
  pollHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pollQuestion: { flex: 1 },
  pollOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
  },
  pollOptionText: { flex: 1 },
  voteDots: { flexDirection: 'row', gap: 3 },
  voteDot: { width: 10, height: 10, borderRadius: 5 },
  pollCta: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginTop: 2,
  },
  stamp: {
    position: 'absolute',
    top: -8,
    right: -6,
    fontSize: 16,
    zIndex: 1,
  },
});
