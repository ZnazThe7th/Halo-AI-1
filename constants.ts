
import { BusinessProfile } from './types';

/**
 * Convert a Date to a YYYY-MM-DD string in LOCAL time (not UTC).
 * Using toISOString().split('T')[0] is WRONG because toISOString
 * converts to UTC first, which shifts the date forward in US evening hours.
 */
export const toLocalDateStr = (date: Date = new Date()): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const formatTime = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const m = parseInt(minutes, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
};

export const DEFAULT_BUSINESS: BusinessProfile = {
  name: "",
  ownerName: "",
  email: "",
  category: "",
  taxRate: 0,
  monthlyRevenueGoal: 0,
  themePreference: 'dark',
  workingHours: { start: "09:00", end: "18:00" },
  services: [],
};