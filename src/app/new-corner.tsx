/**
 * New corner (modal) — name the topic, sprinkle up to 3 charms, pick a tint.
 * The cover photo comes later, from inside the corner (Storage lands late in M4).
 */

import { useRouter } from 'expo-router';
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
import { CORNER_TINTS, MAX_CORNER_CHARMS, createCorner, tintColor } from '@/features/corners/api';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, useTheme } from '@/theme';

/** Topical charms for spaces (goals have their own set) — all optional decoration. */
const CHARM_CHOICES = [
  '✈️', '🏡', '💍', '👶', '🐶', '💰', '🎁', '🥘',
  '🎄', '🌊', '⛩️', '🎮', '🌱', '📸', '🛋️', '🎂',
];

export default function NewCornerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { coupleId } = useCouple();

  const [title, setTitle] = useState('');
  const [charms, setCharms] = useState<string[]>([]);
  const [tint, setTint] = useState<string>(CORNER_TINTS[0].name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  function toggleCharm(charm: string) {
    haptics.tick();
    setCharms((prev) =>
      prev.includes(charm)
        ? prev.filter((c) => c !== charm)
        : prev.length < MAX_CORNER_CHARMS
          ? [...prev, charm]
          : prev,
    );
  }

  async function save() {
    if (!user || !coupleId) return;
    if (!title.trim()) {
      setError('What corner of life is this? A word or two is plenty.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const cornerId = await createCorner(db, { coupleId, uid: user.uid, title, charms, tint });
      haptics.success();
      router.replace(`/corner/${cornerId}`);
    } catch {
      setError('Couldn’t open that corner just now — try again?');
      setBusy(false);
    }
  }

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
          <Text variant="title">A new corner</Text>
          <Text variant="body" color="textSecondary">
            One cozy spot for one topic — plan it, chat about it, decide together.
          </Text>

          <TextField
            label="What's it about?"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Kyoto trip, Our first home"
            maxLength={40}
            error={error}
          />

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Sprinkle some charms (up to {MAX_CORNER_CHARMS})
            </Text>
            <View style={styles.charms}>
              {CHARM_CHOICES.map((c) => {
                const selected = charms.includes(c);
                return (
                  <Pressable
                    key={c}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => toggleCharm(c)}
                    style={[
                      styles.charmCell,
                      {
                        backgroundColor: selected ? colors.muted : 'transparent',
                        borderColor: selected ? colors.primary : 'transparent',
                      },
                    ]}>
                    <Text style={styles.charmGlyph}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textSecondary">
              Pick a cover tint
            </Text>
            <View style={styles.tints}>
              {CORNER_TINTS.map((t) => {
                const selected = tint === t.name;
                return (
                  <Pressable
                    key={t.name}
                    accessibilityRole="button"
                    accessibilityLabel={`${t.name} tint`}
                    accessibilityState={{ selected }}
                    onPress={() => {
                      haptics.tick();
                      setTint(t.name);
                    }}
                    style={[
                      styles.tintDot,
                      {
                        backgroundColor: tintColor(t.name, isDark ? 'dark' : 'light'),
                        borderColor: selected ? colors.primary : colors.border,
                        borderWidth: selected ? 3 : 1,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Button label="Open this corner" onPress={save} loading={busy} />
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
  tints: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tintDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  footer: { gap: spacing.xs, paddingTop: spacing.md },
});
