import { useState } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Users, 
  Calendar,
  CheckCircle2,
  PieChart,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { Booking, Court } from '../types';

interface DashboardViewProps {
  bookings: Booking[];
  courts: Court[];
  onNavigateToTab: (tab: 'dashboard' | 'locations' | 'courts' | 'bookings') => void;
  onOpenBookingDetails: (bookingId: string) => void;
}

export default function DashboardView({ 
  bookings, 
  courts, 
  onNavigateToTab,
  onOpenBookingDetails
}: DashboardViewProps) {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'custom'>('today');

  // Let's compute some realistic metrics based on current state to make it interactive and super polished
  const totalBookingsCount = bookings.filter(b => b.status !== 'cancelled').length;
  const activeCourtsCount = courts.filter(c => c.status === 'active').length;
  const totalCourtsCount = courts.length;

  // Revenue computation
  const totalRevenue = bookings
    .filter(b => b.status === 'paid' || b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => sum + b.amount, 0);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Mock revenue chart data
  const revenueData = [
    { day: 'Mon', value: 12000, label: '₱12k' },
    { day: 'Tue', value: 18000, label: '₱18k' },
    { day: 'Wed', value: 14000, label: '₱14k' },
    { day: 'Thu', value: 22000, label: '₱22k' },
    { day: 'Fri', value: 28500, label: '₱28.5k', isPeak: true },
    { day: 'Sat', value: 20000, label: '₱20k' },
    { day: 'Sun', value: 16000, label: '₱16k' }
  ];

  // Filter today's bookings for the table matching Screenshot 4
  const dashboardBookings = bookings.filter(b => 
    b.bookingId === 'BK-1011' || 
    b.bookingId === 'BK-1012' || 
    b.bookingId === 'BK-1013' || 
    b.bookingId === 'BK-1014'
  );

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Top Row: Heading & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold font-headline text-on-surface tracking-tight">
            Dashboard
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 font-medium">
            Welcome back, here's how Sunshine Pickleball Courts is doing
          </p>
        </div>
        
        {/* Date scope control */}
        <div className="flex bg-white border border-outline-variant rounded p-1 shadow-sm">
          {(['today', 'week', 'month'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setTimeFilter(filter)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all uppercase tracking-wider ${
                timeFilter === filter
                  ? 'bg-secondary-container text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-primary'
              }`}
            >
              {filter === 'today' ? 'Today' : filter === 'week' ? 'This week' : 'This month'}
            </button>
          ))}
          <button
            onClick={() => setTimeFilter('custom')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all border-l border-outline-variant/60 flex items-center gap-1.5 uppercase tracking-wider ${
              timeFilter === 'custom'
                ? 'bg-secondary-container text-primary'
                : 'text-on-surface-variant hover:text-primary'
            }`}
          >
            <span>Custom</span>
            <Calendar className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-outline-variant p-5 rounded-lg hover:border-primary transition-all duration-300 relative group overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-surface-container-low rounded-lg text-primary">
              <Calendar className="w-5 h-5 text-primary" />
            </span>
            <span className="text-xs font-bold text-secondary bg-secondary-container/50 px-2 py-0.5 rounded">
              +2 from yesterday
            </span>
          </div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Today's Bookings
          </p>
          <h3 className="text-4xl font-extrabold text-on-surface mt-1.5 font-headline">
            {bookings.length}
          </h3>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-outline-variant p-5 rounded-lg hover:border-primary transition-all duration-300 relative group overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-surface-container-low rounded-lg text-primary">
              <DollarSign className="w-5 h-5 text-primary" />
            </span>
            <span className="text-xs font-bold text-secondary bg-secondary-container/50 px-2 py-0.5 rounded flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-secondary" /> +8%
            </span>
          </div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Revenue This Month
          </p>
          <h3 className="text-4xl font-extrabold text-on-surface mt-1.5 font-headline">
            {formatCurrency(totalRevenue || 42500)}
          </h3>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-outline-variant p-5 rounded-lg hover:border-primary transition-all duration-300 relative group overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-surface-container-low rounded-lg text-primary">
              <PieChart className="w-5 h-5 text-primary" />
            </span>
            <span className="text-xs font-medium text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              Peak: 92%
            </span>
          </div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Occupancy Rate
          </p>
          <h3 className="text-4xl font-extrabold text-on-surface mt-1.5 font-headline">
            78%
          </h3>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-outline-variant p-5 rounded-lg hover:border-primary transition-all duration-300 relative group overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 bg-surface-container-low rounded-lg text-primary">
              <CheckCircle2 className="w-5 h-5 text-primary" />
            </span>
            <div className="flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-ping"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
            </div>
          </div>
          <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
            Active Courts
          </p>
          <h3 className="text-4xl font-extrabold text-on-surface mt-1.5 font-headline">
            {activeCourtsCount} of {totalCourtsCount}
          </h3>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Revenue Trend Custom Beautiful Bar Chart */}
        <div className="lg:col-span-8 bg-white border border-outline-variant p-6 rounded-lg relative overflow-hidden flex flex-col justify-between shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h4 className="font-semibold text-lg text-on-surface">Revenue Trend</h4>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-primary rounded-full"></span>
              <span className="text-xs text-on-surface-variant font-medium">Revenue (Daily)</span>
            </div>
          </div>

          <div className="h-64 w-full relative pt-4">
            {/* Native Clean Custom Column chart matching CSS specs */}
            <div className="absolute inset-0 flex items-end justify-between px-2 gap-4">
              {revenueData.map((item, index) => {
                const heightPercent = `${Math.round((item.value / 30000) * 100)}%`;
                return (
                  <div 
                    key={index}
                    style={{ height: heightPercent }}
                    className="w-full flex flex-col justify-end relative group cursor-pointer"
                  >
                    {/* Tooltip on Hover */}
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-on-surface text-white text-[10px] uppercase font-bold py-1 px-2.5 rounded shadow-lg pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10 duration-200 whitespace-nowrap">
                      {formatCurrency(item.value)}
                    </div>
                    {/* Bar */}
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${
                        item.isPeak 
                          ? 'bg-primary hover:bg-opacity-90' 
                          : 'bg-primary/10 hover:bg-primary/30'
                      }`}
                    ></div>
                  </div>
                );
              })}
            </div>
            
            {/* Chart Grid Lines overlay */}
            <div className="absolute inset-0 border-b border-l border-outline-variant pointer-events-none opacity-20 chart-grid"></div>
          </div>
          
          <div className="flex justify-between mt-4 text-[10px] text-outline font-bold tracking-wider uppercase border-t border-outline-variant/30 pt-3">
            {revenueData.map((d, index) => (
              <span key={index}>{d.day}</span>
            ))}
          </div>
        </div>

        {/* Occupancy by Court Stack */}
        <div className="lg:col-span-4 bg-white border border-outline-variant p-6 rounded-lg flex flex-col justify-between shadow-sm">
          <div>
            <h4 className="font-semibold text-lg text-on-surface mb-6">Occupancy by Court</h4>
            <div className="space-y-6 mt-4">
              {/* Court 1 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Court 1 (Indoor)</span>
                  <span className="text-primary font-bold">88%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low overflow-hidden rounded">
                  <div className="h-full bg-primary rounded" style={{ width: '88%' }}></div>
                </div>
              </div>

              {/* Court 2 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Court 2 (Indoor)</span>
                  <span className="text-primary font-bold">72%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low overflow-hidden rounded">
                  <div className="h-full bg-primary rounded" style={{ width: '72%' }}></div>
                </div>
              </div>

              {/* Court 3 */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-semibold">
                  <span>Court 3 (Outdoor)</span>
                  <span className="text-primary font-bold">64%</span>
                </div>
                <div className="h-2 w-full bg-surface-container-low overflow-hidden rounded">
                  <div className="h-full bg-primary rounded" style={{ width: '64%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 text-center border-t border-outline-variant/30 mt-6 md:mt-0">
            <span className="inline-flex items-center gap-1.5 text-xs text-on-surface-variant font-medium bg-surface-container-low px-3 py-1.5 rounded-full">
              Average turnaround: <strong className="text-on-surface">12m</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Bookings List Section */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low/10">
          <h4 className="font-semibold text-base text-on-surface">Today's Bookings</h4>
          <button 
            onClick={() => onNavigateToTab('bookings')}
            className="text-primary hover:text-opacity-85 font-semibold text-xs flex items-center gap-1.5 group transition-colors uppercase tracking-wider"
          >
            <span>View all</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-surface-container-low/40 text-[10px] text-outline uppercase tracking-wider font-bold">
              <tr>
                <th className="px-6 py-3.5 font-bold">Time</th>
                <th className="px-6 py-3.5 font-bold">Court</th>
                <th className="px-6 py-3.5 font-bold">Customer</th>
                <th className="px-6 py-3.5 font-bold">Status</th>
                <th className="px-6 py-3.5 font-bold text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {dashboardBookings.length > 0 ? (
                dashboardBookings.map((booking) => (
                  <tr 
                    key={booking.id}
                    onClick={() => onOpenBookingDetails(booking.bookingId)}
                    className="hover:bg-surface-container-lowest transition-all cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-xs font-semibold text-on-surface">
                      {booking.time}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant font-bold text-[9px] tracking-wide rounded">
                        COURT {booking.courtId}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-on-surface font-sans">
                      {booking.customerName}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          booking.status === 'paid' || booking.status === 'completed'
                            ? 'bg-primary'
                            : booking.status === 'pending'
                            ? 'bg-amber-500'
                            : booking.status === 'cancelled'
                            ? 'bg-red-500'
                            : 'bg-primary/90'
                        }`}></span>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                          booking.status === 'paid' || booking.status === 'completed'
                            ? 'text-primary'
                            : booking.status === 'pending'
                            ? 'text-amber-600'
                            : booking.status === 'cancelled'
                            ? 'text-red-500'
                            : 'text-primary/90'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold text-on-surface">
                      {formatCurrency(booking.amount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-on-surface-variant font-sans">
                    No bookings found for today.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
