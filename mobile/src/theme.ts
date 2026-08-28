// ─────────────────────────────────────────────────────────────────
//  theme.ts  –  Centralized design tokens for Pastoral Care App
//  Supports light & dark mode. All screens must reference these
//  instead of hard-coded hex values so theming stays consistent.
// ─────────────────────────────────────────────────────────────────

export interface Theme {
  // Surfaces
  bg: string;
  card: string;
  cardElevated: string;

  // Text
  text: string;
  textSecondary: string;
  textMuted: string;

  // Brand
  accent: string;
  accentLight: string;
  accentDark: string;

  // Status
  danger: string;
  dangerLight: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;

  // Structural
  border: string;
  divider: string;
  shadow: string;

  // Badge tones
  badgeCriticalBg: string;
  badgeWarningBg: string;
  badgeInfoBg: string;
  badgeSuccessBg: string;
  badgeText: string;

  // Interactive chips
  chipBg: string;
  chipSelectedBg: string;
  chipText: string;
  chipSelectedText: string;

  // Form inputs
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;

  // Header / nav bar
  headerBg: string;
  headerText: string;

  // Activity cards (unique tint per module)
  visitTint: string;
  cottageTint: string;
  fastingTint: string;
  bibleTint: string;
  backupTint: string;
}

// ── Light ────────────────────────────────────────────────────────
export const lightTheme: Theme = {
  bg: '#F5F5F7',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',

  text: '#1C1C1E',
  textSecondary: '#48484A',
  textMuted: '#8E8E93',

  accent: '#4F46E5',        // Indigo-600
  accentLight: '#EEF2FF',   // Indigo-50
  accentDark: '#3730A3',    // Indigo-800

  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  success: '#059669',
  successLight: '#ECFDF5',
  warning: '#D97706',
  warningLight: '#FFFBEB',

  border: '#E5E7EB',
  divider: '#F3F4F6',
  shadow: '#1C1C1E',

  badgeCriticalBg: '#FEE2E2',
  badgeWarningBg: '#FEF3C7',
  badgeInfoBg: '#E0E7FF',
  badgeSuccessBg: '#D1FAE5',
  badgeText: '#1C1C1E',

  chipBg: '#F3F4F6',
  chipSelectedBg: '#4F46E5',
  chipText: '#374151',
  chipSelectedText: '#FFFFFF',

  inputBg: '#FFFFFF',
  inputText: '#1C1C1E',
  inputBorder: '#D1D5DB',
  inputPlaceholder: '#9CA3AF',

  headerBg: '#FFFFFF',
  headerText: '#1C1C1E',

  visitTint: '#EFF6FF',     // Blue-50
  cottageTint: '#FDF4FF',   // Purple-50
  fastingTint: '#FFF7ED',   // Orange-50
  bibleTint: '#ECFDF5',     // Emerald-50
  backupTint: '#F0FDF4',    // Green-50
};

// ── Dark ─────────────────────────────────────────────────────────
export const darkTheme: Theme = {
  bg: '#0A0A0F',
  card: '#1C1C28',
  cardElevated: '#24243A',

  text: '#F2F2F7',
  textSecondary: '#AEAEB2',
  textMuted: '#636366',

  accent: '#818CF8',        // Indigo-400
  accentLight: '#1E1B4B',   // Indigo-950
  accentDark: '#C7D2FE',    // Indigo-200

  danger: '#F87171',
  dangerLight: '#450A0A',
  success: '#34D399',
  successLight: '#022C22',
  warning: '#FBBF24',
  warningLight: '#431407',

  border: '#2D2D44',
  divider: '#1F1F30',
  shadow: '#000000',

  badgeCriticalBg: '#3B1111',
  badgeWarningBg: '#3B2800',
  badgeInfoBg: '#1E1B4B',
  badgeSuccessBg: '#052E16',
  badgeText: '#F2F2F7',

  chipBg: '#1C1C28',
  chipSelectedBg: '#818CF8',
  chipText: '#AEAEB2',
  chipSelectedText: '#0A0A0F',

  inputBg: '#1C1C28',
  inputText: '#F2F2F7',
  inputBorder: '#3D3D5C',
  inputPlaceholder: '#6B7280',

  headerBg: '#0A0A0F',
  headerText: '#F2F2F7',

  visitTint: '#0F172A',
  cottageTint: '#1A0533',
  fastingTint: '#1C0A00',
  bibleTint: '#022C22',
  backupTint: '#052E16',
};

export function getTheme(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
