import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ColorPicker } from '@/components/color-picker';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useAuth } from '@/features/auth/AuthProvider';
import { joinCouple, PairingError } from '@/features/couple/api';
import { INVITE_CODE_LENGTH, isValidInviteCodeShape, normalizeInviteCode } from '@/features/couple/inviteCode';
import { db } from '@/lib/firebase';
import { spacing } from '@/theme';

export default function JoinCoupleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function join() {
    if (!user) return;
    const clean = normalizeInviteCode(code);
    if (!isValidInviteCodeShape(clean)) {
      setError(`Codes are ${INVITE_CODE_LENGTH} characters — mind checking it?`);
      return;
    }
    if (!color) {
      setError('Pick a color that feels like you.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      await joinCouple(db, { uid: user.uid, code: clean, partnerColor: color });
      router.replace({ pathname: '/(onboarding)/celebrate', params: { role: 'joiner' } });
    } catch (err) {
      setError(
        err instanceof PairingError ? err.message : 'Couldn’t join just now — try again?',
      );
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <View style={styles.body}>
          <Text variant="title">Join your person</Text>
          <Text variant="body" color="textSecondary">
            Pop in the code they shared with you, then pick your color.
          </Text>

          <TextField
            label="Invite code"
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={INVITE_CODE_LENGTH}
            placeholder="ABC123"
          />
          <ColorPicker value={color} onChange={setColor} />
          {error ? (
            <Text variant="caption" color="destructive">
              {error}
            </Text>
          ) : null}
        </View>

        <Button label="Join our world" onPress={join} loading={busy} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, gap: spacing.lg, paddingTop: spacing.lg },
});
