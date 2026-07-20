import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import RiggedPupStage from '@/features/bulldog/pup3d/RiggedPupStage';
import { useCouple } from '@/features/couple/CoupleProvider';
import { setBulldogName } from '@/features/couple/api';
import { db } from '@/lib/firebase';
import { haptics, spacing } from '@/theme';

export default function NameBulldogScreen() {
  const { coupleId, couple } = useCouple();
  const [name, setName] = useState(couple?.bulldog.name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function save() {
    if (!coupleId) return;
    if (!name.trim()) {
      setError('Every good bulldog needs a name.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await setBulldogName(db, coupleId, name);
      haptics.success();
      // Bulldog now named → session becomes "ready" → the guard sends us into the app.
    } catch {
      setError('Couldn’t save that just now — try again?');
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <RiggedPupStage width={200} height={170} showHint={false} />
            <Text variant="title">Meet your bulldog</Text>
            <Text variant="body" color="textSecondary" style={styles.center}>
              This little one cheers you both on. What’s their name?
            </Text>
          </View>

          <TextField
            label="Bulldog’s name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            maxLength={20}
            placeholder="e.g. Mochi"
            error={error}
          />
        </View>

        <Button label="That’s the one!" onPress={save} loading={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, gap: spacing.xl, paddingTop: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
