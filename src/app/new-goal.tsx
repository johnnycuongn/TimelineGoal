/**
 * New weekly goal (modal). Title + emoji charm + who it's for + paws-per-week.
 * Quarterly/yearly goals + ladder linking land in M3.
 */

import { useRouter } from 'expo-router';
import { Minus, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { createGoal } from '@/features/goals/api';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

const CHARMS = ['🎯', '🏃', '🍳', '💪', '📚', '🌱', '💰', '🧘', '🎨', '✈️', '🏡', '💌'];

export default function NewGoalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId } = useCouple();

  const [title, setTitle] = useState('');
  const [charm, setCharm] = useState(CHARMS[0]);
  const [owner, setOwner] = useState<'me' | 'shared'>('shared');
  const [units, setUnits] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (!user || !coupleId) return;
    if (!title.trim()) {
      setError('Give your goal a name — small is fine!');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await createGoal(db, {
        coupleId,
        uid: user.uid,
        title,
        charm,
        horizon: 'week',
        owner: owner === 'shared' ? 'shared' : user.uid,
        targetUnits: units,
      });
      haptics.success();
      router.back();
    } catch {
      setError('Couldn’t save that just now — try again?');
      setBusy(false);
    }
  }

  const ownerChip = (value: 'me' | 'shared', label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: owner === value }}
      onPress={() => {
        haptics.tick();
        setOwner(value);
      }}
      style={[
        styles.chip,
        {
          backgroundColor: owner === value ? colors.primary : colors.muted,
          borderColor: owner === value ? colors.primary : colors.border,
        },
      ]}>
      <Text variant="label" color={owner === value ? 'onPrimary' : 'text'}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.body}>
          <Text variant="title">A new goal for the week</Text>

          <TextField
            label="What are we doing?"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Run together 3x"
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
              {ownerChip('shared', 'Ours together')}
              {ownerChip('me', 'Just mine')}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Paw prints to fill this week
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
                  setUnits((u) => Math.min(10, u + 1));
                }}
                style={[styles.stepBtn, { backgroundColor: colors.muted }]}>
                <Plus color={colors.text} size={20} />
              </Pressable>
            </View>
          </View>
        </View>

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
  body: { flex: 1, gap: spacing.lg, paddingTop: spacing.md },
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
  chips: { flexDirection: 'row', gap: spacing.sm },
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
