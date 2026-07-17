/**
 * Corners — the grid of shared topic spaces (M4).
 * One cozy board per thing we're planning: chat, pins, polls, decisions.
 */

import { useRouter } from 'expo-router';
import { MessagesSquare, Plus } from 'lucide-react-native';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Loading } from '@/components/loading';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useCouple } from '@/features/couple/CoupleProvider';
import { CornerCard } from '@/features/corners/CornerCard';
import { useCorners } from '@/features/corners/hooks';
import { elevation, haptics, spacing, touchTarget, useTheme } from '@/theme';

export default function CornersScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { coupleId } = useCouple();
  const { corners, loading } = useCorners(coupleId);

  if (loading) {
    return <Loading message="Tidying the corners…" />;
  }

  if (corners.length === 0) {
    return (
      <Screen center>
        <MessagesSquare color={colors.primary} size={72} strokeWidth={2} />
        <Text variant="display">Corners</Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          A little corner for every plan we’re{'\n'}dreaming up together.
        </Text>
        <Button label="Open our first corner" onPress={() => router.push('/new-corner')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="display">Corners</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open a new corner"
          onPress={() => {
            haptics.tick();
            router.push('/new-corner');
          }}
          style={[styles.addBtn, { backgroundColor: colors.primary }]}>
          <Plus color={colors.onPrimary} size={24} strokeWidth={2.5} />
        </Pressable>
      </View>
      <FlatList
        data={corners}
        keyExtractor={(c) => c.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <CornerCard corner={item} onPress={() => router.push(`/corner/${item.id}`)} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
  },
  addBtn: {
    width: touchTarget,
    height: touchTarget,
    borderRadius: touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.soft,
  },
  row: { gap: spacing.md },
  grid: { gap: spacing.md, paddingBottom: spacing.xl },
});
