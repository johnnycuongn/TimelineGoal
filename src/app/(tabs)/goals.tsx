import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { deleteGoal } from '@/features/goals/api';
import { GoalCard } from '@/features/goals/GoalCard';
import { useAllGoals } from '@/features/goals/hooks';
import { LadderCard } from '@/features/goals/LadderCard';
import { goalsForPeriod } from '@/features/goals/ladder';
import { currentPeriod, type Horizon } from '@/features/goals/period';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, staggerMs, touchTarget, useTheme } from '@/theme';

const SEGMENTS: { horizon: Horizon; label: string }[] = [
  { horizon: 'week', label: 'Week' },
  { horizon: 'quarter', label: 'Quarter' },
  { horizon: 'year', label: 'Year' },
];

const HEADINGS: Record<Horizon, { title: string; caption: string; empty: string }> = {
  week: {
    title: 'This week',
    caption: 'Tap a goal to stamp a paw 🐾',
    empty: 'No goals yet — dream big?',
  },
  quarter: {
    title: 'This quarter',
    caption: 'Weekly paws climb these bars 🪜',
    empty: 'No quarter goals yet — where are we headed?',
  },
  year: {
    title: 'This year',
    caption: 'The big dreams, fed by every little paw',
    empty: 'No year goals yet — dream really big?',
  },
};

/** The Timeline — Week · Quarter · Year. */
export default function TimelineScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coupleId, couple } = useCouple();
  const { goals, loading } = useAllGoals(coupleId);
  const reduceMotion = useReducedMotion();
  const [horizon, setHorizon] = useState<Horizon>('week');

  function confirmDelete(goalId: string, title: string) {
    Alert.alert('Let this one go?', `“${title}” and its paw prints will be removed.`, [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Let it go',
        style: 'destructive',
        onPress: () => {
          if (coupleId) deleteGoal(db, coupleId, goalId).catch(() => {});
        },
      },
    ]);
  }

  if (!coupleId || !couple) return null;

  const shown = goalsForPeriod(goals, horizon, currentPeriod(horizon));
  const heading = HEADINGS[horizon];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="title">{heading.title}</Text>
          <Text variant="caption" color="textSecondary">
            {heading.caption}
          </Text>
        </View>
        <Button label="Add" onPress={() => router.push('/new-goal')} style={styles.addBtn} />
      </View>

      <View style={[styles.segments, { backgroundColor: colors.muted }]}>
        {SEGMENTS.map((seg) => {
          const selected = horizon === seg.horizon;
          return (
            <Pressable
              key={seg.horizon}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => {
                haptics.tick();
                setHorizon(seg.horizon);
              }}
              style={[
                styles.segment,
                selected && { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Text variant="label" color={selected ? 'primary' : 'textSecondary'}>
                {seg.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!loading && shown.length === 0 ? (
        <View style={styles.empty}>
          <EmptyState
            message={heading.empty}
            cta="Add our first goal"
            onPress={() => router.push('/new-goal')}
          />
        </View>
      ) : (
        <FlatList
          key={horizon} // fresh stagger when switching views
          data={shown}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={
                reduceMotion ? undefined : FadeInDown.delay(index * staggerMs).duration(250)
              }>
              {horizon === 'week' ? (
                <GoalCard
                  coupleId={coupleId}
                  goal={item}
                  partnerColors={couple.partnerColors}
                  onLongPress={() => confirmDelete(item.id, item.title)}
                />
              ) : (
                <LadderCard
                  coupleId={coupleId}
                  goal={item}
                  allGoals={goals}
                  partnerColors={couple.partnerColors}
                  onSealPress={() => router.push(`/seal/${item.id}`)}
                  onLongPress={() => confirmDelete(item.id, item.title)}
                />
              )}
            </Animated.View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  addBtn: { minHeight: 44, paddingHorizontal: spacing.lg },
  segments: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 3,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
    minHeight: touchTarget - 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
});
