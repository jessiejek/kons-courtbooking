import { useState, useMemo } from 'react';
import { 
  Search, 
  Calendar, 
  ChevronDown, 
  TrendingUp, 
  Clock, 
  Users,
  Eye,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Booking, BookingStatus, Court } from '../types';

interface BookingsViewProps {
  bookings: Booking[];
  courts: Court[];
  onOpenBookingDetails: (bookingId: string) => void;
  onAddNewBooking: () => void;
  onRefresh?: () => void;
}

export default function BookingsView({
  bookings,
  courts,
  onOpenBookingDetails,
  onAddNewBooking,
  onRefresh,
}: BookingsViewProps) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };
  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('All courts');
  const [selectedStatus, setSelectedStatus] = useState('All statuses');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // fits nicely on screen

  // Unique lists of courts and statuses present in our data
  const courtNames = useMemo(() => courts.map(c => c.name), [courts]);

  const statuses: BookingStatus[] = ['paid', 'confirmed', 'pending', 'cancelled', 'completed'];

  // Apply filters
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchSearch = 
        b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        b.bookingId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.phone.includes(searchTerm);
      
      const matchCourt = selectedCourt === 'All courts' || b.courtName === selectedCourt;
      const matchStatus = selectedStatus === 'All statuses' || b.status === selectedStatus.toLowerCase();

      return matchSearch && matchCourt && matchStatus;
    });
  }, [bookings, searchTerm, selectedCourt, selectedStatus]);

  // Compute pagination
  const totalEntries = filteredBookings.length;
  const totalPages = Math.ceil(totalEntries / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalEntries);
  
  const paginatedBookings = useMemo(() => {
    return filteredBookings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBookings, startIndex, itemsPerPage]);

  const totalFilteredAmount = useMemo(() => {
    return filteredBookings
      .filter(b => b.status !== 'cancelled')
      .reduce((sum, b) => sum + b.amount, 0);
  }, [filteredBookings]);

  // Real KPI stats derived from all bookings
  const { revenueAllTime, mostBookedCourt, mostBookedCount, uniqueCustomers } = useMemo(() => {
    const active = bookings.filter(b => b.status !== 'cancelled');
    const revenueAllTime = active.reduce((s, b) => s + b.amount, 0);
    const courtCounts: Record<string, number> = {};
    active.forEach(b => { courtCounts[b.courtName] = (courtCounts[b.courtName] ?? 0) + 1; });
    const mostBookedCourt = Object.keys(courtCounts).sort((a, b) => courtCounts[b] - courtCounts[a])[0] ?? '—';
    const mostBookedCount = courtCounts[mostBookedCourt] ?? 0;
    const uniqueCustomers = new Set(active.map(b => b.phone)).size;
    return { revenueAllTime, mostBookedCourt, mostBookedCount, uniqueCustomers };
  }, [bookings]);

  // Format currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Heading */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold font-headline text-on-surface tracking-tight">Booking Reservations</h2>
          <p className="text-sm text-on-surface-variant mt-1 font-medium">
            View and manage all reservations across your facilities.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reload from Supabase"
            className="border border-outline-variant bg-white text-on-surface-variant font-semibold text-xs py-2.5 px-3 rounded-lg hover:bg-surface-container-low active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {/* New Reservation removed — use Walk-in tab instead */}
          {false && <button
            onClick={onAddNewBooking}
            className="bg-primary text-on-primary font-semibold text-xs py-2.5 px-5 rounded-lg hover:bg-opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>New Reservation</span>
          </button>}
        </div>
      </div>

      {/* Toolbar Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search container */}
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-outline w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset page
              }}
              placeholder="Search by name, ID or phone..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-outline-variant rounded focus:outline-none focus:border-on-surface text-sm transition-colors"
            />
          </div>

          {/* Court Filter */}
          <div className="relative">
            <select
              value={selectedCourt}
              onChange={(e) => {
                setSelectedCourt(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-outline-variant rounded pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-on-surface appearance-none text-on-surface font-medium cursor-pointer"
            >
              <option>All courts</option>
              {courtNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-white border border-outline-variant rounded pl-3 pr-8 py-2 text-sm focus:outline-none focus:border-on-surface appearance-none text-on-surface font-medium cursor-pointer uppercase tracking-wider text-xs"
            >
              <option>All statuses</option>
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Time Picker Trigger */}
          <button 
            type="button" 
            onClick={() => {}}
            className="flex items-center gap-2 bg-white border border-outline-variant rounded px-4 py-2 text-xs font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
          >
            <Calendar className="w-4 h-4 text-outline" />
            <span>THIS WEEK</span>
            <ChevronDown className="w-3 h-3 text-outline" />
          </button>
        </div>

        {/* Counter KPI summary label */}
        <div className="flex items-center gap-2 text-on-surface-variant font-medium text-xs uppercase tracking-wider opacity-90 pt-1 lg:pt-0">
          <span className="font-bold text-on-surface">{totalEntries}</span> bookings 
          <span className="mx-1">•</span> 
          <span className="font-bold text-on-surface">{formatCurrency(totalFilteredAmount)}</span> total
        </div>
      </div>

      {/* Main Data Table */}
      <div className="bg-white border border-outline-variant rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto custom-scrollbar w-full">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low/50 text-[10px] text-outline uppercase tracking-wider font-bold">
                <th className="px-6 py-4 font-bold">Date</th>
                <th className="px-6 py-4 font-bold">Time</th>
                <th className="px-6 py-4 font-bold">Court</th>
                <th className="px-6 py-4 font-bold">Customer</th>
                <th className="px-6 py-4 font-bold">Phone</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Amount</th>
                <th className="px-6 py-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/40">
              {paginatedBookings.length > 0 ? (
                paginatedBookings.map((booking) => (
                  <tr 
                    key={booking.id}
                    className="hover:bg-surface-container-lowest transition-colors group text-sm"
                  >
                    <td className="px-6 py-4 font-medium text-on-surface whitespace-nowrap">
                      {booking.date}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant text-xs whitespace-nowrap font-mono">
                      {booking.time} – {booking.endTime}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant font-medium whitespace-nowrap">
                      {booking.courtName}
                    </td>
                    <td className="px-6 py-4 font-semibold text-on-surface whitespace-nowrap">
                      {booking.customerName}
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant text-xs whitespace-nowrap">
                      {booking.phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {booking.status === 'paid' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-secondary-container text-on-secondary-container">
                          Paid
                        </span>
                      )}
                      {booking.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800">
                          Pending
                        </span>
                      )}
                      {booking.status === 'confirmed' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-teal-100 text-teal-800 border-teal-200">
                          Confirmed
                        </span>
                      )}
                      {booking.status === 'cancelled' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-red-500 text-red-500 bg-transparent">
                          Cancelled
                        </span>
                      )}
                      {booking.status === 'completed' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container-highest text-on-surface-variant">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-on-surface whitespace-nowrap">
                      {formatCurrency(booking.amount)}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => onOpenBookingDetails(booking.bookingId)}
                        className="text-primary hover:underline font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm text-on-surface-variant font-sans">
                    No matching bookings found. Try adjusting or clearing search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Row */}
        <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs font-semibold text-on-surface-variant">
            Showing <strong className="text-on-surface">{Math.min(startIndex + 1, totalEntries)}</strong> to{' '}
            <strong className="text-on-surface">{endIndex}</strong> of{' '}
            <strong className="text-on-surface">{totalEntries}</strong> entries
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-xs font-semibold text-outline hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none uppercase tracking-wider"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded transition-all ${
                  currentPage === pageNum
                    ? 'bg-primary text-on-primary shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                {pageNum}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-xs font-semibold text-on-surface-variant hover:text-primary transition-colors disabled:opacity-30 disabled:pointer-events-none uppercase tracking-wider"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Bottom KPI Cards — real data only */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 border border-outline-variant rounded-lg hover:border-primary transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              all time
            </span>
          </div>
          <h3 className="text-2xl font-bold font-headline text-on-surface">{formatCurrency(revenueAllTime)}</h3>
          <p className="text-xs text-on-surface-variant mt-1">Total revenue (non-cancelled)</p>
        </div>

        <div className="bg-white p-6 border border-outline-variant rounded-lg hover:border-primary transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              {mostBookedCount} booking{mostBookedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <h3 className="text-2xl font-bold font-headline text-on-surface truncate">{mostBookedCourt}</h3>
          <p className="text-xs text-on-surface-variant mt-1">Most booked court</p>
        </div>

        <div className="bg-white p-6 border border-outline-variant rounded-lg hover:border-primary transition-all duration-300">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-secondary-container rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">
              by phone number
            </span>
          </div>
          <h3 className="text-2xl font-bold font-headline text-on-surface">{uniqueCustomers}</h3>
          <p className="text-xs text-on-surface-variant mt-1">Unique customers</p>
        </div>
      </div>
    </div>
  );
}
