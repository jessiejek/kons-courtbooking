import { useState } from 'react';
import {
  Plus,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Clock,
  Trash2,
  Save,
  X,
  CreditCard,
  ArrowLeft,
  Settings
} from 'lucide-react';
import { Court, DayOfWeek, TimePriceRange } from '../types';
import { useToast, ToastContainer } from '../../components/Toast';

interface CourtsPricingViewProps {
  courts: Court[];
  onEditCourtDetails: (courtId: number) => void;
  onAddNewCourt: () => void;
  onUpdateCourtPricing: (courtId: number, day: DayOfWeek, ranges: TimePriceRange[]) => void;
}

export default function CourtsPricingView({ 
  courts, 
  onEditCourtDetails, 
  onAddNewCourt,
  onUpdateCourtPricing
}: CourtsPricingViewProps) {
  const { toasts, toast, removeToast } = useToast();
  // Focus state: ID of court we are actively editing pricing for. Defaults to Court 1.
  const [selectedPricingCourtId, setSelectedPricingCourtId] = useState<number | null>(1);
  const [activeDay, setActiveDay] = useState<DayOfWeek>('Wed');

  // Load court matching selectedPricingCourtId
  const selectedCourt = courts.find(c => c.id === selectedPricingCourtId) || courts[0];

  // Pricing setup local state before saving
  const [localRanges, setLocalRanges] = useState<TimePriceRange[]>(() => {
    if (selectedCourt) {
      return [...(selectedCourt.pricing[activeDay] || [])];
    }
    return [];
  });

  // Track the court/day last loaded to reset state when focus changes
  const [loadedKey, setLoadedKey] = useState<string>('1-Wed');
  const currentKey = `${selectedCourt?.id}-${activeDay}`;

  if (currentKey !== loadedKey) {
    setLocalRanges([...(selectedCourt?.pricing[activeDay] || [])]);
    setLoadedKey(currentKey);
  }

  // Handle local range editing
  const handleRangeFieldChange = (index: number, field: keyof TimePriceRange, value: any) => {
    const updated = [...localRanges];
    updated[index] = {
      ...updated[index],
      [field]: field === 'rate' ? Number(value) : value
    };
    setLocalRanges(updated);
  };

  const handleAddNewRange = () => {
    const newRange: TimePriceRange = {
      id: `new-${Date.now()}`,
      start: '09:00 AM',
      end: '05:00 PM',
      rate: selectedCourt?.defaultPrice || 350
    };
    setLocalRanges([...localRanges, newRange]);
  };

  const handleDeleteRange = (index: number) => {
    setLocalRanges(localRanges.filter((_, i) => i !== index));
  };

  const handleSavePricing = () => {
    if (!selectedCourt) return;
    onUpdateCourtPricing(selectedCourt.id, activeDay, localRanges);
    toast('success', 'Pricing saved', `${activeDay} pricing updated for ${selectedCourt.name}.`);
  };

  const handleDiscardChanges = () => {
    if (selectedCourt) {
      setLocalRanges([...(selectedCourt.pricing[activeDay] || [])]);
      toast('info', 'Changes discarded');
    }
  };

  return (
    <div className="space-y-10 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {/* SECTION 1: Courts List Grid */}
      <section id="courts-list" className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-outline-variant/30 pb-4">
          <div>
            <h2 className="text-3xl font-bold font-headline text-on-surface tracking-tight">Courts &amp; Pricing Setup</h2>
            <p className="text-sm text-on-surface-variant mt-1 font-medium">
              Manage your courts and set custom pricing models for individual time slots.
            </p>
          </div>
          <button
            onClick={onAddNewCourt}
            className="bg-primary text-on-primary font-semibold text-xs py-2.5 px-5 rounded-lg hover:bg-opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Add Court</span>
          </button>
        </div>

        {/* Dynamic Court Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courts.map((court) => {
            const isActive = court.status === 'active';
            const isMaintenance = court.status === 'maintenance';
            
            return (
              <div 
                key={court.id}
                className="bg-white border border-outline-variant p-6 rounded-lg space-y-4 hover:border-primary transition-all shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg text-on-surface">{court.name}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-container text-on-surface-variant mt-1.5">
                        {court.surfaceType}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span className={`flex items-center gap-1.5 text-xs font-semibold ${
                      isActive ? 'text-primary' : isMaintenance ? 'text-amber-600' : 'text-outline'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${
                        isActive ? 'bg-primary' : isMaintenance ? 'bg-amber-500' : 'bg-gray-400'
                      }`} />
                      <span className="uppercase tracking-wider">{court.status}</span>
                    </span>
                  </div>

                  <div className="space-y-2.5 py-4 border-t border-b border-outline-variant/30 my-4 text-sm font-medium">
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Operating Hours</span>
                      <span className="text-on-surface">
                        {court.opensAt === '06:00' ? '6:00 AM' : court.opensAt} - {court.closesAt === '22:00' ? '10:00 PM' : court.closesAt}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-on-surface-variant">Default Price</span>
                      <span className="text-on-surface font-extrabold text-primary">
                        ₱{court.defaultPrice}/hr
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Action controls */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={() => onEditCourtDetails(court.id)}
                    className="border border-outline-variant px-4 py-2 rounded text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors uppercase tracking-wider"
                  >
                    Edit Details
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPricingCourtId(court.id);
                      setTimeout(() => {
                        document.getElementById('rate-editor')?.scrollIntoView({ behavior: 'smooth' });
                      }, 100);
                    }}
                    className="bg-primary text-on-primary px-4 py-2 rounded text-xs font-bold hover:bg-opacity-95 transition-colors uppercase tracking-wider shadow-sm"
                  >
                    Manage Pricing
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Dynamic Custom Rate Editor for Selected Court */}
      {selectedCourt && (
        <section id="rate-editor" className="pt-8 border-t border-outline-variant/30">
          <div className="bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            
            {/* Table Header Section */}
            <div className="p-6 md:p-8 border-b border-outline-variant bg-surface-container-low/10">
              <div className="flex items-center gap-2 mb-2">
                <a 
                  href="#courts-list" 
                  className="text-primary font-bold text-xs flex items-center gap-1 hover:underline uppercase tracking-wider"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to courts grid</span>
                </a>
              </div>
              <h3 className="text-2xl font-bold font-headline text-on-surface">
                {selectedCourt.name} ({selectedCourt.surfaceType === 'indoor' ? 'Indoor' : 'Outdoor'}) — Custom Pricing
              </h3>
              <p className="text-xs text-on-surface-variant mt-1 font-medium">
                Define premium slot pricing. Highlighted days support slot overrides.
              </p>
            </div>

            {/* Days of the Week tabs */}
            <div className="flex border-b border-outline-variant overflow-x-auto scrollbar-none bg-surface-container-low/20">
              {(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as DayOfWeek[]).map((day) => {
                const isActive = activeDay === day;
                return (
                  <button
                    key={day}
                    onClick={() => setActiveDay(day)}
                    className={`px-8 py-4 font-bold text-sm transition-all focus:outline-none whitespace-nowrap min-w-[70px] uppercase tracking-wider ${
                      isActive
                        ? 'text-primary border-b-2 border-primary bg-white'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Pricing Config Layout */}
            <div className="p-6 md:p-8 space-y-6">
              <div className="space-y-4">
                {/* Labels for Rows */}
                <div className="grid grid-cols-12 gap-4 px-4 hidden md:flex font-bold text-xs text-outline uppercase tracking-wider">
                  <div className="col-span-5">Time Range Window</div>
                  <div className="col-span-4">Price Per Hour (PHP)</div>
                  <div className="col-span-3 text-right pr-4">Action</div>
                </div>

                {/* Range Setup Row Loop */}
                {localRanges.map((range, index) => (
                  <div 
                    key={range.id}
                    className="grid grid-cols-1 md:grid-cols-12 items-center gap-4 p-4 border border-outline-variant rounded-lg hover:border-primary transition-colors bg-surface-container-low/20"
                  >
                    {/* Time Inputs */}
                    <div className="col-span-12 md:col-span-5 flex items-center gap-2">
                      <input
                        type="text"
                        value={range.start}
                        onChange={(e) => handleRangeFieldChange(index, 'start', e.target.value)}
                        placeholder="06:00 AM"
                        className="w-full bg-white border border-outline-variant rounded px-3 py-2 text-sm text-center font-bold font-mono focus:border-primary focus:ring-0"
                      />
                      <span className="text-xs font-semibold text-outline uppercase">to</span>
                      <input
                        type="text"
                        value={range.end}
                        onChange={(e) => handleRangeFieldChange(index, 'end', e.target.value)}
                        placeholder="09:00 AM"
                        className="w-full bg-white border border-outline-variant rounded px-3 py-2 text-sm text-center font-bold font-mono focus:border-primary focus:ring-0"
                      />
                    </div>

                    {/* Rate Input */}
                    <div className="col-span-9 md:col-span-4 relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-extrabold text-sm text-on-surface-variant">₱</span>
                      <input
                        type="number"
                        value={range.rate}
                        onChange={(e) => handleRangeFieldChange(index, 'rate', e.target.value)}
                        placeholder="350"
                        className="w-full bg-white border border-outline-variant rounded pl-8 pr-3 py-2 text-sm font-bold focus:border-primary focus:ring-0"
                      />
                    </div>

                    {/* Delete actions */}
                    <div className="col-span-3 md:col-span-3 flex justify-end">
                      <button
                        onClick={() => handleDeleteRange(index)}
                        className="p-2 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete this time slot pricing rule"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}

                {localRanges.length === 0 && (
                  <div className="text-center py-10 border border-dashed border-outline-variant rounded-lg">
                    <p className="text-sm text-on-surface-variant">
                      No customer slot definitions map for {activeDay}. Double-check default court pricing!
                    </p>
                  </div>
                )}
              </div>

              {/* Add Range & Info Box */}
              <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-outline-variant/30">
                <button
                  type="button"
                  onClick={handleAddNewRange}
                  className="flex items-center gap-2 font-bold text-xs text-primary border border-primary px-5 py-2.5 rounded-lg hover:bg-secondary-container transition-all uppercase tracking-wider"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Price Range</span>
                </button>
                
                <p className="flex items-start gap-2 text-[11px] text-outline max-w-md italic leading-relaxed">
                  <span className="font-bold text-primary">NOTE:</span>
                  Proportional charging is automatically calculated if a booking crosses multiple rate windows during club operations.
                </p>
              </div>
            </div>

            {/* Sticky/Fixed-ish actions bar below editing viewport */}
            <div className="bg-surface-container p-6 rounded-b-xl flex justify-end gap-3 border-t border-outline-variant/50">
              <button
                type="button"
                onClick={handleDiscardChanges}
                className="px-5 py-2.5 font-bold text-xs text-on-surface hover:bg-surface-container-high transition-colors uppercase tracking-wider"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={handleSavePricing}
                className="bg-primary hover:bg-opacity-95 text-on-primary font-bold text-xs uppercase tracking-wider px-8 py-2.5 rounded-lg shadow-sm flex items-center gap-2 active:scale-98 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Save pricing details</span>
              </button>
            </div>

          </div>
        </section>
      )}

    </div>
  );
}
