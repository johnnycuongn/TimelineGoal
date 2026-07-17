/**
 * MessageBubble — one chat message in a corner.
 *
 * Mine sit right in my color, my partner's sit left in theirs (colors always
 * combine, never compete). Tap your partner's bubble to flick a ❤️ on it —
 * tap again to take it back. Reactions perch on the bubble's corner.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Text } from '@/components/text';
import { haptics, radius, spacing, useTheme } from '@/theme';
import type { MessageWithId } from './hooks';

interface MessageBubbleProps {
  message: MessageWithId;
  mine: boolean;
  /** The bubble color for this sender (their partner color). */
  color: string;
  /** Toggle my ❤️ on my partner's message (undefined on my own bubbles). */
  onToggleHeart?: () => void;
  /** Long-press menu: stamp ⭐ decision / make it a goal. */
  onLongPress?: () => void;
}

export function MessageBubble({ message, mine, color, onToggleHeart, onLongPress }: MessageBubbleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const reactions = Object.values(message.reactions ?? {});

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeInDown.springify().damping(15).stiffness(150)}
      style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]}>
      <Pressable
        accessibilityRole={onToggleHeart ? 'button' : 'text'}
        accessibilityLabel={
          onToggleHeart ? `${message.text} — double tap to heart` : message.text
        }
        onPress={
          onToggleHeart
            ? () => {
                haptics.tick();
                onToggleHeart();
              }
            : undefined
        }
        onLongPress={onLongPress}
        style={[styles.bubble, { backgroundColor: color }]}>
        <Text variant="body" style={styles.text}>
          {message.text}
        </Text>
        {message.decided ? (
          <View style={[styles.stamp, { backgroundColor: colors.surface }]}>
            <Text style={styles.stampGlyph}>⭐</Text>
          </View>
        ) : null}
        {reactions.length > 0 ? (
          <View style={[styles.reactions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.reactionGlyph}>{reactions.join('')}</Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: spacing.xs },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  text: { color: '#FFFFFF' },
  reactions: {
    position: 'absolute',
    bottom: -10,
    right: -4,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  reactionGlyph: { fontSize: 12 },
  stamp: {
    position: 'absolute',
    top: -10,
    left: -6,
    borderRadius: radius.pill,
    padding: 2,
  },
  stampGlyph: { fontSize: 14 },
});
