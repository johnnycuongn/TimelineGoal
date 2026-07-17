/**
 * Inside a corner — tinted header with scattered charms, live chat below.
 * The scrapbook pin area lands next in M4 (item 3); polls + ⭐ after that.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Send } from 'lucide-react-native';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCouple } from '@/features/couple/CoupleProvider';
import { tintColor } from '@/features/corners/api';
import { reactToMessage, sendMessage } from '@/features/corners/chat';
import { useCorner, useMessages } from '@/features/corners/hooks';
import { MessageBubble } from '@/features/corners/MessageBubble';
import { db } from '@/lib/firebase';
import { fontFamily, fontSize, haptics, radius, spacing, touchTarget, useTheme } from '@/theme';

export default function CornerScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { cornerId } = useLocalSearchParams<{ cornerId: string }>();
  const { coupleId, couple } = useCouple();
  const { corner, loading } = useCorner(coupleId, cornerId ?? null);
  const { messages } = useMessages(coupleId, cornerId ?? null);

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    if (!user || !coupleId || !cornerId || !draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    setSending(true);
    try {
      haptics.tick();
      await sendMessage(db, { coupleId, cornerId, uid: user.uid, text });
    } catch {
      setDraft(text); // hand their words back — nothing lost
    } finally {
      setSending(false);
    }
  }

  function toggleHeart(messageId: string, current: string | undefined) {
    if (!user || !coupleId || !cornerId) return;
    void reactToMessage(db, {
      coupleId,
      cornerId,
      messageId,
      uid: user.uid,
      reaction: current ? null : '❤️',
    });
  }

  if (loading) {
    return <Loading message="Opening the corner…" />;
  }
  if (!corner) {
    return (
      <Screen center>
        <Text variant="title">This corner has been tidied away</Text>
        <Text variant="body" color="textSecondary">
          It may have been closed from the other phone.
        </Text>
      </Screen>
    );
  }

  const bubbleColor = (uid: string) =>
    couple?.partnerColors?.[uid] ?? (uid === user?.uid ? colors.primary : colors.secondary);

  return (
    <Screen edges={['top', 'bottom']} style={styles.noPad}>
      <View
        style={[
          styles.cover,
          { backgroundColor: tintColor(corner.tint, isDark ? 'dark' : 'light') },
        ]}>
        <View style={styles.coverRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to all corners"
            onPress={() => {
              haptics.tick();
              router.back();
            }}
            style={[styles.backBtn, { backgroundColor: colors.surface }]}>
            <ChevronLeft color={colors.text} size={24} />
          </Pressable>
          <View style={styles.charmRow}>
            {corner.charms.map((c, i) => (
              <Text
                key={`${c}-${i}`}
                style={[styles.charm, { transform: [{ rotate: i % 2 ? '6deg' : '-6deg' }] }]}>
                {c}
              </Text>
            ))}
          </View>
        </View>
        <Text variant="title">{corner.title}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        {messages.length === 0 ? (
          // Outside the inverted list — `inverted` mirrors its children on Android.
          <View style={styles.empty}>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              Nothing here yet — say the first thing 💬
            </Text>
          </View>
        ) : null}
        <FlatList
          inverted
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.chat}
          style={messages.length === 0 ? styles.hidden : undefined}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const mine = item.uid === user?.uid;
            return (
              <MessageBubble
                message={item}
                mine={mine}
                color={bubbleColor(item.uid)}
                onToggleHeart={
                  mine ? undefined : () => toggleHeart(item.id, item.reactions?.[user?.uid ?? ''])
                }
              />
            );
          }}
        />

        <View style={[styles.inputBar, { borderTopColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Say something sweet (or practical)…"
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
            style={[
              styles.input,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                color: colors.text,
              },
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            disabled={!draft.trim() || sending}
            onPress={send}
            style={[
              styles.sendBtn,
              { backgroundColor: draft.trim() ? colors.primary : colors.muted },
            ]}>
            <Send color={draft.trim() ? colors.onPrimary : colors.textSecondary} size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}


const styles = StyleSheet.create({
  noPad: { paddingHorizontal: 0, paddingTop: 0 },
  flex: { flex: 1 },
  cover: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
    gap: spacing.xs,
  },
  coverRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  charmRow: { flexDirection: 'row', gap: spacing.sm },
  charm: { fontSize: 26 },
  chat: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, flexGrow: 1 },
  empty: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  emptyText: { textAlign: 'center' },
  hidden: { display: 'none' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: touchTarget,
    maxHeight: 120,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.body,
  },
  sendBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
