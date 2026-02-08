
export enum ViewState {
  ONBOARDING = 'ONBOARDING',
  DASHBOARD = 'DASHBOARD',
  CLIENTS = 'CLIENTS',
  CALENDAR = 'CALENDAR',
  SETTINGS = 'SETTINGS',
  MY_BUSINESS = 'MY_BUSINESS',
  SAVE_POINTS = 'SAVE_POINTS', // Manual save/load snapshots across devices
  BOOKING_PUBLIC = 'BOOKING_PUBLIC', // The client-facing view
  RATING_PAGE = 'RATING_PAGE' // Public rating page
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: number;
  description: string;
  pricePerPerson?: boolean; // If true, price is per person and allows multiple clients
}

export interface Staff {
  id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
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
  staff?: Staff[]; // People who work with the business
  dailyEmailEnabled?: boolean; // Toggle for daily email reports
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

export interface BonusEntry {
  id: string;
  description: string;
  amount: number;
  date: string;
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

export interface ClientRating {
  id: string;
  appointmentId: string;
  clientId: string;
  businessRating?: number; // 1-5 rating for the business
  staffRating?: number; // 1-5 rating for the staff member
  staffId?: string; // Which staff member was rated
  comment?: string; // Optional feedback comment
  date: string; // When the rating was submitted
}

export interface Appointment {
  id: string;
  clientId: string; // Keep for backward compatibility (first client if multiple)
  clientName: string; // Denormalized for MVP simplicity (first client if multiple)
  clientIds?: string[]; // Array of client IDs for multi-client appointments
  clientNames?: string[]; // Array of client names for multi-client appointments
  serviceId: string;
  date: string; // ISO Date YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  notes?: string;
  recurrence?: RecurrenceRule;
  staffId?: string; // Which staff member is assigned
  rating?: ClientRating; // Rating for this appointment
  numberOfPeople?: number; // Number of people for price-per-person services
  overridePrice?: number; // Manual price override for revenue editing
}

export interface AISummaryResponse {
  summary: string;
  keyTopics: string[];
  suggestedTalkingPoints: string[];
}