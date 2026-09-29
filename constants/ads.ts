// AdMob configuration.
//
// The AdMob *App* ID lives in app.json (the "react-native-google-mobile-ads"
// config plugin) because the native SDK reads it at startup and crashes
// without it. The *ad unit* IDs live here because they are only needed by JS.
//
// In development we always use Google's official test ad units. Clicking a
// real ad unit in a debug build does nothing and AdMob suppresses the ad, so
// this guards against accidentally serving live ads to yourself or to testers.
//
// Test unit IDs provided for this project:
//   banner            ca-app-pub-3940256099942544/9214589741
//   interstitial     ca-app-pub-3940256099942544/1033173712
//   app open         ca-app-pub-3940256099942544/9257395921
//   native test      ca-app-pub-3940256099942544/2247696110
//
// @see https://developers.google.com/admob/android/test-ads
// @see https://developers.google.com/admob/ios/test-ads

import { Platform } from 'react-native';

const TEST_AD_UNITS = {
  android: {
    banner: 'ca-app-pub-3940256099942544/9214589741',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
    rewardedInterstitial: 'ca-app-pub-3940256099942544/5354046379',
    appOpen: 'ca-app-pub-3940256099942544/9257395921',
    native: 'ca-app-pub-3940256099942544/2247696110',
  },
  ios: {
    banner: 'ca-app-pub-3940256099942544/9214589741',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/1712485313',
    rewardedInterstitial: 'ca-app-pub-3940256099942544/6978759866',
    appOpen: 'ca-app-pub-3940256099942544/9257395921',
    native: 'ca-app-pub-3940256099942544/2247696110',
  },
} as const;

const PLATFORM_AD_UNITS = Platform.OS === 'ios' ? TEST_AD_UNITS.ios : TEST_AD_UNITS.android;

/** True in dev builds, where we substitute test creatives. */
export const usingTestAds = __DEV__;

function pickUnit(
  envKey: 'BANNER' | 'INTERSTITIAL' | 'REWARDED' | 'REWARDED_INTERSTITIAL' | 'APP_OPEN' | 'NATIVE',
  format: 'banner' | 'interstitial' | 'rewarded' | 'rewardedInterstitial' | 'appOpen' | 'native',
): string | null {
  const configured = process.env[`EXPO_PUBLIC_ADMOB_${envKey}_UNIT_ID`]?.trim();

  if (usingTestAds) return PLATFORM_AD_UNITS[format];
  if (configured) return configured;

  // Production build with no ad unit configured: stay silent rather than
  // handing the SDK an invalid ID, which throws and breaks the screen.
  console.warn(
    `[ads] No AdMob ${format} ad unit configured. Set EXPO_PUBLIC_ADMOB_${envKey}_UNIT_ID in .env to enable it.`,
  );
  return null;
}

export const AD_UNITS = {
  banner: pickUnit('BANNER', 'banner'),
  interstitial: pickUnit('INTERSTITIAL', 'interstitial'),
  rewarded: pickUnit('REWARDED', 'rewarded'),
  rewardedInterstitial: pickUnit('REWARDED_INTERSTITIAL', 'rewardedInterstitial'),
  appOpen: pickUnit('APP_OPEN', 'appOpen'),
  native: pickUnit('NATIVE', 'native'),
} as const;

export const isAdFormatEnabled = {
  banner: AD_UNITS.banner !== null,
  interstitial: AD_UNITS.interstitial !== null,
  rewarded: AD_UNITS.rewarded !== null,
  rewardedInterstitial: AD_UNITS.rewardedInterstitial !== null,
  appOpen: AD_UNITS.appOpen !== null,
  native: AD_UNITS.native !== null,
};