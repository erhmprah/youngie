import { Image, ImageStyle, StyleProp } from 'react-native';

type BrandIconProps = {
  name: 'google' | 'apple';
  size?: number;
  style?: StyleProp<ImageStyle>;
};

const SOURCES = {
  google: require('@/assets/images/brand-google.png'),
  apple: require('@/assets/images/brand-apple.png'),
} as const;

export function BrandIcon({ name, size = 20, style }: BrandIconProps) {
  const width = name === 'apple' ? size * 0.81 : size;

  return (
    <Image
      source={SOURCES[name]}
      style={[{ width, height: size }, style]}
      resizeMode="contain"
    />
  );
}
