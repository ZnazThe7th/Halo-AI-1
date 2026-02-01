
import { BusinessProfile, Client, Appointment, AppointmentStatus } from './types';

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

export const MOCK_BUSINESS: BusinessProfile = {
  name: "Halo Studio",
  ownerName: "Sarah Jenkins",
  email: "sarah@halostudio.com", // Default mock email
  category: "Hair & Styling",
  taxRate: 20, // 20% default
  monthlyRevenueGoal: 5000, // Default goal
  themePreference: 'dark', // Default to dark mode
  workingHours: { start: "09:00", end: "18:00" },
  services: [
    { id: "s1", name: "Signature Haircut", durationMin: 60, price: 85, description: "Wash, cut, and style." },
    { id: "s2", name: "Color Consultation", durationMin: 30, price: 40, description: "Expert color matching." },
    { id: "s3", name: "Full Balayage", durationMin: 180, price: 250, description: "Hand-painted highlights." },
  ]
};

export const MOCK_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "Emma Thompson",
    email: "emma.t@example.com",
    phone: "555-0101",
    notes: [
      "2023-10-15: Loved the choppy layers. Mentioned moving to a new apartment soon.",
      "2023-12-20: Trim only. Complained about dry scalp due to winter.",
      "2024-02-14: Valentine's blowout. Used volumizing mousse, she loved the scent."
    ],
    preferences: "Prefers silent appointments mostly. Likes water with lemon.",
    lastVisit: "2024-02-14"
  },
  {
    id: "c2",
    name: "Michael Chen",
    email: "m.chen@example.com",
    phone: "555-0102",
    notes: [
      "2024-01-10: Fade on the sides, keep length on top.",
      "2024-03-01: Same cut. Talked about his new puppy 'Max'."
    ],
    preferences: "Likes chatting about tech and dogs.",
    lastVisit: "2024-03-01"
  },
  {
    id: "c3",
    name: "Sophia Rodriguez",
    email: "sophia.r@example.com",
    phone: "555-0103",
    notes: ["First time client inquiry."],
    preferences: "Unknown",
    lastVisit: null
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: "a1",
    clientId: "c1",
    clientName: "Emma Thompson",
    serviceId: "s1",
    date: new Date().toISOString().split('T')[0], // Today
    time: "10:00",
    status: AppointmentStatus.CONFIRMED
  },
  {
    id: "a2",
    clientId: "c2",
    clientName: "Michael Chen",
    serviceId: "s1",
    date: new Date().toISOString().split('T')[0], // Today
    time: "14:00",
    status: AppointmentStatus.PENDING
  },
  {
    id: "a3",
    clientId: "c3",
    clientName: "Sophia Rodriguez",
    serviceId: "s2",
    date: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    time: "11:00",
    status: AppointmentStatus.CONFIRMED
  },
  {
    id: "a4",
    clientId: "c2",
    clientName: "Michael Chen",
    serviceId: "s1",
    date: "2023-01-01", // Base date in past
    time: "09:00",
    status: AppointmentStatus.CONFIRMED,
    recurrence: {
        frequency: 'WEEKLY',
        interval: 1,
        endDate: '2025-12-31'
    }
  }
];