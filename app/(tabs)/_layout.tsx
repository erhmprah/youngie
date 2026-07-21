// app/(tabs)/_layout.tsx

import { Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ChatTabIcon } from '@/components/chat-tab-icon';
import { FirstStartupHint } from '@/components/FirstStartupHint';
import { useThemeColor } from '@/hooks/use-theme-color';
import { shadows, typography, sizes } from '@/constants/design-tokens';
import { verticalScale } from '@/utils/scale';

export default function TabLayout() {
  const activeTintColor = useThemeColor('primary');
  const inactiveTintColor = useThemeColor('lightText');
  const backgroundColor = useThemeColor('surface');
  const borderTopColor = useThemeColor('border');

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: activeTintColor,
          tabBarInactiveTintColor: inactiveTintColor,
          headerShown: false,
          tabBarButton: HapticTab,
          tabBarStyle: [
            styles.tabBar,
            {
              backgroundColor: backgroundColor,
              borderTopColor: borderTopColor,
              paddingBottom: 8,
            },
          ],
          tabBarLabelStyle: styles.tabBarLabel,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="swipe"
          options={{
            title: 'Swipe',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="heart.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="magnifyingglass" color={color} />,
          }}
        />
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarIcon: ({ color }) => <ChatTabIcon color={color} />,
          }}
        />
        <Tabs.Screen
          name="videochat"
          options={{
            title: 'Video Chat',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="video.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
          }}
        />
      </Tabs>

      <FirstStartupHint />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: verticalScale(80),
    borderTopWidth: sizes.dividerWidth,
    ...shadows.sm,
  },
  tabBarLabel: {
    fontSize: typography.sizes.tiny,
    fontFamily: typography.families.medium,
    marginTop: 0,
  },
});
