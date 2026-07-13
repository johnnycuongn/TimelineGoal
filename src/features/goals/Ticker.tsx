/**
 * Partner ticker — recent check-ins, each reactable with a heart.
 * When YOUR check-in receives a partner reaction, the bulldog does `love`
 * (watched here so it works wherever the ticker is mounted).
 */

import { Heart } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBulldogStore } from '@/features/bulldog/store';
import { reactToActivity } from '@/features/goals/api';
import { useActivity } from '@/features/goals/hooks';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, useTheme } from '@/theme';

function timeAgo(ms: number | null): string {
  // A null timestamp = our own write still echoing locally (pending serverTimestamp).
  if (ms === null) return 'just now';
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function Ticker({
  coupleId,
  partnerColors,
  partnerName,
}: {
  coupleId: string;
  partnerColors: Record<string, string>;
  partnerName?: string;
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { items } = useActivity(coupleId, 6);
  const triggerBulldog = useBulldogStore((s) => s.trigger);

  // Bulldog `love` when a NEW partner reaction lands on one of my check-ins.
  const seenReactions = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  useEffect(() => {
    const mine = items.filter((i) => i.uid === user?.uid && i.reactions);
    const keys: string[] = [];
    for (const item of mine) {
      for (const [reactor, kind] of Object.entries(item.reactions ?? {})) {
        if (reactor !== user?.uid) keys.push(`${item.id}:${reactor}:${kind}`);
      }
    }
    if (!primed.current) {
      // First snapshot: record existing reactions without celebrating stale ones.
      keys.forEach((k) => seenReactions.current.add(k));
      primed.current = items.length >= 0 && true;
      return;
    }
    for (const k of keys) {
      if (!seenReactions.current.has(k)) {
        seenReactions.current.add(k);
        triggerBulldog('love');
        haptics.success();
      }
    }
  }, [items, user?.uid, triggerBulldog]);

  if (items.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text variant="label" color="textSecondary">
        Lately in the den
      </Text>
      {items.map((item) => {
        const isMine = item.uid === user?.uid;
        const who = isMine ? 'You' : (partnerName ?? 'Your partner');
        const accent = partnerColors[item.uid] ?? colors.primary;
        const myReaction = user ? item.reactions?.[user.uid] : undefined;
        const at = (item.at as { toMillis?: () => number })?.toMillis?.() ?? null;
        return (
          <View
            key={item.id}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.dot, { backgroundColor: accent }]} />
            <View style={styles.rowText}>
              <Text variant="label" numberOfLines={1}>
                {who} checked in {item.charm} {item.goalTitle}
              </Text>
              <Text variant="caption" color="textSecondary">
                {timeAgo(at)}
              </Text>
            </View>
            {!isMine ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={myReaction ? 'You sent a heart' : 'Send a heart'}
                disabled={!!myReaction}
                onPress={() => {
                  if (!user) return;
                  haptics.tick();
                  reactToActivity(db, {
                    coupleId,
                    activityId: item.id,
                    uid: user.uid,
                    reaction: 'heart',
                  }).catch(() => {});
                }}
                hitSlop={8}>
                <Heart
                  color={colors.secondary}
                  fill={myReaction ? colors.secondary : 'transparent'}
                  size={22}
                />
              </Pressable>
            ) : item.reactions && Object.keys(item.reactions).length > 0 ? (
              <Heart color={colors.secondary} fill={colors.secondary} size={22} />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 10, height: 10, borderRadius: 999 },
  rowText: { flex: 1 },
});
