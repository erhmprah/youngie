// utils/app-version.ts
// Checks the backend for the current published app version and determines
// whether the running build must/should update.

import React from 'react';
import { Linking, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { appAPI } from '@/utils/api';
import { UpdateAvailableAlert } from '@/components/ui/UpdateAvailableAlert';

interface AppVersionState {
  visible: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  newVersion: string;
  releaseNotes?: string;
  storeUrl?: string;
}

let updateAlertState: AppVersionState = {
  visible: false,
  forceUpdate: false,
  currentVersion: '0.0.0',
  newVersion: '0.0.0',
  releaseNotes: undefined,
  storeUrl: undefined,
};

let setUpdateAlertState: React.Dispatch<React.SetStateAction<AppVersionState>> | null = null;

export function useUpdateAlert() {
  const [state, setState] = React.useState<AppVersionState>(updateAlertState);
  setUpdateAlertState = setState;
  return state;
}

export function getUpdateAlertState(): AppVersionState {
  return updateAlertState;
}

export function setUpdateAlertStateDirect(state: AppVersionState) {
  updateAlertState = state;
  if (setUpdateAlertState) {
    setUpdateAlertState(state);
  }
}

// Store URLs used to open update pages when an update is available.
const STORE_URLS: Record<string, string> = {
  ios: 'https://apps.apple.com/app/idXXXXXXXXX',
  android: 'https://play.google.com/store/apps/details?id=com.erhmprah.youngie',
};

function getPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

// Returns the running app version, e.g. "1.0.0". Prefers the native version
// (reliable on built release APKs for both Android and iOS) and falls back to
// the Expo manifest version.
export function getAppVersion(): string {
  const nativeVersion = Application.nativeApplicationVersion;
  if (nativeVersion) return nativeVersion;

  const manifestVersion =
    (Constants.expoConfig as { version?: string } | undefined)?.version ??
    (Constants.manifest as { version?: string } | undefined)?.version;
  return manifestVersion ?? '0.0.0';
}

// Normalizes a version string into a comparable number array.
function parseVersion(version: string): number[] {
  return (version || '0.0.0')
    .split('.')
    .map((part) => parseInt(part.replace(/\D/g, ''), 10) || 0);
}

// Compares two version arrays. Returns > 0 if a > b, < 0 if a < b, 0 if equal.
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  const length = Math.max(va.length, vb.length);
  for (let i = 0; i < length; i++) {
    const diff = (va[i] || 0) - (vb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

interface AppVersionResponse {
  version: string;
  forceUpdate?: boolean;
  minSupportedVersion?: string;
  releaseNotes?: string;
  platform?: string;
}

/**
 * Fetches the current published version for this platform and, when an update
 * is available, surfaces a dedicated update alert. For force updates the
 * alert cannot be dismissed.
 */
export async function checkAppVersion(options?: { showNoUpdate?: boolean }): Promise<void> {
  try {
    const platform = getPlatform();
    const response = await appAPI.getCurrentVersion(platform);
    const data: AppVersionResponse = response.data;

    if (!data || !data.version) return;

    const currentVersion = getAppVersion();
    const isNewer = compareVersions(data.version, currentVersion) > 0;
    const belowMin = data.minSupportedVersion
      ? compareVersions(currentVersion, data.minSupportedVersion) < 0
      : false;

    const forceUpdate = !!data.forceUpdate || belowMin;

    if (!isNewer && !belowMin) {
      if (options?.showNoUpdate) {
        console.log('App is up to date:', currentVersion);
      }
      return;
    }

    const storeUrl = STORE_URLS[platform];

    setUpdateAlertStateDirect({
      visible: true,
      forceUpdate,
      currentVersion,
      newVersion: data.version,
      releaseNotes: data.releaseNotes,
      storeUrl,
    });
  } catch (error) {
    console.warn('App version check failed:', error);
  }
}
