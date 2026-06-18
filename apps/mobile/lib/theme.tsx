import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as base } from '@/constants/colors';

/**
 * App-wide theming + customization (WhatsApp-style):
 *   • Theme    — pick a base palette (all dark-first; light backgrounds were
 *                unreadable, and a few screens still read the static palette).
 *   • Accent   — override the primary/brand colour on top of any theme.
 *   • Wallpaper— a background for the chat screen.
 *
 * Screens read the active palette with `useTheme()` and build their styles
 * inside the component (so a change re-renders them):
 *
 *   const Colors = useTheme();
 *   const styles = useMemo(() => makeStyles(Colors), [Colors]);
 *
 * All three choices are persisted in AsyncStorage and restored on launch.
 */

// Palette shape mirrors constants/colors.ts, but gradient tuples are widened
// from their literal types so each theme can supply its own colours.
type Base = typeof base;
export type Palette = {
  [K in keyof Base]: Base[K] extends readonly string[] ? readonly [string, string] : string;
};

export type ThemeKey =
  | 'amethyst' | 'midnight' | 'emerald' | 'crimson' | 'slate' | 'rose' | 'ocean' | 'sunset';

const amethyst: Palette = base;

const midnight: Palette = {
  ...base,
  background: '#0A0F1A',
  surface: '#131A2A',
  surfaceAlt: '#1C2538',
  primary: '#3B82F6',
  primaryLight: '#60A5FA',
  primaryDark: '#1E3A8A',
  accent: '#22D3EE',
  accentGlow: 'rgba(34, 211, 238, 0.2)',
  messageSent: '#1E3A8A',
  messageReceived: '#131A2A',
  border: '#23304A',
  inputBg: '#0F1726',
  revealBadge: '#22D3EE',
  hiddenOverlay: 'rgba(10, 15, 26, 0.88)',
  sentBubbleGradient: ['#2563EB', '#1E3A8A'] as const,
  fabGradient: ['#60A5FA', '#3B82F6'] as const,
  heroGradient: ['#0F2A4A', '#0A0F1A'] as const,
};

const emerald: Palette = {
  ...base,
  background: '#0A140F',
  surface: '#122019',
  surfaceAlt: '#1A2C22',
  primary: '#10B981',
  primaryLight: '#34D399',
  primaryDark: '#065F46',
  accent: '#FBBF24',
  accentGlow: 'rgba(251, 191, 36, 0.2)',
  messageSent: '#065F46',
  messageReceived: '#122019',
  border: '#1F3A2E',
  inputBg: '#0E1B14',
  revealBadge: '#FBBF24',
  hiddenOverlay: 'rgba(10, 20, 15, 0.88)',
  sentBubbleGradient: ['#059669', '#065F46'] as const,
  fabGradient: ['#34D399', '#10B981'] as const,
  heroGradient: ['#0F3D2E', '#0A140F'] as const,
};

const crimson: Palette = {
  ...base,
  background: '#140A0D',
  surface: '#20131A',
  surfaceAlt: '#2C1A24',
  primary: '#E11D48',
  primaryLight: '#FB7185',
  primaryDark: '#881337',
  accent: '#FB923C',
  accentGlow: 'rgba(251, 146, 60, 0.2)',
  messageSent: '#881337',
  messageReceived: '#20131A',
  border: '#3A2330',
  inputBg: '#1B0F14',
  revealBadge: '#FB923C',
  hiddenOverlay: 'rgba(20, 10, 13, 0.88)',
  sentBubbleGradient: ['#BE123C', '#881337'] as const,
  fabGradient: ['#FB7185', '#E11D48'] as const,
  heroGradient: ['#4A1020', '#140A0D'] as const,
};

const slate: Palette = {
  ...base,
  background: '#0E0F11',
  surface: '#17191C',
  surfaceAlt: '#22262B',
  primary: '#64748B',
  primaryLight: '#94A3B8',
  primaryDark: '#334155',
  accent: '#38BDF8',
  accentGlow: 'rgba(56, 189, 248, 0.2)',
  messageSent: '#334155',
  messageReceived: '#17191C',
  border: '#2A2F36',
  inputBg: '#121417',
  revealBadge: '#38BDF8',
  hiddenOverlay: 'rgba(14, 15, 17, 0.88)',
  sentBubbleGradient: ['#475569', '#334155'] as const,
  fabGradient: ['#94A3B8', '#64748B'] as const,
  heroGradient: ['#1E293B', '#0E0F11'] as const,
};

const rose: Palette = {
  ...base,
  background: '#140A10',
  surface: '#21131C',
  surfaceAlt: '#2E1A28',
  primary: '#EC4899',
  primaryLight: '#F9A8D4',
  primaryDark: '#9D174D',
  accent: '#A78BFA',
  accentGlow: 'rgba(167, 139, 250, 0.2)',
  messageSent: '#9D174D',
  messageReceived: '#21131C',
  border: '#3A2333',
  inputBg: '#1B0F17',
  revealBadge: '#A78BFA',
  hiddenOverlay: 'rgba(20, 10, 16, 0.88)',
  sentBubbleGradient: ['#DB2777', '#9D174D'] as const,
  fabGradient: ['#F9A8D4', '#EC4899'] as const,
  heroGradient: ['#4A1038', '#140A10'] as const,
};

const ocean: Palette = {
  ...base,
  background: '#08131A',
  surface: '#0F2029',
  surfaceAlt: '#163039',
  primary: '#0EA5E9',
  primaryLight: '#38BDF8',
  primaryDark: '#075985',
  accent: '#2DD4BF',
  accentGlow: 'rgba(45, 212, 191, 0.2)',
  messageSent: '#075985',
  messageReceived: '#0F2029',
  border: '#1C3A45',
  inputBg: '#0A1A22',
  revealBadge: '#2DD4BF',
  hiddenOverlay: 'rgba(8, 19, 26, 0.88)',
  sentBubbleGradient: ['#0284C7', '#075985'] as const,
  fabGradient: ['#38BDF8', '#0EA5E9'] as const,
  heroGradient: ['#0C3A4F', '#08131A'] as const,
};

const sunset: Palette = {
  ...base,
  background: '#150D0A',
  surface: '#231512',
  surfaceAlt: '#321F18',
  primary: '#F97316',
  primaryLight: '#FDBA74',
  primaryDark: '#9A3412',
  accent: '#F43F5E',
  accentGlow: 'rgba(244, 63, 94, 0.2)',
  messageSent: '#9A3412',
  messageReceived: '#231512',
  border: '#3E2820',
  inputBg: '#1C120E',
  revealBadge: '#F43F5E',
  hiddenOverlay: 'rgba(21, 13, 10, 0.88)',
  sentBubbleGradient: ['#EA580C', '#9A3412'] as const,
  fabGradient: ['#FDBA74', '#F97316'] as const,
  heroGradient: ['#4A220C', '#150D0A'] as const,
};

export interface ThemeOption {
  key: ThemeKey;
  name: string;
  palette: Palette;
}

export const THEMES: ThemeOption[] = [
  { key: 'amethyst', name: 'Amethyst', palette: amethyst },
  { key: 'midnight', name: 'Midnight', palette: midnight },
  { key: 'ocean', name: 'Ocean', palette: ocean },
  { key: 'emerald', name: 'Emerald', palette: emerald },
  { key: 'sunset', name: 'Sunset', palette: sunset },
  { key: 'crimson', name: 'Crimson', palette: crimson },
  { key: 'rose', name: 'Rose', palette: rose },
  { key: 'slate', name: 'Slate', palette: slate },
];

// ── Accent override ────────────────────────────
export interface AccentOption {
  key: string;
  name: string;
  /** null = use the theme's own accent (no override). */
  color: string | null;
}

export const ACCENTS: AccentOption[] = [
  { key: 'default', name: 'Theme', color: null },
  { key: 'violet', name: 'Violet', color: '#8B5CF6' },
  { key: 'blue', name: 'Blue', color: '#3B82F6' },
  { key: 'cyan', name: 'Cyan', color: '#06B6D4' },
  { key: 'green', name: 'Green', color: '#10B981' },
  { key: 'amber', name: 'Amber', color: '#F59E0B' },
  { key: 'rose', name: 'Rose', color: '#F43F5E' },
  { key: 'pink', name: 'Pink', color: '#EC4899' },
];

/** Lighten (amt>0, toward white) or darken (amt<0, toward black) a hex colour. */
function shade(hex: string, amt: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const r = Math.round((t - ((num >> 16) & 0xff)) * p) + ((num >> 16) & 0xff);
  const g = Math.round((t - ((num >> 8) & 0xff)) * p) + ((num >> 8) & 0xff);
  const b = Math.round((t - (num & 0xff)) * p) + (num & 0xff);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

/** Re-tint the brand/primary family of a palette to a chosen accent colour. */
function withAccent(palette: Palette, color: string): Palette {
  return {
    ...palette,
    primary: color,
    primaryLight: shade(color, 0.22),
    primaryDark: shade(color, -0.3),
    messageSent: shade(color, -0.22),
    sentBubbleGradient: [shade(color, 0.04), shade(color, -0.28)] as const,
    fabGradient: [shade(color, 0.18), color] as const,
  };
}

// ── Chat wallpaper ─────────────────────────────
export interface WallpaperOption {
  key: string;
  name: string;
  /** null = plain theme background; otherwise a 2-stop gradient. */
  gradient: readonly [string, string] | null;
}

export const WALLPAPERS: WallpaperOption[] = [
  { key: 'default', name: 'Default', gradient: null },
  { key: 'dusk', name: 'Dusk', gradient: ['#2A1F4A', '#0D0D0D'] },
  { key: 'aurora', name: 'Aurora', gradient: ['#0F3D2E', '#08131A'] },
  { key: 'ember', name: 'Ember', gradient: ['#3E1620', '#140A0D'] },
  { key: 'deep', name: 'Deep', gradient: ['#0C2A45', '#08111A'] },
  { key: 'ink', name: 'Ink', gradient: ['#1A1A1F', '#08080A'] },
];

const KEY_THEME = 'hs:theme';
const KEY_ACCENT = 'hs:accent';
const KEY_WALLPAPER = 'hs:wallpaper';

interface ThemeContextValue {
  palette: Palette;
  themeKey: ThemeKey;
  accentKey: string;
  wallpaperKey: string;
  setTheme: (key: ThemeKey) => void;
  setAccent: (key: string) => void;
  setWallpaper: (key: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  palette: amethyst,
  themeKey: 'amethyst',
  accentKey: 'default',
  wallpaperKey: 'default',
  setTheme: () => {},
  setAccent: () => {},
  setWallpaper: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>('amethyst');
  const [accentKey, setAccentKey] = useState<string>('default');
  const [wallpaperKey, setWallpaperKey] = useState<string>('default');

  useEffect(() => {
    AsyncStorage.multiGet([KEY_THEME, KEY_ACCENT, KEY_WALLPAPER]).then((entries) => {
      const map = Object.fromEntries(entries);
      if (map[KEY_THEME] && THEMES.some((t) => t.key === map[KEY_THEME])) setThemeKey(map[KEY_THEME] as ThemeKey);
      if (map[KEY_ACCENT] && ACCENTS.some((a) => a.key === map[KEY_ACCENT])) setAccentKey(map[KEY_ACCENT]!);
      if (map[KEY_WALLPAPER] && WALLPAPERS.some((w) => w.key === map[KEY_WALLPAPER])) setWallpaperKey(map[KEY_WALLPAPER]!);
    });
  }, []);

  const setTheme = (key: ThemeKey) => { setThemeKey(key); AsyncStorage.setItem(KEY_THEME, key).catch(() => {}); };
  const setAccent = (key: string) => { setAccentKey(key); AsyncStorage.setItem(KEY_ACCENT, key).catch(() => {}); };
  const setWallpaper = (key: string) => { setWallpaperKey(key); AsyncStorage.setItem(KEY_WALLPAPER, key).catch(() => {}); };

  const palette = useMemo(() => {
    const basePalette = THEMES.find((t) => t.key === themeKey)?.palette ?? amethyst;
    const accent = ACCENTS.find((a) => a.key === accentKey)?.color;
    return accent ? withAccent(basePalette, accent) : basePalette;
  }, [themeKey, accentKey]);

  return (
    <ThemeContext.Provider value={{ palette, themeKey, accentKey, wallpaperKey, setTheme, setAccent, setWallpaper }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** The active palette — drop-in replacement for the static `Colors` import. */
export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}

/** For the Settings appearance panel: themes + accents + their setters. */
export function useThemeControls() {
  const { themeKey, setTheme, accentKey, setAccent } = useContext(ThemeContext);
  return { themeKey, setTheme, themes: THEMES, accentKey, setAccent, accents: ACCENTS };
}

/** Chat wallpaper choice + the resolved option (for rendering the background). */
export function useChatWallpaper() {
  const { wallpaperKey, setWallpaper } = useContext(ThemeContext);
  const wallpaper = WALLPAPERS.find((w) => w.key === wallpaperKey) ?? WALLPAPERS[0];
  return { wallpaperKey, setWallpaper, wallpapers: WALLPAPERS, wallpaper };
}
