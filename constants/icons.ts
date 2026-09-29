/**
 * Consistent icon definitions across the app
 * All using Ionicons for a cohesive, fancy design
 */

export const ICONS = {
  // Navigation & UI
  back: 'chevron-back',
  forward: 'chevron-forward',
  menu: 'menu-outline',
  close: 'close',
  search: 'search-outline',
  filter: 'options-outline',
  settings: 'settings-outline',

  // Social & Interaction
  heart: 'heart',
  heartOutline: 'heart-outline',
  thumbsUp: 'thumbs-up-outline',
  message: 'chatbubble-outline',
  messageFilled: 'chatbubble',
  send: 'paper-plane-outline',
  sendFilled: 'arrow-up',
  share: 'share-social-outline',
  bookmark: 'bookmark-outline',
  bookmarkFilled: 'bookmark',

  // User & Profile
  person: 'person-circle',
  personOutline: 'person-outline',
  personAdd: 'person-add-outline',
  personRemove: 'person-remove-outline',
  people: 'people-outline',
  avatar: 'person-circle-outline',

  // Actions
  add: 'add-circle-outline',
  addFilled: 'add',
  camera: 'camera-outline',
  cameraFilled: 'camera',
  image: 'image-outline',
  images: 'images-outline',
  edit: 'pencil-outline',
  delete: 'trash-outline',
  download: 'download-outline',
  upload: 'cloud-upload-outline',

  // Status & Notifications
  notification: 'notifications-outline',
  notificationFilled: 'notifications',
  bell: 'notifications-outline',
  checkmark: 'checkmark-circle',
  checkmarkOutline: 'checkmark-circle-outline',
  success: 'checkmark-circle',
  error: 'close-circle',
  alert: 'alert-circle-outline',
  info: 'information-circle-outline',
  warning: 'warning-outline',

  // Location & Map
  location: 'location-outline',
  locationFilled: 'location',
  map: 'map-outline',

  // Additional
  logout: 'log-out-outline',
  logoutFilled: 'log-out',
  phone: 'call-outline',
  phoneFilled: 'call',
  shield: 'shield-checkmark-outline',
  star: 'star-outline',
  starFilled: 'star',
  flag: 'flag-outline',
  link: 'link-outline',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  volumeUp: 'volume-high',
  volumeMute: 'volume-mute',

  // Badges & Achievements
  trophy: 'trophy',
  ribbon: 'ribbon-outline',
  sparkles: 'sparkles',
  fire: 'flame',

  // Testing & Development
  flask: 'flask',
  bug: 'bug-outline',
  code: 'code-outline',

  // Additional missing icons
  play: 'play',
  closeCircle: 'close-circle',
  video: 'videocam-outline',
  ellipsis: 'ellipsis-horizontal',
  arrowUp: 'arrow-up',
  chatbubbleEllipses: 'chatbubble-ellipses-outline',
  alertCircle: 'alert-circle-outline',
  documentText: 'document-text-outline',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
} as const;

// Icon sizes
export const ICON_SIZES = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 26,
  xl: 30,
  xxl: 36,
  huge: 42,
  massive: 56,
};
