import { Redirect, Tabs } from 'expo-router';
import { Dog, ListChecks, MessagesSquare, Heart } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { ColorValue } from 'react-native';

import { Loading } from '@/components/loading';
import { routeForStatus, useSession } from '@/features/session';
import { fontFamily, radius, spacing, useTheme } from '@/theme';

/**
 * Bottom tab bar — the app's primary navigation (≤5 items, icon + label).
 * Classic expo-router Tabs (not NativeTabs) so we fully own the cute rose styling.
 * Screens: Den (home) · Timeline (goals) · Corners · Us.
 * Guarded: only reachable once the couple is fully set up.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { status } = useSession();

  if (status === 'loading') return <Loading />;
  if (status !== 'ready') return <Redirect href={routeForStatus[status]} />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 64 + spacing.lg,
          paddingTop: spacing.sm,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
        },
        tabBarLabelStyle: {
          fontFamily: fontFamily.bodySemiBold,
          fontSize: 11,
        },
        tabBarItemStyle: { paddingTop: spacing.xs },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Den', tabBarIcon: icon(Dog) }}
      />
      <Tabs.Screen
        name="goals"
        options={{ title: 'Timeline', tabBarIcon: icon(ListChecks) }}
      />
      <Tabs.Screen
        name="corners"
        options={{ title: 'Corners', tabBarIcon: icon(MessagesSquare) }}
      />
      <Tabs.Screen
        name="us"
        options={{ title: 'Us', tabBarIcon: icon(Heart) }}
      />
    </Tabs>
  );
}

/** Build a tabBarIcon renderer for a Lucide icon (color/size supplied by the navigator). */
function icon(Glyph: LucideIcon) {
  const TabBarIcon = ({ color, size }: { color: ColorValue; size: number }) => (
    <Glyph color={color as string} size={size} strokeWidth={2.25} />
  );
  return TabBarIcon;
}
