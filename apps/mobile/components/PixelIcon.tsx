import { View, ColorValue } from 'react-native';

/**
 * Dependency-free pixel-art icons. Each glyph is a small bitmap (rows of
 * '1'/'0') rendered as a grid of square Views, so they're crisp at any
 * size and tint to any colour — no icon font, no SVG, no emoji.
 *
 * Add a new icon by dropping another bitmap into ICONS (square grids only).
 */
const ICONS: Record<string, string[]> = {
  // Speech bubble — Chats
  chat: [
    '0111110',
    '1111111',
    '1111111',
    '1111111',
    '0111110',
    '0011000',
    '0010000',
  ],
  // Concentric ring — Status
  status: [
    '0011100',
    '0111110',
    '1100011',
    '1100011',
    '1100011',
    '0111110',
    '0011100',
  ],
  // Two people — Requests
  people: [
    '0110110',
    '1111111',
    '0110110',
    '0000000',
    '0110110',
    '1111111',
    '1111111',
  ],
  // Gear-ish — Settings
  gear: [
    '0010100',
    '1011101',
    '0111110',
    '1111111',
    '0111110',
    '1011101',
    '0010100',
  ],
  // Handset — voice call
  phone: [
    '1100000',
    '1110000',
    '0111000',
    '0011100',
    '0001110',
    '0000111',
    '0000011',
  ],
  // Camera — video call
  video: [
    '0000000',
    '1111010',
    '1111110',
    '1111111',
    '1111110',
    '1111010',
    '0000000',
  ],
  // Padlock — app lock
  lock: [
    '0011100',
    '0100010',
    '0100010',
    '1111111',
    '1111111',
    '1101011',
    '1111111',
  ],
  // Plus — add
  plus: [
    '0001000',
    '0001000',
    '0001000',
    '1111111',
    '0001000',
    '0001000',
    '0001000',
  ],
  // Key — vault
  key: [
    '0011100',
    '0100010',
    '0100010',
    '0011100',
    '0001000',
    '0001110',
    '0001010',
  ],
  // Pencil — edit
  edit: [
    '0000011',
    '0000110',
    '0001100',
    '0011000',
    '0110000',
    '1100000',
    '1110000',
  ],
  // Bell — notifications
  bell: [
    '0001000',
    '0011100',
    '0011100',
    '0111110',
    '0111110',
    '1111111',
    '0011100',
  ],
  // Door — sign out
  door: [
    '1111110',
    '1000010',
    '1000010',
    '1001010',
    '1000010',
    '1000010',
    '1111110',
  ],
  // Heart — about / brand
  heart: [
    '0110110',
    '1111111',
    '1111111',
    '1111111',
    '0111110',
    '0011100',
    '0001000',
  ],
  // Eye — hidden / app lock visibility
  eye: [
    '0000000',
    '0111110',
    '1100011',
    '1101011',
    '1100011',
    '0111110',
    '0000000',
  ],
  // Palette blob — theme / appearance
  paint: [
    '0111100',
    '1111110',
    '1100111',
    '1111111',
    '1111110',
    '0111100',
    '0011000',
  ],
  // Check — confirm / selected
  check: [
    '0000001',
    '0000011',
    '0000110',
    '1001100',
    '1111000',
    '0110000',
    '0100000',
  ],
};

export interface PixelIconProps {
  name: keyof typeof ICONS | string;
  size?: number;
  color?: ColorValue;
}

export function PixelIcon({ name, size = 22, color = '#fff' }: PixelIconProps) {
  const grid = ICONS[name] ?? ICONS.chat;
  const cols = grid[0].length;
  const cell = Math.max(1, Math.floor(size / cols));

  return (
    <View accessible={false}>
      {grid.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.split('').map((c, x) => (
            <View
              key={x}
              style={{
                width: cell,
                height: cell,
                backgroundColor: c === '1' ? color : 'transparent',
              }}
            />
          ))}
        </View>
      ))}
    </View>
  );
}
