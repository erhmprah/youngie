import { Image } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export async function compressImageForUpload(
  uri: string,
  maxDimension = 1600,
  quality = 0.78,
): Promise<string> {
  const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    Image.getSize(uri, (imageWidth, imageHeight) => {
      resolve({ width: imageWidth, height: imageHeight });
    }, reject);
  });

  const resize = Math.max(width, height) > maxDimension
    ? [{ resize: width >= height ? { width: maxDimension } : { height: maxDimension } }]
    : [];
  const result = await manipulateAsync(uri, resize, {
    base64: true,
    compress: quality,
    format: SaveFormat.JPEG,
  });

  if (!result.base64) {
    throw new Error('Image compression did not return image data.');
  }

  return `data:image/jpeg;base64,${result.base64}`;
}
