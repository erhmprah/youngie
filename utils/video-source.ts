import type { VideoSource } from 'expo-video';

export function getVideoSource(uri: string | null | undefined): VideoSource {
  if (!uri) return null;

  const isCacheableRemoteVideo =
    /^https?:\/\//i.test(uri) && !/\.m3u8(?:[?#]|$)/i.test(uri);

  return isCacheableRemoteVideo
    ? { uri, useCaching: true }
    : { uri };
}
