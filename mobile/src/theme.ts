import { Appearance } from 'react-native';

export interface Theme {
  bg: string;
  card: string;
  text: string;
  textSecondary: string;
  accent: string;
  danger: string;
  border: string;
  badgeCriticalBg: string;
  badgeWarningBg: string;
  badgeInfoBg: string;
  badgeText: string;
  chipBg: string;
  chipSelectedBg: string;
  chipText: string;
  chipSelectedText: string;
  inputBg: string;
  inputText: string;
  headerBg: string;
  headerText: string;
}

export const lightTheme: Theme = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  text: '#1C1C1E',
  textSecondary: '#8E8E93',
  accent: '#007AFF',
  danger: '#FF3B30',
  border: '#E5E5EA',
  badgeCriticalBg: '#FDE7E7',
  badgeWarningBg: '#FFF4DE',
  badgeInfoBg: '#E7F3FD',
  badgeText: '#3A3A3C',
  chipBg: '#FFFFFF',
  chipSelectedBg: '#007AFF',
  chipText: '#3A3A3C',
  chipSelectedText: '#FFFFFF',
  inputBg: '#FFFFFF',
  inputText: '#000000',
  headerBg: '#FFFFFF',
  headerText: '#1C1C1E',
};

export const darkTheme: Theme = {
  bg: '#000000',
  card: '#1C1C1E',
  text: '#F2F2F7',
  textSecondary: '#8E8E93',
  accent: '#0A84FF',
  danger: '#FF453A',
  border: '#38383A',
  badgeCriticalBg: '#3A1C1C',
  badgeWarningBg: '#3A3520',
  badgeInfoBg: '#1C2B3A',
  badgeText: '#E5E5EA',
  chipBg: '#1C1C1E',
  chipSelectedBg: '#0A84FF',
  chipText: '#E5E5EA',
  chipSelectedText: '#FFFFFF',
  inputBg: '#1C1C1E',
  inputText: '#F2F2F7',
  headerBg: '#1C1C1E',
  headerText: '#F2F2F7',
};

export function getTheme(mode: 'light' | 'dark'): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
