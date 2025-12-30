// components/ui/icon-symbol.tsx

import { Feather } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

// Define a mapping from a generic name to a Feather icon name
type IconMapping = {
  [key: string]: ComponentProps<typeof Feather>['name'];
};

// Use a more consistent and professional set of icons from Feather
const MAPPING: IconMapping = {
  'house.fill': 'home',
  'heart.fill': 'heart',
  'magnifyingglass': 'search',
  'message.fill': 'message-circle',
  'person.fill': 'user',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'plus': 'plus',
  'x': 'x',
  'settings': 'settings',
  'more-horizontal': 'more-horizontal',
  'edit': 'edit-2',
  'trash': 'trash-2',
  'camera': 'camera',
  'bell': 'bell',
  'lock': 'lock',
  'eye': 'eye',
  'eye-off': 'eye-off',
  'at-sign': 'at-sign',
  'calendar': 'calendar',
  'video.fill': 'video',
};

export type IconName = keyof typeof MAPPING;

/**
 * An icon component that uses Feather icons for a clean and modern look.
 * This component provides a consistent set of icons across all platforms.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
}) {
  const iconName = MAPPING[name];

  if (!iconName) {
    // Fallback for any unmapped icons
    return <Feather name="alert-circle" size={size} color={color} style={style} />;
  }

  return <Feather name={iconName} size={size} color={color} style={style} />;
}