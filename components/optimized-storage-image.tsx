import { getImageUrl, type StorageImageTransform } from '@/utils/api';
import { Image, type ImageProps } from 'expo-image';
import { useState } from 'react';

interface OptimizedStorageImageProps extends Omit<ImageProps, 'source'> {
  imagePath?: string;
  transform: StorageImageTransform;
}

export function OptimizedStorageImage({
  imagePath,
  transform,
  onError,
  ...imageProps
}: OptimizedStorageImageProps) {
  const originalUrl = getImageUrl(imagePath);
  const transformedUrl = getImageUrl(imagePath, transform);
  const [failedTransformUrl, setFailedTransformUrl] = useState<string | null>(null);

  if (!originalUrl || !transformedUrl) return null;

  const useOriginal = transformedUrl === failedTransformUrl || transformedUrl === originalUrl;
  const uri = useOriginal ? originalUrl : transformedUrl;

  return (
    <Image
      {...imageProps}
      source={{ uri }}
      onError={(event) => {
        if (!useOriginal) {
          setFailedTransformUrl(transformedUrl);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
