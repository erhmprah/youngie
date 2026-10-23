// components/ui/icon-symbol.tsx

import React, { useMemo , ComponentProps } from 'react';
import { Feather } from '@expo/vector-icons';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconColor = ComponentProps<typeof Feather>['color'];

// Define a mapping from a generic name to a Feather icon name
type IconMapping = {
  [key: string]: ComponentProps<typeof Feather>['name'];
};

// Use a more consistent and professional set of icons from Feather
const MAPPING: IconMapping = {
  // Navigation & UI
  'house.fill': 'home',
  'magnifyingglass': 'search',
  'compass': 'compass',
  'settings': 'settings',
  'x': 'x',
  'xmark': 'x',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'plus': 'plus',
  'more-horizontal': 'more-horizontal',
  'menu': 'menu',
  
  // Social & Interaction
  'heart.fill': 'heart',
  'message.fill': 'message-circle',
  'paperplane.fill': 'send',
  'bookmark': 'bookmark',
  'bookmark.fill': 'bookmark',
  'bell': 'bell',
  
  // User & Profile
  'person.fill': 'user',
  'person.2.fill': 'users',
  'person.2': 'users',
  'person.3.fill': 'users',
  'person.badge.plus': 'user-plus',
  'person.add': 'user-plus',
  'person.remove': 'user-minus',
  'person': 'user',
  'at-sign': 'at-sign',
  
  // Actions
  'edit': 'edit-2',
  'trash': 'trash-2',
  'camera': 'camera',
  'camera.fill': 'camera',
  'image': 'image',
  'images': 'image',
  'location': 'map-pin',
  'location.fill': 'map-pin',
  'checkmark': 'check',
  'checkmark.circle': 'check-circle',
  'checkmark.circle.fill': 'check-circle',
  'close': 'x',
  'close.circle': 'x-circle',
  'close.circle.fill': 'x-circle',
  'play': 'play',
  'play.fill': 'play',
  'video': 'video',
  'video.fill': 'video',
  'arrow.up': 'arrow-up',
  'arrowshape.turn.up.left': 'corner-up-left',
  'arrowshape.turn.up.right': 'corner-up-right',
  'paperclip': 'paperclip',
  'doc': 'file-text',
  'square.and.arrow.down': 'download',
  
  // Status & Notifications
  'read': 'check-circle',
  'alert': 'alert-triangle',
  'info': 'info',
  'warning': 'alert-triangle',

  // Ionicons-style names (compatibility with icons.ts ICONS constant)
  'checkmark-circle': 'check-circle',
  'checkmark-circle-outline': 'check-circle',
  'close-circle': 'x-circle',
  'close-circle-outline': 'x-circle',
  'alert-circle-outline': 'alert-circle',
  'information-circle-outline': 'info',
  'warning-outline': 'alert-triangle',

  // Additional icons
  'grid': 'grid',
  'photo.fill': 'image',
  'photo': 'image',
  'info.circle': 'info',
  'eyeglasses': 'eye',
  'headphones': 'headphones',
  'gamepad': 'play',
  'code': 'code',
  'globe': 'globe',
  'flag': 'flag',
  'log-out': 'log-out',
  'call': 'phone',
  'shield': 'shield',
  'star': 'star',
  'star.fill': 'star',
  'sparkles': 'star',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'eye': 'eye',
  'eye-off': 'eye-off',
  'volume-high': 'volume-2',
  'volume-mute': 'volume-x',
  'trophy': 'award',
  'link': 'link',
  'logout': 'log-out',
  'logout.fill': 'log-out',
  'phone': 'phone',
  'phone.fill': 'phone',
  'sparkles.fill': 'star',
  'alert-circle': 'alert-circle',
  'document-text': 'file-text',
  'chatbubble-ellipses': 'message-circle',
  'chatbubble': 'message-circle',
  'chatbubble-ellipses-outline': 'message-circle',
  'chevron.left.forwardslash.chevron.right': 'code',
  'primaryLight': 'star', // fallback for theme colors
  'calendar': 'calendar',
  'gear': 'settings',
  'slider.horizontal.3': 'sliders',
  'chart.bar.fill': 'bar-chart-2',
  'textformat.size': 'type',
  'ellipsis': 'more-horizontal',
  'eye.fill': 'eye',
  'xmark.circle.fill': 'x-circle',
  'person.slash': 'user-x',
  'lock': 'lock',
  'moon': 'moon',
  'sun.max': 'sun',
  'sun.max.fill': 'sun',
  'device-phone-portrait': 'smartphone',
  'shield-check': 'award',
  'help-circle': 'help-circle',
  'logo-google': 'log-in',
  // Additional missing icons
  'envelope.badge': 'mail',
  'envelope': 'mail',
  'questionmark.circle': 'help-circle',
  'mic.slash.fill': 'mic-off',
  'mic.fill': 'mic',
  'speaker.wave.2.fill': 'volume-2',
  'speaker.fill': 'volume-2',
  'phone.down.fill': 'phone-off',
  'app': 'info',
  'arrow.uturn.backward': 'rotate-ccw',
  'rectangle.stack': 'layers',
  'pause.fill': 'pause',
  'pause.circle.fill': 'pause-circle',
   'square.grid.2x2': 'grid',
  'clock': 'clock',
  'heart': 'heart',
  'mail.fill': 'mail',
  'message': 'message-circle',
  'paperplane': 'send',
  'speaker.slash': 'volume-x',
  'arrow.left': 'arrow-left',
  'lock.shield': 'shield',
  'doc.text': 'file-text',
  'person.3': 'users',
  'chart.bar': 'bar-chart-2',
  'exclamationmark.triangle': 'alert-triangle',
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
  color: IconColor;
  style?: StyleProp<TextStyle>;
}) {
  // Memoize the icon lookup to avoid recomputation on re-renders
  const iconName = useMemo(() => MAPPING[name], [name]);

  if (!iconName) {
    return <Feather name="alert-circle" size={size} color={color} style={style} />;
  }

  return <Feather name={iconName} size={size} color={color} style={style} />;
}