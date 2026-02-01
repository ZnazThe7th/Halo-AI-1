
export enum ViewState {
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  CLIENTS = 'CLIENTS',
  CALENDAR = 'CALENDAR',
  SETTINGS = 'SETTINGS',
  MY_BUSINESS = 'MY_BUSINESS',
  BOOKING_PUBLIC = 'BOOKING_PUBLIC' // The client-facing view
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  description: string;
}

export interface BusinessProfile {
  name: string;
  ownerName: string;
  email: string; // Added email field
  category: string;
  avatarUrl?: string; // Profile picture
  themePreference: 'light' | 'dark';
  services: Service[];
  taxRate: number; // Percentage (e.g., 20 for 20%)
  monthlyRevenueGoal: number; // New field for income goals
  workingHours: {
    start: string; // HH:mm
    end: string;   // HH:mm
  };
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string[]; // Historical notes
  preferences: string;
  lastVisit: string | null;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: 'Supplies' | 'Rent' | 'Marketing' | 'Other';
}

export enum AppointmentStatus {
  CONFIRMED = 'CONFIRMED',
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  BLOCKED = 'BLOCKED'
}

export interface RecurrenceRule {
  frequency: 'WEEKLY' | 'MONTHLY';
  interval: number; // e.g. 1 = every week, 2 = every other week
  endDate?: string; // ISO Date YYYY-MM-DD
}

export interface Appointment {
  id: string;
  clientId: string;
  clientName: string; // Denormalized for MVP simplicity
  serviceId: string;
  date: string; // ISO Date YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  recurrence?: RecurrenceRule;
}

export interface AISummaryResponse {
  summary: string;
  keyTopics: string[];
  suggestedTalkingPoints: string[];
}