import { Platform, ViewStyle } from 'react-native';

export const colors = {
  dark: '#0F172A',
  primary: '#4F46E5',
  verified: '#10B981',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  warningText: '#D97706',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  subtle: '#F1F5F9',
  white: '#FFFFFF',
  offline: '#94A3B8',
} as const;

export const mono = Platform.select({ ios: 'Menlo', default: 'monospace' });

export const cardShadow: ViewStyle = {
  shadowColor: '#0F172A',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#14B8A6', '#8B5CF6', '#EF4444', '#0EA5E9', '#22C55E'];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  return (name.trim().slice(0, 2) || '?').toUpperCase();
}
