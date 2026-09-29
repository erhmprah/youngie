// components/AppOpenAdProvider.tsx
//
// Wraps the app tree and shows an App Open Ad when the user returns to the
// foreground. Lives inside AdsProvider so it can read the consent flag, and
// is mounted once at the root so it survives navigation.
//
// The ad is opt-in: if the unit is unconfigured or consent is missing, nothing
// is loaded and nothing is shown. The 3-minute cooldown prevents the ad from
// firing on every background/foreground cycle, which would read as spam.

import React, { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppOpenAdHelper } from '@/hooks/useAppOpenAdHelper';

export function AppOpenAdProvider({ children }: { children: React.ReactNode }) {
  const { showIfReady } = useAppOpenAdHelper();

  useEffect(() => {
    // Web has no foreground/background lifecycle in the way the native SDK
    // expects, and the ad hooks are native-only.
    if (Platform.OS === 'web') return;

    // Show once on mount if the app is already active (e.g. a cold start
    // where the SDK finished initializing before this effect ran).
    if (AppState.currentState === 'active') {
      showIfReady();
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        showIfReady();
      }
    });

    return () => subscription.remove();
  }, [showIfReady]);

  return <>{children}</>;
}