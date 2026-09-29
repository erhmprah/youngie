// hooks/useAppOpenAdHelper.ts
//
// An App Open Ad is a full-screen ad shown when the app returns to the
// foreground. Unlike an interstitial, it's not tied to a user action — it
// fires on its own schedule, so it must be loaded eagerly and shown only when
// a load has actually completed. Showing it before the SDK is ready (or
// before consent is granted) is a policy violation, which is why both gates
// live here rather than in the caller.
//
// The helper exposes a single `showIfReady()` that returns true when it
// showed the ad, so the caller can decide what to do on dismiss (usually:
// nothing — the app is already where the user left it).

import { useCallback, useEffect, useRef } from 'react';
import { useAppOpenAd } from 'react-native-google-mobile-ads';
import { AD_UNITS } from '@/constants/ads';
import { useAds } from '@/contexts/AdsContext';

// Prevents the ad from firing again immediately after it closes — the cooldown
// is long enough to avoid feeling repetitive, short enough to be worth
// anything to the ad account. Module scope so the callback below can read it
// without taking it as a dependency.
const APP_OPEN_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes

export function useAppOpenAdHelper() {
  const { canRequestAds } = useAds();
  const appOpen = useAppOpenAd(AD_UNITS.appOpen, {
    requestNonPersonalizedAdsOnly: true,
  });
  const { isLoaded, isShowing, isClosed, load, show } = appOpen;
  const lastShownRef = useRef(0);

  // Load as soon as consent resolves. An App Open Ad fires on its own schedule
  // with no user action behind it, so it is the strictest of the formats:
  // loading before consent is granted is a policy violation regardless of
  // whether the ad would actually be shown. Depends on canRequestAds so the
  // preload starts the moment consent flips to true.
  useEffect(() => {
    if (!canRequestAds || !AD_UNITS.appOpen) return;
    if (!isLoaded && !isShowing) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRequestAds]);

  // Reload after close so the next foregrounding is warm. Gated on consent for
  // the same reason the initial preload is.
  useEffect(() => {
    if (!canRequestAds || !AD_UNITS.appOpen) return;
    if (isClosed && !isShowing) {
      load();
    }
  }, [canRequestAds, isClosed, isShowing, load]);

  // Memoized because callers put this in a useEffect dependency list. An
  // unstable identity re-runs that effect every render, and since this calls
  // load() (which sets state) the effect would re-trigger itself indefinitely
  // and blow the "Maximum update depth exceeded" limit.
  const showIfReady = useCallback((): boolean => {
    if (!AD_UNITS.appOpen) return false;
    if (!canRequestAds) return false;
    if (!isLoaded) {
      // Warm the load so the next foregrounding can show immediately.
      load();
      return false;
    }
    const now = Date.now();
    if (now - lastShownRef.current < APP_OPEN_COOLDOWN_MS) {
      if (__DEV__) console.log('[ads] app open suppressed by cooldown');
      return false;
    }
    lastShownRef.current = now;
    show();
    return true;
  }, [canRequestAds, isLoaded, load, show]);

  // The helper exposes `showIfReady` alongside the raw hook state; callers
  // generally only need the former.
  return { isLoaded, isShowing, isClosed, showIfReady };
}