import { useState, useEffect, FormEvent } from 'react';
import {
  ArrowLeft,
  Clock,
  Trash2,
  Save,
  Sparkles,
  AlertOctagon,
  CheckCircle2,
  Hammer,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { Court, CourtStatus, CourtSurface, DayOfWeek } from '../types';
import { createDefaultPricingForDay } from '../data';
import { useToast, ToastContainer } from '../../components/Toast';
import ConfirmModal, { ConfirmOptions } from '../../components/ConfirmModal';

interface AddEditCourtViewProps {
  editCourtId: number | 'new' | null;
  courts: Court[];
  onSaveCourt: (court: Court) => Promise<string | null>;
  onDeleteCourt: (courtId: number) => void;
  onCancel: () => void;
}

export default function AddEditCourtView({
  editCourtId,
  courts,
  onSaveCourt,
  onDeleteCourt,
  onCancel
}: AddEditCourtViewProps) {
  const isNew = editCourtId === 'new';
  const existingCourt = !isNew ? courts.find(c => c.id === editCourtId) : null;

  // Form states initialized with existing values if editing
  const [name, setName] = useState('');
  const [surfaceType, setSurfaceType] = useState<CourtSurface>('indoor');
  const [opensAt, setOpensAt] = useState('06:00');
  const [closesAt, setClosesAt] = useState('22:00');
  const [useCustomSchedule, setUseCustomSchedule] = useState(false);
  const [defaultPrice, setDefaultPrice] = useState(350);
  const [status, setStatus] = useState<CourtStatus>('active');
  const { toasts, toast, removeToast } = useToast();
  const [confirmOpts, setConfirmOpts] = useState<ConfirmOptions | null>(null);

  // Load existing court state upon mounting or change
  useEffect(() => {
    if (existingCourt) {
      setName(existingCourt.name);
      setSurfaceType(existingCourt.surfaceType);
      setOpensAt(existingCourt.opensAt);
      setClosesAt(existingCourt.closesAt);
      setDefaultPrice(existingCourt.defaultPrice);
      setStatus(existingCourt.status);
    } else {
      // Default initial states for 'new'
      setName('');
      setSurfaceType('indoor');
      setOpensAt('06:00');
      setClosesAt('22:00');
      setDefaultPrice(300);
      setStatus('active');
    }
  }, [existingCourt, editCourtId]);

  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast('warning', 'Court name required', 'Please provide a name for this court.');
      return;
    }

    const days: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const initialPricing = existingCourt
      ? existingCourt.pricing
      : days.reduce((acc, d) => {
          acc[d] = createDefaultPricingForDay(d);
          return acc;
        }, {} as Record<DayOfWeek, any[]>);

    const updatedCourt: Court = {
      id: existingCourt ? existingCourt.id : Date.now(),
      name,
      surfaceType,
      opensAt,
      closesAt,
      defaultPrice: Number(defaultPrice),
      status,
      pricing: initialPricing,
    };

    setIsSaving(true);
    const err = await onSaveCourt(updatedCourt);
    setIsSaving(false);

    if (err) {
      toast('error', 'Save failed', err);
      return;
    }

    toast('success', existingCourt ? 'Court updated' : 'Court created', `${name} has been saved.`);
    setTimeout(onCancel, 800);
  };

  const handleDelete = () => {
    if (!existingCourt) return;
    setConfirmOpts({
      title: 'Delete Court',
      message: `Are you sure you want to permanently delete "${existingCourt.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onCancel: () => setConfirmOpts(null),
      onConfirm: () => {
        setConfirmOpts(null);
        onDeleteCourt(existingCourt.id);
        onCancel();
      },
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 animate-fade-in pb-32">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmOpts && <ConfirmModal {...confirmOpts} />}
      {/* Breadcrumbs Navigation */}
      <div className="mb-6">
        <button
          onClick={onCancel}
          className="flex items-center gap-2 text-primary hover:text-opacity-85 font-bold text-xs transition-all uppercase tracking-wider focus:outline-none"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to courts pricing</span>
        </button>
      </div>

      {/* Main Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold font-headline text-on-surface tracking-tight">
          {isNew ? 'Add a New Court' : `Edit ${name || 'Court Details'}`}
        </h2>
        <p className="text-sm text-on-surface-variant mt-1 font-medium">
          {isNew ? 'Set up a new court and define standard availability.' : 'Update physical court properties, active status & pricing defaults.'}
        </p>
      </div>

      {/* Forms inputs container */}
      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* SECTION 1: BASIC CONF */}
        <section className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest border-b border-outline-variant/30 pb-2">
            Basic Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Court Name option */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Court Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Court 4"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:outline-none focus:border-primary font-sans font-medium"
              />
            </div>

            {/* Surface Type selection */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                Surface Type
              </label>
              <select
                value={surfaceType}
                onChange={(e) => setSurfaceType(e.target.value as CourtSurface)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 text-sm focus:outline-none focus:border-primary font-sans font-medium"
              >
                <option value="indoor">Indoor</option>
                <option value="outdoor">Outdoor</option>
              </select>
            </div>
          </div>
        </section>

        {/* SECTION 2: ACCESS & PRICING RULES */}
        <section className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm space-y-6">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest border-b border-outline-variant/30 pb-2">
            Availability &amp; Pricing Defaults
          </h3>

          {/* Schedule toggle */}
          <div className="flex items-center justify-between bg-surface-container-low/40 border border-outline-variant rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-bold text-on-surface">Custom Schedule</p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                {useCustomSchedule ? 'This court uses its own opening hours.' : 'Following global schedule (06:00 AM – 10:00 PM).'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUseCustomSchedule(v => !v)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${useCustomSchedule ? 'bg-primary' : 'bg-outline-variant'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${useCustomSchedule ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          {useCustomSchedule && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Opens At */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Opens At
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    value={opensAt}
                    onChange={(e) => setOpensAt(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-3 p-3 text-sm font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* Closes At */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
                  Closes At
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="time"
                    value={closesAt}
                    onChange={(e) => setClosesAt(e.target.value)}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-10 pr-3 p-3 text-sm font-bold focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Hourly price rule */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Default price per hour
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-sm text-on-surface-variant">₱</span>
              <input
                type="number"
                value={defaultPrice}
                onChange={(e) => setDefaultPrice(Number(e.target.value))}
                placeholder="e.g. 300"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg pl-8 p-3 text-sm font-bold focus:outline-none focus:border-primary"
              />
            </div>
            <p className="text-[11px] text-outline font-medium italic mt-1.5 leading-relaxed">
              Default rate standard. Applied dynamically during hours when no custom interval overrides are established in the pricing matrix.
            </p>
          </div>
        </section>

        {/* SECTION 3: COURT STATUS ACTION GROUP */}
        <section className="bg-white border border-outline-variant p-6 rounded-xl shadow-sm space-y-5">
          <h3 className="text-xs font-bold text-outline uppercase tracking-widest border-b border-outline-variant/30 pb-2">
            Court Status Selector
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Active Card option */}
            <div 
              onClick={() => setStatus('active')}
              className={`border-2 rounded-lg p-4 flex gap-3 items-start cursor-pointer transition-all duration-200 ${
                status === 'active'
                  ? 'border-primary bg-primary-container/5'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className="mt-1">
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Active</p>
                <p className="text-[10px] text-on-surface-variant mt-1 leading-normal font-medium">Ready for member &amp; guest bookings instantly.</p>
              </div>
            </div>

            {/* Maintenance card option */}
            <div 
              onClick={() => setStatus('maintenance')}
              className={`border-2 rounded-lg p-4 flex gap-3 items-start cursor-pointer transition-all duration-200 ${
                status === 'maintenance'
                  ? 'border-amber-500 bg-amber-50/20'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className="mt-1">
                <Hammer className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Maintenance</p>
                <p className="text-[10px] text-on-surface-variant mt-1 leading-normal font-medium">Temporarily closed for repairs or conditioning.</p>
              </div>
            </div>

            {/* Inactive card option */}
            <div 
              onClick={() => setStatus('inactive')}
              className={`border-2 rounded-lg p-4 flex gap-3 items-start cursor-pointer transition-all duration-200 ${
                status === 'inactive'
                  ? 'border-slate-500 bg-slate-50'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className="mt-1">
                <EyeOff className="w-4 h-4 text-slate-500" />
              </div>
              <div>
                <p className="text-sm font-bold text-on-surface">Inactive</p>
                <p className="text-[10px] text-on-surface-variant mt-1 leading-normal font-medium">Hidden from lists and public terminal reservation screens.</p>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 4: Danger Zone for existing courts */}
        {!isNew && existingCourt && (
          <section className="bg-red-50/30 border border-red-500/20 p-6 rounded-xl space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1 max-w-xl">
                <h3 className="text-base font-bold text-red-600 flex items-center gap-1.5 font-headline">
                  <AlertOctagon className="w-5 h-5 text-red-500" />
                  <span>Danger Zone</span>
                </h3>
                <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
                  Permanently take down {existingCourt.name} pricing details, rules, and history from calculations. Past bookings will not be altered.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDelete}
                className="bg-white hover:bg-red-50 border border-red-500 text-red-600 px-5 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all whitespace-nowrap"
              >
                Delete Court Permanently
              </button>
            </div>
          </section>
        )}

        {/* STICKY FOOTER ACTIONS BAR */}
        <footer className="fixed bottom-0 left-64 right-0 bg-white/90 backdrop-blur-md border-t border-outline-variant px-10 py-5 z-40">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="text-on-surface-variant hover:text-on-surface transition-all font-bold text-xs uppercase tracking-wider underline underline-offset-4"
            >
              Discard changes
            </button>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-outline font-semibold">
                Auto-saving draft...
              </span>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-primary hover:bg-opacity-95 text-white px-10 py-3 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </footer>

      </form>
    </div>
  );
}
