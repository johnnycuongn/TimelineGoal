/**
 * New pin (modal) — stick a note or a link onto the corner's scrapbook board.
 * Photo pins arrive with the Storage item; polls have their own modal.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { createPin } from '@/features/corners/pins';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

type PinKind = 'note' | 'link';

export default function NewPinScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId } = useCouple();
  const { cornerId } = useLocalSearchParams<{ cornerId: string }>();

  const [kind, setKind] = useState<PinKind>('note');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (!user || !coupleId || !cornerId) return;
    if (kind === 'note' && !note.trim()) {
      setError('A note needs a few words.');
      return;
    }
    if (kind === 'link') {
      const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      try {
        void new URL(normalized);
      } catch {
        setError('That link doesn’t look quite right.');
        return;
      }
      setUrl(normalized);
    }
    setError(undefined);
    setBusy(true);
    try {
      await createPin(db, {
        coupleId,
        cornerId,
        uid: user.uid,
        pin:
          kind === 'note'
            ? { type: 'note', note }
            : {
                type: 'link',
                url: /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`,
              },
      });
      haptics.success();
      router.back();
    } catch {
      setError('Couldn’t pin that just now — try again?');
      setBusy(false);
    }
  }

  const chip = (selected: boolean, label: string, onPress: () => void) => (
    <Pressable
      key={label}
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
        <View style={styles.body}>
          <Text variant="title">Pin something</Text>
          <Text variant="body" color="textSecondary">
            It goes on the board for both of you — drag it anywhere after.
          </Text>

          <View style={styles.chips}>
            {chip(kind === 'note', '📝 A note', () => setKind('note'))}
            {chip(kind === 'link', '🔗 A link', () => setKind('link'))}
          </View>

          {kind === 'note' ? (
            <TextField
              label="The note"
              value={note}
              onChangeText={setNote}
              placeholder="e.g. cherry blossom week: Apr 1–8"
              maxLength={140}
              error={error}
            />
          ) : (
            <TextField
              label="The link"
              value={url}
              onChangeText={setUrl}
              placeholder="e.g. airbnb.com/rooms/…"
              autoCapitalize="none"
              keyboardType="url"
              error={error}
            />
          )}
        </View>

        <View style={styles.footer}>
          <Button label="Pin it 📌" onPress={save} loading={busy} />
          <Button label="Maybe later" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, gap: spacing.lg, paddingTop: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: touchTarget,
    justifyContent: 'center',
  },
  footer: { gap: spacing.xs, paddingTop: spacing.md },
});
