import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ColorPicker } from '@/components/color-picker';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { createCouple } from '@/features/couple/api';
import { db } from '@/lib/firebase';
import { spacing } from '@/theme';

export default function CreateCoupleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [color, setColor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function create() {
    if (!user) return;
    if (!color) {
      setError('Pick a color that feels like you.');
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const { code } = await createCouple(db, { uid: user.uid, partnerColor: color });
      router.replace({ pathname: '/(onboarding)/celebrate', params: { role: 'creator', code } });
    } catch {
      setError('Couldn’t start your world just now — try again?');
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text variant="title">Make it yours</Text>
        <Text variant="body" color="textSecondary">
          Choose your color — your partner picks theirs when they join. Together they’ll
          color everything you build.
        </Text>

        <ColorPicker value={color} onChange={setColor} />
        {error ? (
          <Text variant="caption" color="destructive">
            {error}
          </Text>
        ) : null}
      </View>

      <Button label="Start our world" onPress={create} loading={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, gap: spacing.lg, paddingTop: spacing.lg },
});
