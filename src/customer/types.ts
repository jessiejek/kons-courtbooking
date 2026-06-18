export type Screen = 'landing' | 'booking' | 'checkout' | 'confirmed' | 'bookings-list' | 'booking-detail';

export interface Booking {
  id: string;
  courtId: string;
  courtName: string;
  date: string; // ISO string YYYY-MM-DD
  startTime: string; // e.g. "09:00 AM" or "09:00"
  endTime: string; // e.g. "11:00 AM" or "11:00"
  slots: string[]; // e.g. ["09:00", "10:00"]
  price: number;
  status: 'Upcoming' | 'Past' | 'Cancelled';
  fullName: string;
  phoneNumber: string;
  paymentMethod: 'Card' | 'GCash' | 'Online Banking';
  cardEnding?: string;
  createdAt: string;
}

export interface Court {
  id: string;
  name: string;
  type: 'Indoor' | 'Outdoor';
  pricePerHour: number;
  image: string;
  rating: number;
  description: string;
}

export interface User {
  fullName: string;
  phoneNumber: string;
  email?: string;
  isLoggedIn: boolean;
  avatar?: string;
}

export interface TimeSlot {
  id: string; // "08:00"
  timeLabel: string; // "08:30 AM" or similar
  period: 'Morning' | 'Afternoon' | 'Evening' | 'Night';
  isBooked: boolean;
  courtBookings: Record<string, boolean>; // courtId -> isBooked
}
