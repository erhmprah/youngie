// hooks/useInterstitialAdHelper.ts
//
// A thin wrapper around react-native-google-mobile-ads' useInterstitialAd
// that centralizes the three things every caller needs:
//   1. Load the ad as soon as the SDK is ready (and reload after it closes).
//   2. Gate every action on the AdsContext consent flag — never show an ad
//      before the user has consented, and never attempt to load when the
//      unit is unconfigured (which would throw on launch).
//   3. Expose a single `showIfNeeded()` that shows when ready and loads
//      otherwise, so call sites don't have to branch on isLoaded.

import { useCallback, useEffect } from 'react';
import { useInterstitialAd } from 'react-native-google-mobile-ads';
import { AD_UNITS } from '@/constants/ads';
import { useAds } from '@/contexts/AdsContext';

export function useInterstitialAdHelper() {
  const { canRequestAds } = useAds();
  const interstitial = useInterstitialAd(AD_UNITS.interstitial, {
    requestNonPersonalizedAdsOnly: true,
  });
  const { isLoaded, isShowing, isClosed, load, show } = interstitial;

  // Preload once consent resolves. Two gates, both required: the unit must be
  // configured, and consent must be granted — requesting an ad before consent
  // is a policy violation in the EEA and regulated US states, and the load
  // would be discarded anyway. Depends on canRequestAds so the preload is
  // kicked off the moment consent flips to true rather than only on mount.
  useEffect(() => {
    if (!canRequestAds || !AD_UNITS.interstitial) return;
    if (!isLoaded && !isShowing) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canRequestAds]);

  // When the ad closes, immediately preload the next one so the next
  // trigger doesn't pay the load latency.
  useEffect(() => {
    if (!canRequestAds || !AD_UNITS.interstitial) return;
    if (isClosed && !isShowing) {
      load();
    }
  }, [canRequestAds, isClosed, isShowing, load]);

  // Memoized for the same reason as the app open helper: callers use this in
  // dependency lists, and it calls load(), so an unstable identity would
  // re-trigger its own effect until React's update-depth limit trips.
  const showIfNeeded = useCallback(() => {
    if (!AD_UNITS.interstitial) return false;
    if (!canRequestAds) {
      if (__DEV__) console.log('[ads] interstitial skipped: no consent');
      return false;
    }
    if (isLoaded) {
      show();
      return true;
    }
    if (__DEV__) console.log('[ads] interstitial not ready, warming load');
    // Not ready yet — start the load so it's warm for the next trigger.
    load();
    return false;
  }, [canRequestAds, isLoaded, load, show]);

  return { isLoaded, isShowing, isClosed, showIfNeeded };
}