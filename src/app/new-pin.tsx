/**
 * New pin (modal) — stick a note or a link onto the corner's scrapbook board.
 * Photo pins arrive with the Storage item; polls have their own modal.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { createPin } from '@/features/corners/pins';
import { MAX_POLL_OPTIONS, createPoll } from '@/features/corners/polls';
import { db } from '@/lib/firebase';
import { haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

type PinKind = 'note' | 'link' | 'poll';

export default function NewPinScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId } = useCouple();
  const { cornerId } = useLocalSearchParams<{ cornerId: string }>();

  const [kind, setKind] = useState<PinKind>('note');
  const [note, setNote] = useState('');
  const [url, setUrl] = useState('');
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (!user || !coupleId || !cornerId) return;
    if (kind === 'note' && !note.trim()) {
      setError('A note needs a few words.');
      return;
    }
    if (kind === 'poll') {
      const filled = options.map((o) => o.trim()).filter(Boolean);
      if (!question.trim() || filled.length < 2) {
        setError('A poll needs a question and at least two choices.');
        return;
      }
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
      if (kind === 'poll') {
        await createPoll(db, {
          coupleId,
          cornerId,
          uid: user.uid,
          question,
          options: options.map((o) => o.trim()).filter(Boolean),
        });
      } else {
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
      }
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
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <Text variant="title">Pin something</Text>
          <Text variant="body" color="textSecondary">
            It goes on the board for both of you — drag it anywhere after.
          </Text>

          <View style={styles.chips}>
            {chip(kind === 'note', '📝 A note', () => setKind('note'))}
            {chip(kind === 'link', '🔗 A link', () => setKind('link'))}
            {chip(kind === 'poll', '📊 A poll', () => setKind('poll'))}
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
          ) : kind === 'link' ? (
            <TextField
              label="The link"
              value={url}
              onChangeText={setUrl}
              placeholder="e.g. airbnb.com/rooms/…"
              autoCapitalize="none"
              keyboardType="url"
              error={error}
            />
          ) : (
            <View style={styles.pollFields}>
              <TextField
                label="The question"
                value={question}
                onChangeText={setQuestion}
                placeholder="e.g. Where do we stay?"
                maxLength={80}
                error={error}
              />
              {options.map((opt, idx) => (
                <TextField
                  key={idx}
                  label={`Choice ${idx + 1}`}
                  value={opt}
                  onChangeText={(next) =>
                    setOptions((prev) => prev.map((o, i) => (i === idx ? next : o)))
                  }
                  placeholder={idx === 0 ? 'e.g. Ryokan' : 'e.g. Hotel'}
                  maxLength={40}
                />
              ))}
              {options.length < MAX_POLL_OPTIONS ? (
                <Button
                  label="Another choice"
                  variant="ghost"
                  onPress={() => setOptions((prev) => [...prev, ''])}
                />
              ) : null}
            </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button label={kind === 'poll' ? 'Ask us 📊' : 'Pin it 📌'} onPress={save} loading={busy} />
          <Button label="Maybe later" variant="ghost" onPress={() => router.back()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pollFields: { gap: spacing.md },
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
