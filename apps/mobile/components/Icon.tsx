import { Ionicons } from '@expo/vector-icons';
import { ColorValue } from 'react-native';

/**
 * One semantic icon layer for the whole app. Components ask for an *app
 * concept* ("send", "lock", "call") rather than a specific glyph, so the
 * underlying icon set can change in one place. Clean line icons (Ionicons),
 * never emoji — consistent, crisp at any size, theme-tintable.
 */
const MAP = {
  // Navigation / tabs
  chat: 'chatbubble-ellipses',
  chatOutline: 'chatbubble-ellipses-outline',
  status: 'aperture',
  statusOutline: 'aperture-outline',
  people: 'people',
  peopleOutline: 'people-outline',
  settings: 'settings',
  settingsOutline: 'settings-outline',
  back: 'chevron-back',
  forward: 'chevron-forward',
  close: 'close',
  search: 'search',
  more: 'ellipsis-vertical',

  // Calls
  call: 'call',
  callEnd: 'call', // rendered rotated where needed
  video: 'videocam',
  videoOff: 'videocam-off',
  mic: 'mic',
  micOff: 'mic-off',
  speaker: 'volume-high',
  speakerOff: 'volume-mute',
  flipCamera: 'camera-reverse',

  // Messaging
  send: 'send',
  attach: 'add-circle',
  image: 'image',
  camera: 'camera',
  voice: 'mic',
  compose: 'create',
  doubleCheck: 'checkmark-done',
  play: 'play',
  pause: 'pause',

  // Privacy / vault
  lock: 'lock-closed',
  unlock: 'lock-open',
  key: 'key',
  shield: 'shield-checkmark',
  eye: 'eye',
  eyeOff: 'eye-off',
  blur: 'water',
  grid: 'grid',
  moon: 'moon',
  p2p: 'git-compare',
  broadcast: 'radio',

  // Misc actions
  add: 'add',
  edit: 'pencil',
  trash: 'trash',
  save: 'download',
  bell: 'notifications',
  signout: 'log-out',
  heart: 'heart',
  palette: 'color-palette',
  check: 'checkmark',
  info: 'information-circle',
  person: 'person',
  phonePortrait: 'phone-portrait',
  mail: 'mail',
  sparkles: 'sparkles',
} as const;

export type IconName = keyof typeof MAP;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: ColorValue;
  /** Degrees of rotation (e.g. 135 to turn `call` into a hang-up glyph). */
  rotate?: number;
}

export function Icon({ name, size = 22, color = '#fff', rotate }: IconProps) {
  return (
    <Ionicons
      name={MAP[name]}
      size={size}
      color={color}
      style={rotate ? { transform: [{ rotate: `${rotate}deg` }] } : undefined}
    />
  );
}
