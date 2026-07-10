import { useLocalSearchParams, useRouter } from 'expo-router';
import { Dog } from 'lucide-react-native';
import { useEffect } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { fontFamily, haptics, radius, reducedMotionFadeMs, spacing, spring, useTheme } from '@/theme';

/**
 * Pairing celebration: two partner-colored halves slide together and the bulldog
 * pops in — "adopted". See .claude/skills/motion-spec (bouncy spring + celebration haptic).
 */
export default function CelebrateScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { role, code: codeParam } = useLocalSearchParams<{ role?: string; code?: string }>();
  const { couple } = useCouple();
  const reduceMotion = useReducedMotion();
  const inviteCode = couple?.pendingInviteCode ?? codeParam ?? null;

  const partnerColors = couple ? Object.values(couple.partnerColors) : [];
  const colorA = partnerColors[0] ?? colors.primary;
  const colorB = partnerColors[1] ?? colors.secondary;
  const paired = (couple?.members.length ?? 1) >= 2;

  const leftX = useSharedValue(reduceMotion ? 0 : -160);
  const rightX = useSharedValue(reduceMotion ? 0 : 160);
  const dogScale = useSharedValue(reduceMotion ? 1 : 0);
  const dogOpacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      haptics.success();
      return;
    }
    leftX.value = withSpring(0, spring.bouncy);
    rightX.value = withSpring(0, spring.bouncy);
    dogOpacity.value = withDelay(280, withTiming(1, { duration: reducedMotionFadeMs }));
    dogScale.value = withDelay(280, withSpring(1, spring.bouncy));
    const t = setTimeout(() => haptics.celebration(), 300);
    return () => clearTimeout(t);
  }, [reduceMotion, leftX, rightX, dogScale, dogOpacity]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ translateX: leftX.value }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ translateX: rightX.value }] }));
  const dogStyle = useAnimatedStyle(() => ({
    opacity: dogOpacity.value,
    transform: [{ scale: dogScale.value }],
  }));

  const isCreator = role === 'creator';

  return (
    <Screen center edges={['top', 'bottom']}>
      <View style={styles.stage}>
        <Animated.View style={[styles.dot, { backgroundColor: colorA }, leftStyle]} />
        <Animated.View style={[styles.dot, { backgroundColor: colorB, marginLeft: -24 }, rightStyle]} />
        <Animated.View style={[styles.bulldog, dogStyle]}>
          <Dog color={colors.primary} size={80} strokeWidth={2} />
        </Animated.View>
      </View>

      <Text variant="display" style={styles.center}>
        {isCreator && !paired ? 'Your world is born!' : 'You’re paired!'}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.center}>
        {isCreator && !paired
          ? 'Your bulldog is waiting for their name — and for your partner to hop in.'
          : 'Two of you, one little world. Let’s meet your bulldog.'}
      </Text>

      {isCreator && !paired && inviteCode ? (
        <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="caption" color="textSecondary">
            Your invite code
          </Text>
          <Text style={[styles.code, { color: colors.primary }]}>{inviteCode}</Text>
          <Button
            label="Share invite"
            variant="secondary"
            onPress={() => {
              haptics.tick();
              Share.share({
                message: `Join our little world on TimelineGoal 🐾 Use invite code ${inviteCode}`,
              }).catch(() => {});
            }}
          />
        </View>
      ) : null}

      <Button
        label="Meet the bulldog"
        onPress={() => router.replace('/(onboarding)/name-bulldog')}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 56, height: 56, borderRadius: 999 },
  bulldog: { position: 'absolute' },
  center: { textAlign: 'center' },
  cta: { alignSelf: 'stretch', marginTop: spacing.lg },
  codeCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  code: {
    fontFamily: fontFamily.headingBold,
    fontSize: 40,
    letterSpacing: 6,
  },
});

