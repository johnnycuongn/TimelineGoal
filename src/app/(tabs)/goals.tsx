import { useRouter } from 'expo-router';
import { Dog } from 'lucide-react-native';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { deleteGoal } from '@/features/goals/api';
import { GoalCard } from '@/features/goals/GoalCard';
import { useWeeklyGoals } from '@/features/goals/hooks';
import { db } from '@/lib/firebase';
import { spacing, staggerMs, useTheme } from '@/theme';

/** The Timeline — Week view (Quarter/Year views land in M3). */
export default function TimelineScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coupleId, couple } = useCouple();
  const { goals, loading } = useWeeklyGoals(coupleId);
  const reduceMotion = useReducedMotion();

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

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="title">This week</Text>
          <Text variant="caption" color="textSecondary">
            Tap a goal to stamp a paw 🐾
          </Text>
        </View>
        <Button label="Add" onPress={() => router.push('/new-goal')} style={styles.addBtn} />
      </View>

      {!loading && goals.length === 0 ? (
        <View style={styles.empty}>
          <Dog color={colors.textSecondary} size={64} strokeWidth={1.75} />
          <Text variant="bodyLarge" color="textSecondary" style={styles.center}>
            No goals yet — dream big?
          </Text>
          <Button label="Add our first goal" onPress={() => router.push('/new-goal')} />
        </View>
      ) : (
        <FlatList
          data={goals}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Animated.View
              entering={
                reduceMotion ? undefined : FadeInDown.delay(index * staggerMs).duration(250)
              }>
              <GoalCard
                coupleId={coupleId}
                goal={item}
                partnerColors={couple.partnerColors}
                onLongPress={() => confirmDelete(item.id, item.title)}
              />
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
    paddingBottom: spacing.lg,
  },
  addBtn: { minHeight: 44, paddingHorizontal: spacing.lg },
  list: { gap: spacing.md, paddingBottom: spacing.xxl },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  center: { textAlign: 'center' },
});
