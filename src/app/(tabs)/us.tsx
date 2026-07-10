import { Heart } from 'lucide-react-native';
import { Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { signOutUser } from '@/features/auth/actions';
import { useCouple } from '@/features/couple/CoupleProvider';
import { fontFamily, haptics, radius, spacing, useTheme } from '@/theme';

/** Us — couple profile, bulldog, pending invite, sign out. Grows in M5. */
export default function UsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { couple } = useCouple();

  const myColor = user && couple ? couple.partnerColors[user.uid] : undefined;
  const paired = (couple?.members.length ?? 1) >= 2;
  const pendingCode = couple?.pendingInviteCode ?? null;

  return (
    <Screen>
      <View style={styles.header}>
        <Heart color={colors.primary} size={56} strokeWidth={2} fill={myColor ?? colors.secondary} />
        <Text variant="title">Us</Text>
        <Text variant="body" color="textSecondary">
          {user?.displayName ?? 'You'} · {couple?.bulldog.name || 'bulldog'}
        </Text>
      </View>

      {!paired && pendingCode ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="label" color="textSecondary">
            Waiting for your partner
          </Text>
          <Text style={[styles.code, { color: colors.primary }]}>{pendingCode}</Text>
          <Button
            label="Share invite"
            variant="secondary"
            onPress={() => {
              haptics.tick();
              Share.share({
                message: `Join our little world on TimelineGoal 🐾 Use invite code ${pendingCode}`,
              }).catch(() => {});
            }}
          />
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="label" color="textSecondary">
            Your world
          </Text>
          <Text variant="body">
            {paired ? 'You two are paired. 💕' : 'Setting things up…'}
          </Text>
        </View>
      )}

      <View style={styles.footer}>
        <Button label="Sign out" variant="ghost" onPress={() => signOutUser()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  code: { fontFamily: fontFamily.headingBold, fontSize: 30, letterSpacing: 4 },
  footer: { marginTop: 'auto', paddingBottom: spacing.lg },
});
