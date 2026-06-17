import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors as base } from '@/constants/colors';

/**
 * App-wide theming. Every palette is a *dark* variant — the app is
 * dark-first (light backgrounds were unreadable), so switching themes
 * re-tints accents/surfaces without ever flipping to a glaring light mode.
 *
 * Screens read the active palette with `useTheme()` and build their styles
 * inside the component (so a theme change re-renders them):
 *
 *   const Colors = useTheme();
 *   const styles = useMemo(() => makeStyles(Colors), [Colors]);
 *
 * The choice is persisted in AsyncStorage and restored on launch.
 */

// Palette shape mirrors constants/colors.ts, but gradient tuples are widened
// from their literal types so each theme can supply its own colours.
type Base = typeof base;
export type Palette = {
  [K in keyof Base]: Base[K] extends readonly string[] ? readonly [string, string] : string;
};

export type ThemeKey = 'amethyst' | 'midnight' | 'emerald' | 'crimson' | 'slate';

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

export interface ThemeOption {
  key: ThemeKey;
  name: string;
  palette: Palette;
}

export const THEMES: ThemeOption[] = [
  { key: 'amethyst', name: 'Amethyst', palette: amethyst },
  { key: 'midnight', name: 'Midnight', palette: midnight },
  { key: 'emerald', name: 'Emerald', palette: emerald },
  { key: 'crimson', name: 'Crimson', palette: crimson },
  { key: 'slate', name: 'Slate', palette: slate },
];

const STORAGE_KEY = 'hs:theme';

interface ThemeContextValue {
  palette: Palette;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  palette: amethyst,
  themeKey: 'amethyst',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>('amethyst');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && THEMES.some((t) => t.key === saved)) setThemeKey(saved as ThemeKey);
    });
  }, []);

  const setTheme = (key: ThemeKey) => {
    setThemeKey(key);
    AsyncStorage.setItem(STORAGE_KEY, key).catch(() => {});
  };

  const palette = THEMES.find((t) => t.key === themeKey)?.palette ?? amethyst;

  return (
    <ThemeContext.Provider value={{ palette, themeKey, setTheme }}>{children}</ThemeContext.Provider>
  );
}

/** The active palette — drop-in replacement for the static `Colors` import. */
export function useTheme(): Palette {
  return useContext(ThemeContext).palette;
}

/** For the Settings theme picker: current key + setter + the list of options. */
export function useThemeControls() {
  const { themeKey, setTheme } = useContext(ThemeContext);
  return { themeKey, setTheme, themes: THEMES };
}
