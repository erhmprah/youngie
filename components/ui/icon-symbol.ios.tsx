import { SymbolView, SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { StyleProp, ViewStyle } from 'react-native';

// Map app icon names (Feather / Apple style) to valid SF Symbol names.
// SymbolView renders nothing for unknown SF Symbol names, so every app icon
// name must resolve to a real SF Symbol (or a safe fallback).
const SF_SYMBOLS: Record<string, string> = {
  // Navigation & UI
  'house.fill': 'house.fill',
  'magnifyingglass': 'magnifyingglass.circle.fill',
  'compass': 'compass',
  'settings': 'gear',
  'gear': 'gear',
  'x': 'xmark',
  'xmark': 'xmark',
  'chevron.left': 'chevron.left',
  'chevron.right': 'chevron.right',
  'chevron.down': 'chevron.down',
  'chevron.up': 'chevron.up',
  'chevron.left.forwardslash.chevron.right': 'chevron.left.forwardslash.chevron.right',
  'plus': 'plus',
  'more-horizontal': 'ellipsis',
  'ellipsis': 'ellipsis',
  'menu': 'list.bullet',

  // Social & Interaction
  'heart.fill': 'heart.fill',
  'heart': 'heart',
  'message.fill': 'message.fill',
  'message': 'message',
  'paperplane.fill': 'paperplane.fill',
  'paperplane': 'paperplane',
  'bookmark': 'bookmark',
  'bookmark.fill': 'bookmark.fill',
  'bell': 'bell',

  // User & Profile
  'person.fill': 'person.fill',
  'person.2.fill': 'person.2.fill',
  'person.2': 'person.2',
  'person.3.fill': 'person.3.fill',
  'person.3': 'person.3',
  'person.badge.plus': 'person.badge.plus',
  'person.add': 'person.badge.plus',
  'person.remove': 'person.minus',
  'person.slash': 'person.slash',
  'person': 'person',
  'at-sign': 'at',

  // Actions
  'edit': 'square.and.pencil',
  'trash': 'trash',
  'camera': 'camera',
  'camera.fill': 'camera.fill',
  'image': 'photo',
  'images': 'photo',
  'photo.fill': 'photo.fill',
  'photo': 'photo',
  'location': 'location',
  'location.fill': 'location.fill',
  'checkmark': 'checkmark',
  'checkmark.circle': 'checkmark.circle',
  'checkmark.circle.fill': 'checkmark.circle.fill',
  'close': 'xmark',
  'close.circle': 'xmark.circle',
  'close.circle.fill': 'xmark.circle.fill',
  'play': 'play.fill',
  'play.fill': 'play.fill',
  'video': 'video',
  'video.fill': 'video.fill',
  'arrow.up': 'arrow.up',
  'arrow.down': 'arrow.down',
  'arrow.left': 'arrow.left',
  'arrow.right': 'arrow.right',
  'arrowshape.turn.up.left': 'arrowshape.turn.up.left',
  'arrowshape.turn.up.right': 'arrowshape.turn.up.right',
  'arrow.uturn.backward': 'arrow.uturn.backward',
  'paperclip': 'paperclip',
  'doc': 'doc',
  'doc.text': 'doc.text',
  'square.and.arrow.down': 'square.and.arrow.down',

  // Status & Notifications
  'read': 'checkmark.circle',
  'alert': 'exclamationmark.triangle',
  'info': 'info.circle',
  'warning': 'exclamationmark.triangle',

  // Ionicons-style names
  'checkmark-circle': 'checkmark.circle',
  'checkmark-circle-outline': 'checkmark.circle',
  'close-circle': 'xmark.circle',
  'close-circle-outline': 'xmark.circle',
  'alert-circle-outline': 'exclamationmark.triangle',
  'information-circle-outline': 'info.circle',
  'warning-outline': 'exclamationmark.triangle',

  // Additional icons
  'grid': 'square.grid.2x2',
  'info.circle': 'info.circle',
  'eyeglasses': 'eyeglasses',
  'headphones': 'headphones',
  'gamepad': 'gamepad',
  'code': 'chevron.left.forwardslash.chevron.right',
  'globe': 'globe',
  'flag': 'flag',
  'log-out': 'arrow.right.to.line',
  'logout': 'arrow.right.to.line',
  'call': 'phone',
  'shield': 'shield',
  'star': 'star.fill',
  'star.fill': 'star.fill',
  'sparkles': 'sparkles',
  'sparkles.fill': 'star.fill',
  'volume-high': 'speaker.wave.2.fill',
  'volume-mute': 'speaker.slash',
  'trophy': 'trophy',
  'link': 'link',
  'phone': 'phone',
  'phone.fill': 'phone.fill',
  'alert-circle': 'exclamationmark.triangle',
  'document-text': 'doc.text',
  'chatbubble-ellipses': 'message',
  'chatbubble': 'message',
  'chatbubble-ellipses-outline': 'message',
  'calendar': 'calendar',
  'slider.horizontal.3': 'slider.horizontal.3',
  'chart.bar.fill': 'chart.bar.fill',
  'chart.bar': 'chart.bar',
  'textformat.size': 'textformat.size',
  'moon': 'moon',
  'sun.max': 'sun.max.fill',
  'sun.max.fill': 'sun.max.fill',
  'device-phone-portrait': 'iphone',
  'shield-check': 'checkmark.shield',
  'help-circle': 'questionmark.circle',
  'logo-google': 'g.circle.fill',
  'envelope.badge': 'envelope.badge',
  'envelope': 'envelope',
  'mail': 'envelope',
  'mail.fill': 'envelope.fill',
  'questionmark.circle': 'questionmark.circle',
  'mic.slash.fill': 'mic.slash.fill',
  'mic.fill': 'mic.fill',
  'speaker.fill': 'speaker.wave.2.fill',
  'speaker.wave.2.fill': 'speaker.wave.2.fill',
  'speaker.slash': 'speaker.slash',
  'phone.down.fill': 'phone.down.fill',
  'app': 'info.circle',
  'rectangle.stack': 'layers',
  'pause.fill': 'pause.fill',
  'pause.circle.fill': 'pause.circle.fill',
  'square.grid.2x2': 'square.grid.2x2',
  'clock': 'clock',
  'exclamationmark.triangle': 'exclamationmark.triangle',
  'lock': 'lock',
  'lock.shield': 'lock.shield',
};

const FALLBACK: SymbolViewProps['name'] = 'exclamationmark.triangle';

export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: SymbolViewProps['name'];
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  const sfName = (SF_SYMBOLS[name as string] ?? name) as SymbolViewProps['name'] || FALLBACK;

  return (
    <SymbolView
      weight={weight}
      tintColor={color}
      resizeMode="scaleAspectFit"
      name={sfName}
      style={[
        {
          width: size,
          height: size,
        },
        style,
      ]}
    />
  );
}
