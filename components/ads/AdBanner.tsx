import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AD_UNITS } from '@/constants/ads';
import { useAds } from '@/contexts/AdsContext';
import { useTheme } from '@/contexts/ThemeContext';

let BannerAd: typeof import('react-native-google-mobile-ads')['BannerAd'] | null = null;
let BannerAdSize: typeof import('react-native-google-mobile-ads')['BannerAdSize'] | null = null;
if (Platform.OS !== 'web') {
  try {
    BannerAd = require('react-native-google-mobile-ads').BannerAd;
    BannerAdSize = require('react-native-google-mobile-ads').BannerAdSize;
  } catch (e) {
    console.warn('[ads] BannerAd unavailable', e);
  }
}

/** Cap inline adaptive height so a banner can never eat the whole screen. */
const MAX_BANNER_HEIGHT = 250;

type AdBannerProps = {
  /** Distance from the bottom edge, used when `position="bottom"`. */
  bottomInset?: number;
  position?: 'inline' | 'bottom';
  style?: object;
};

/**
 * A Google AdMob banner.
 *
 * Renders nothing at all when ads are unavailable — no ad unit configured, SDK
 * not ready yet, consent not granted, or running on web. Callers can mount it
 * unconditionally without guarding.
 */
export default function AdBanner({ bottomInset = 0, position = 'inline', style }: AdBannerProps) {
  const { isInitialized, canRequestAds } = useAds();
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  // Guards against a slow ad request resolving after the component unmounts
  // and calling setState on a dead component.
  const mountedRef = useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSizeChange = useCallback((dimensions: { width: number; height: number }) => {
    if (!mountedRef.current) return;
    setHeight(dimensions.height);
  }, []);

  const handleFailedToLoad = useCallback((error: Error) => {
    if (!mountedRef.current) return;
    // No-fill is expected and common (especially on new ad units, which can
    // take hours to start filling). Don't surface it as an app error.
    console.log('[ads] banner failed to load:', error?.message);
  }, []);

  const unitId = AD_UNITS.banner;

  // Every bail-out below is otherwise silent, so a banner that never appears
  // gives no clue why. Name the missing precondition instead.
  let blockedBy: string | null = null;
  if (!BannerAd || !BannerAdSize) blockedBy = 'native-module';
  else if (!unitId) blockedBy = 'no-unit-configured';
  else if (!isInitialized) blockedBy = 'sdk-not-initialized';
  else if (!canRequestAds) blockedBy = 'no-consent';

  React.useEffect(() => {
    if (__DEV__ && blockedBy) console.log(`[ads] banner not rendering: ${blockedBy}`);
  }, [blockedBy]);

  if (!BannerAd || !BannerAdSize || !unitId || !isInitialized || !canRequestAds) {
    return null;
  }

  const banner = (
    <View style={[styles.banner, style]}>
      <BannerAd
        unitId={unitId}
        // Adaptive so the creative fills the screen width on every device
        // rather than letterboxing a fixed 320x50.
        size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
        width={width}
        maxHeight={MAX_BANNER_HEIGHT}
        onSizeChange={handleSizeChange}
        onAdFailedToLoad={handleFailedToLoad}
      />
    </View>
  );

  if (position === 'inline') {
    // Without a height the banner collapses to 0 and the content below jumps
    // once the creative loads. minHeight keeps the slot stable either way.
    return <View style={[styles.slot, { minHeight: height || 0 }]}>{banner}</View>;
  }

  return (
    <View
      style={[
        styles.fixed,
        {
          paddingBottom: Math.max(insets.bottom, bottomInset),
          backgroundColor: theme === 'dark' ? '#000000' : '#ffffff',
        },
      ]}
    >
      {banner}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: '100%',
    alignItems: 'center',
  },
  banner: {
    width: '100%',
  },
  fixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
