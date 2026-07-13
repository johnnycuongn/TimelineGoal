/**
 * New goal (modal) — any horizon. Title + emoji charm + who it's for + paws.
 * Weekly/quarterly goals can link one rung up the ladder ("climbs toward…"),
 * and creating a SHARED goal hands off to the seal ceremony (both paws in wax).
 */

import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { createGoal } from '@/features/goals/api';
import { useAllGoals } from '@/features/goals/hooks';
import { goalsForPeriod } from '@/features/goals/ladder';
import { currentPeriod, parentHorizon, type Horizon } from '@/features/goals/period';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

const CHARMS = ['🎯', '🏃', '🍳', '💪', '📚', '🌱', '💰', '🧘', '🎨', '✈️', '🏡', '💌'];

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'quarter', label: 'This quarter' },
  { value: 'year', label: 'This year' },
];

const TITLES: Record<Horizon, string> = {
  week: 'A new goal for the week',
  quarter: 'A goal for the quarter',
  year: 'A dream for the year',
};

export default function NewGoalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId } = useCouple();
  const { goals } = useAllGoals(coupleId);

  const [title, setTitle] = useState('');
  const [charm, setCharm] = useState(CHARMS[0]);
  const [horizon, setHorizon] = useState<Horizon>('week');
  const [owner, setOwner] = useState<'me' | 'shared'>('shared');
  const [units, setUnits] = useState(3);
  const [parentGoalId, setParentGoalId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Ladder linking: this goal can climb toward a current bigger goal one rung up.
  const up = parentHorizon(horizon);
  const parentCandidates = up ? goalsForPeriod(goals, up, currentPeriod(up)) : [];

  const maxUnits = horizon === 'week' ? 10 : 12;

  async function save() {
    if (!user || !coupleId) return;
    if (!title.trim()) {
      setError('Give your goal a name — small is fine!');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const goalId = await createGoal(db, {
        coupleId,
        uid: user.uid,
        title,
        charm,
        horizon,
        owner: owner === 'shared' ? 'shared' : user.uid,
        targetUnits: units,
        parentGoalId,
      });
      haptics.success();
      if (owner === 'shared') {
        // A pact deserves a moment: straight into the seal ceremony.
        router.replace(`/seal/${goalId}?armed=1`);
      } else {
        router.back();
      }
    } catch {
      setError('Couldn’t save that just now — try again?');
      setBusy(false);
    }
  }

  const chip = (selected: boolean, label: string, onPress: () => void, key?: string) => (
    <Pressable
      key={key ?? label}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptics.tick();
        onPress();
      }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.muted,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}>
      <Text variant="label" color={selected ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text variant="title">{TITLES[horizon]}</Text>

          <View style={styles.section}>
            <View style={styles.chips}>
              {HORIZONS.map((h) =>
                chip(
                  horizon === h.value,
                  h.label,
                  () => {
                    setHorizon(h.value);
                    setParentGoalId(null); // the rung above changed
                    setUnits((u) => Math.min(u, h.value === 'week' ? 10 : 12));
                  },
                  h.value,
                ),
              )}
            </View>
          </View>

          <TextField
            label="What are we doing?"
            value={title}
            onChangeText={setTitle}
            placeholder={horizon === 'week' ? 'e.g. Run together 3x' : 'e.g. Save for Kyoto'}
            maxLength={60}
            error={error}
          />

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Pick a charm
            </Text>
            <View style={styles.charms}>
              {CHARMS.map((c) => (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityState={{ selected: charm === c }}
                  onPress={() => {
                    haptics.tick();
                    setCharm(c);
                  }}
                  style={[
                    styles.charmCell,
                    {
                      backgroundColor: charm === c ? colors.muted : 'transparent',
                      borderColor: charm === c ? colors.primary : 'transparent',
                    },
                  ]}>
                  <Text style={styles.charmGlyph}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Whose goal?
            </Text>
            <View style={styles.chips}>
              {chip(owner === 'shared', 'Ours together', () => setOwner('shared'))}
              {chip(owner === 'me', 'Just mine', () => setOwner('me'))}
            </View>
            {owner === 'shared' ? (
              <Text variant="caption" color="textSecondary">
                shared goals end with the seal — both paws in the wax 💌
              </Text>
            ) : null}
          </View>

          {parentCandidates.length > 0 ? (
            <View style={styles.section}>
              <Text variant="label" color="textSecondary">
                Climbs toward… (optional)
              </Text>
              <Text variant="caption" color="textSecondary">
                every paw here nudges the bigger bar 🪜
              </Text>
              <View style={styles.chips}>
                {chip(parentGoalId === null, `Just this ${horizon}`, () => setParentGoalId(null))}
                {parentCandidates.map((p) =>
                  chip(
                    parentGoalId === p.id,
                    `${p.charm} ${p.title.length > 18 ? `${p.title.slice(0, 18)}…` : p.title}`,
                    () => setParentGoalId(p.id),
                    p.id,
                  ),
                )}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              {horizon === 'week'
                ? 'Paw prints to fill this week'
                : 'Paw prints to fill (linked weekly goals count too)'}
            </Text>
            <View style={styles.stepper}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Fewer paws"
                onPress={() => {
                  haptics.tick();
                  setUnits((u) => Math.max(1, u - 1));
                }}
                style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
                <Minus color={colors.text} size={20} />
              </Pressable>
              <Text variant="title">{units}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="More paws"
                onPress={() => {
                  haptics.tick();
                  setUnits((u) => Math.min(maxUnits, u + 1));
                }}
                style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
                <Plus color={colors.text} size={20} />
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Add our goal" onPress={save} loading={busy} />
          <Button label="Maybe later" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  section: { gap: spacing.sm },
  charms: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  charmCell: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charmGlyph: { fontSize: 24 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  stepBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { gap: spacing.xs, paddingTop: spacing.md },
});
