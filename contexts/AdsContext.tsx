import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

// The SDK is native-only. Importing it on web (or in a test renderer) throws
// at module scope, so load it defensively — the same pattern the root layout
// already uses for expo-notifications.
let MobileAds: typeof import('react-native-google-mobile-ads')['MobileAds'] | null = null;
let AdsConsent: typeof import('react-native-google-mobile-ads')['AdsConsent'] | null = null;
let AdsConsentStatus: typeof import('react-native-google-mobile-ads')['AdsConsentStatus'] | null = null;
let SDK_VERSION: string | null = null;
if (Platform.OS !== 'web') {
  try {
    const ads = require('react-native-google-mobile-ads');
    MobileAds = ads.MobileAds;
    AdsConsent = ads.AdsConsent;
    AdsConsentStatus = ads.AdsConsentStatus;
    SDK_VERSION = ads.SDK_VERSION;
  } catch (e) {
    console.warn('react-native-google-mobile-ads unavailable, ads disabled', e);
  }
}

type AdsState = {
  /** True once MobileAds.initialize() has resolved. Banners must not render before this. */
  isInitialized: boolean;
  /** True when ads may be requested. False means consent is missing, so nothing should render. */
  canRequestAds: boolean;
  /** Diagnostic for the debug screen. */
  sdkVersion: string | null;
};

const AdsContext = createContext<AdsState>({
  isInitialized: false,
  canRequestAds: false,
  sdkVersion: null,
});

export function useAds(): AdsState {
  return useContext(AdsContext);
}

/**
 * Child-directed treatment. AdMob requires this flag to be set truthfully — a
 * social app that can be used by under-13s is treated as child-directed, which
 * restricts ad targeting and blocks interest-based ads entirely. It also
 * controls whether personalized ads are permitted.
 */
function resolveChildDirectedTreatment(): boolean {
  const raw = process.env.EXPO_PUBLIC_ADMOB_CHILD_DIRECTED?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Default to treating the app as child-directed: the safe default if the
  // app has no verified age gate, since misdeclaring adult-only can get the
  // account suspended. Set EXPO_PUBLIC_ADMOB_CHILD_DIRECTED=false in .env once
  // age gating is confirmed in place.
  return true;
}

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [canRequestAds, setCanRequestAds] = useState(false);
  const [sdkVersion, setSdkVersion] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!MobileAds || !AdsConsent) return;
    // React StrictMode double-invokes effects in dev, and initialize() is not
    // idempotent, so guard on a ref as well as component state.
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function initAds() {
      try {
        await MobileAds!().setRequestConfiguration({
          tagForChildDirectedTreatment: resolveChildDirectedTreatment(),
        });
      } catch (e) {
        console.warn('[ads] failed to set request configuration', e);
      }

      // Consent must resolve BEFORE initialize(): app.json sets
      // delayAppMeasurementInit: true, which suppresses the automatic startup
      // ad request. Requesting ads before consent is a policy violation in the
      // EEA and in regulated US states.
      let consentGranted = false;
      try {
        // Deliberately requestInfoUpdate() + conditional form rather than
        // gatherConsent(): gatherConsent always attempts to load a form, and
        // that throws "no form(s) configured for the input app ID" for any app
        // without a UMP message published in the AdMob console. Outside the EEA
        // no consent is required, so that failure must not be mistaken for a
        // refusal — it previously suppressed every ad in the app for the whole
        // session.
        let info = await AdsConsent!.requestInfoUpdate();
        if (__DEV__) {
          console.log(
            `[ads] consent status=${info.status} formAvailable=${info.isConsentFormAvailable} canRequestAds=${info.canRequestAds}`,
          );
        }

        // Only show a form when one exists AND consent is still outstanding.
        if (
          !info.canRequestAds &&
          info.isConsentFormAvailable &&
          (info.status === AdsConsentStatus!.UNKNOWN || info.status === AdsConsentStatus!.REQUIRED)
        ) {
          try {
            info = await AdsConsent!.loadAndShowConsentFormIfRequired();
          } catch (e) {
            // A form failure (including "no forms configured") must not block
            // ads that need no consent. Fall through to the status below.
            console.warn('[ads] consent form unavailable, using info update result', e);
          }
        }

        consentGranted = info.canRequestAds;
      } catch (e) {
        // A consent failure must never take the app down. Default to "no ads"
        // for this session — showing ads with unknown consent status is the
        // riskier failure, and the next launch will retry.
        console.warn('[ads] consent collection failed, serving no ads this session', e);
      }
      if (cancelled) return;
      setCanRequestAds(consentGranted);

      try {
        await MobileAds!().initialize();
        if (cancelled) return;
        setIsInitialized(true);
        setSdkVersion(SDK_VERSION);
        if (__DEV__) {
          console.log(`[ads] Google Mobile Ads ${SDK_VERSION} ready (canRequestAds=${consentGranted})`);
        }
      } catch (e) {
        console.warn('[ads] Mobile Ads initialization failed', e);
      }
    }

    initAds();

    return () => {
      cancelled = true;
    };
  }, []);

  // Re-check consent when the app returns to the foreground: the user may have
  // changed their privacy options, and Google requires a fresh check before
  // each new ad request session.
  useEffect(() => {
    if (!AdsConsent || !isInitialized) return;

    const subscription = AppState.addEventListener('change', async (next) => {
      if (next !== 'active') return;
      try {
        const info = await AdsConsent!.getConsentInfo();
        setCanRequestAds(info.canRequestAds);
      } catch (e) {
        console.warn('[ads] consent re-check failed', e);
      }
    });

    return () => subscription.remove();
  }, [isInitialized]);

  const value = useMemo(
    () => ({ isInitialized, canRequestAds, sdkVersion }),
    [isInitialized, canRequestAds, sdkVersion],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}
