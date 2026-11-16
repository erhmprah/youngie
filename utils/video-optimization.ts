import { Video } from 'react-native-compressor';
import { Platform } from 'react-native';

const MAX_VIDEO_DIMENSION = 1280;
const VIDEO_BITRATE = 2_500_000;
const MINIMUM_SIZE_TO_COMPRESS_MB = 2;

export async function compressVideoForUpload(uri: string): Promise<string> {
  if (Platform.OS === 'web') return uri;

  return Video.compress(uri, {
    compressionMethod: 'manual',
    maxSize: MAX_VIDEO_DIMENSION,
    bitrate: VIDEO_BITRATE,
    minimumFileSizeForCompress: MINIMUM_SIZE_TO_COMPRESS_MB,
  });
}
