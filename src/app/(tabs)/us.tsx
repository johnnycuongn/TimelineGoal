/**
 * Us — the couple's little profile (M5).
 * Anniversary + days-together counter, pairing management (share code,
 * mint a fresh invite, leave), the pup's pedigree credits, sign out.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import { openBrowserAsync } from 'expo-web-browser';
import { CalendarHeart, Heart } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { signOutUser } from '@/features/auth/actions';
import { useCouple } from '@/features/couple/CoupleProvider';
import { leaveCouple, mintInvite, setAnniversary } from '@/features/couple/api';
import { db } from '@/lib/firebase';
import { fontFamily, haptics, radius, spacing, useTheme } from '@/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "n days of us", with years pulled out once they've earned one. */
function daysTogetherLabel(anniversary: Date, now: number): string {
  const days = Math.max(0, Math.floor((now - anniversary.getTime()) / DAY_MS));
  if (days < 366) return `${days} day${days === 1 ? '' : 's'} of us`;
  const years = Math.floor(days / 365.25);
  const rest = Math.floor(days - years * 365.25);
  return `${years} year${years === 1 ? '' : 's'} and ${rest} day${rest === 1 ? '' : 's'} of us`;
}

export default function UsScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { coupleId, couple } = useCouple();
  // Frozen at mount — a day counter doesn't need to tick live.
  const [now] = useState(() => Date.now());
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const myColor = user && couple ? couple.partnerColors[user.uid] : undefined;
  const partnerUid = couple?.members.find((m) => m !== user?.uid);
  const partnerColor = partnerUid ? couple?.partnerColors[partnerUid] : undefined;
  const paired = (couple?.members.length ?? 1) >= 2;
  const pendingCode = couple?.pendingInviteCode ?? null;
  const anniversary = couple?.anniversary ? couple.anniversary.toDate() : null;

  async function saveAnniversary(date: Date) {
    if (!coupleId) return;
    haptics.success();
    await setAnniversary(db, coupleId, date).catch(() => {});
  }

  async function inviteAgain() {
    if (!coupleId || !user || busy) return;
    setBusy(true);
    try {
      haptics.tick();
      await mintInvite(db, { coupleId, uid: user.uid });
    } finally {
      setBusy(false);
    }
  }

  function confirmLeave() {
    if (!coupleId || !user || !couple) return;
    haptics.tick();
    Alert.alert(
      'Leave this world?',
      'Everything you built together stays safe — you can rejoin any time with a fresh invite.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () =>
            void leaveCouple(db, { coupleId, uid: user.uid, members: couple.members }),
        },
      ],
    );
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
        <View style={styles.header}>
          <Heart color={colors.primary} size={56} strokeWidth={2} fill={myColor ?? colors.secondary} />
          <Text variant="title">Us</Text>
          <Text variant="body" color="textSecondary">
            {user?.displayName ?? 'You'} · {couple?.bulldog.name || 'bulldog'}
          </Text>
          {paired ? (
            <View style={styles.dots}>
              <View style={[styles.dot, { backgroundColor: myColor ?? colors.primary }]} />
              <View style={[styles.dot, { backgroundColor: partnerColor ?? colors.secondary }]} />
            </View>
          ) : null}
        </View>

        {/* Anniversary + days together */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={anniversary ? 'Change your anniversary' : 'Set your anniversary'}
          onPress={() => {
            haptics.tick();
            setShowPicker((s) => !s);
          }}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CalendarHeart color={colors.primary} size={28} />
          {anniversary ? (
            <>
              <Text style={[styles.bigCount, { color: colors.primary }]}>
                {daysTogetherLabel(anniversary, now)}
              </Text>
              <Text variant="caption" color="textSecondary">
                since{' '}
                {anniversary.toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}{' '}
                · tap to change
              </Text>
            </>
          ) : (
            <>
              <Text variant="label">When did “us” begin?</Text>
              <Text variant="caption" color="textSecondary">
                set your anniversary and we’ll keep count 💗
              </Text>
            </>
          )}
        </Pressable>
        {showPicker ? (
          <DateTimePicker
            value={anniversary ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onValueChange={(_event, date) => {
              if (Platform.OS !== 'ios') setShowPicker(false);
              if (date) void saveAnniversary(date);
            }}
            onDismiss={() => setShowPicker(false)}
          />
        ) : null}

        {/* Pairing management */}
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
        ) : !paired ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="label" color="textSecondary">
              It’s quiet in here
            </Text>
            <Text variant="body" style={styles.center}>
              Invite your person (back) in — the den keeps everything warm.
            </Text>
            <Button label="Make an invite code" onPress={inviteAgain} loading={busy} />
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="label" color="textSecondary">
              Your world
            </Text>
            <Text variant="body">You two are paired. 💕</Text>
          </View>
        )}

        {/* The pup's pedigree — CC-BY credit (license) + CC0 thanks */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="label" color="textSecondary">
            About our pup
          </Text>
          <Text variant="caption" color="textSecondary" style={styles.center}>
            The 3D puppy is “Bulldog Puppy” by doinspire, licensed under CC BY 4.0. His moves
            come from Quaternius’ animal pack (CC0) — thank you both. 🐾
          </Text>
          <View style={styles.linkRow}>
            <Button
              label="doinspire"
              variant="ghost"
              onPress={() =>
                void openBrowserAsync(
                  'https://sketchfab.com/3d-models/bulldog-puppy-7081c9c27df244bf84774361888f58a2',
                )
              }
            />
            <Button
              label="CC BY 4.0"
              variant="ghost"
              onPress={() => void openBrowserAsync('https://creativecommons.org/licenses/by/4.0/')}
            />
            <Button
              label="Quaternius"
              variant="ghost"
              onPress={() => void openBrowserAsync('https://quaternius.com')}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button label="Sign out" variant="ghost" onPress={() => signOutUser()} />
          {couple ? (
            <Button label="Leave this world" variant="ghost" onPress={confirmLeave} />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: spacing.md, paddingBottom: spacing.xl },
  header: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xs },
  dot: { width: 14, height: 14, borderRadius: 7 },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  bigCount: { fontFamily: fontFamily.headingSemiBold, fontSize: 22, textAlign: 'center' },
  code: { fontFamily: fontFamily.headingBold, fontSize: 30, letterSpacing: 4 },
  center: { textAlign: 'center' },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  footer: { paddingTop: spacing.md },
});
