export type CourtStatus = 'active' | 'maintenance' | 'inactive';
export type CourtSurface = 'indoor' | 'outdoor';

export interface TimePriceRange {
  id: string;
  start: string; // e.g. "06:00 AM" or "06:00"
  end: string;   // e.g. "09:00 AM" or "09:00"
  rate: number;  // hourly price
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export interface Court {
  id: number;
  name: string;
  surfaceType: CourtSurface;
  opensAt: string;  // e.g. "06:00"
  closesAt: string; // e.g. "22:00"
  defaultPrice: number;
  status: CourtStatus;
  pricing: Record<DayOfWeek, TimePriceRange[]>;
}

export type BookingStatus = 'paid' | 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: number;
  bookingId: string; // e.g. "BK-1025"
  date: string;       // e.g. "Oct 24, 2023"
  time: string;       // start time e.g. "08:00"
  endTime: string;    // end time e.g. "10:00"
  courtId: number;
  courtName: string;
  customerName: string;
  phone: string;
  status: BookingStatus;
  amount: number;
}
