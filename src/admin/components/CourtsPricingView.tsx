import { useState, useEffect } from 'react';
import {
  Plus, Trash2, Save, Globe, Lock, Unlock, ChevronDown, ChevronUp, AlertTriangle, Check, Loader2
} from 'lucide-react';
import { Court, DayOfWeek, TimePriceRange } from '../types';
import { useToast, ToastContainer } from '../../components/Toast';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

// ── Types ────────────────────────────────────────────────────
export interface GlobalPricing {
  ranges: TimePriceRange[];
}

export interface CourtPricingOverride {
  courtId: number;
  useGlobal: boolean;
  ranges: TimePriceRange[];
}

interface CourtsPricingViewProps {
  courts: Court[];
  onEditCourtDetails: (courtId: number) => void;
  onAddNewCourt: () => void;
  onUpdateCourtPricing: (courtId: number, day: DayOfWeek, ranges: TimePriceRange[]) => void;
}

const DAYS: DayOfWeek[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DEFAULT_GLOBAL_RANGES: TimePriceRange[] = [
  { id: 'g-1', start: '06:00', end: '10:00', rate: 250 },
  { id: 'g-2', start: '10:00', end: '17:00', rate: 300 },
  { id: 'g-3', start: '17:00', end: '23:00', rate: 350 },
];

// ── Reusable range editor ────────────────────────────────────
function RangeEditor({
  ranges,
  onChange,
  defaultRate = 300,
}: {
  ranges: TimePriceRange[];
  onChange: (r: TimePriceRange[]) => void;
  defaultRate?: number;
}) {
  const update = (i: number, field: keyof TimePriceRange, val: any) => {
    const next = [...ranges];
    next[i] = { ...next[i], [field]: field === 'rate' ? Number(val) : val };
    onChange(next);
  };

  const add = () => onChange([
    ...ranges,
    { id: `r-${Date.now()}`, start: '09:00', end: '17:00', rate: defaultRate },
  ]);

  const remove = (i: number) => onChange(ranges.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      {ranges.length === 0 && (
        <div className="text-center py-8 border border-dashed border-outline-variant rounded-xl text-sm text-on-surface-variant">
          No time ranges defined. Add one below.
        </div>
      )}
      {ranges.map((r, i) => (
        <div key={r.id} className="flex items-center gap-3 bg-surface-container-low/30 border border-outline-variant rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1">From</span>
              <input
                type="time"
                value={r.start}
                onChange={(e) => update(i, 'start', e.target.value)}
                className="bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono font-bold focus:border-primary focus:outline-none w-32"
              />
            </div>
            <span className="text-outline font-bold mt-4">→</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1">To</span>
              <input
                type="time"
                value={r.end}
                onChange={(e) => update(i, 'end', e.target.value)}
                className="bg-white border border-outline-variant rounded-lg px-3 py-2 text-sm font-mono font-bold focus:border-primary focus:outline-none w-32"
              />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wider text-outline mb-1">Rate / hr</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-extrabold text-sm text-on-surface-variant">₱</span>
              <input
                type="number"
                value={r.rate}
                onChange={(e) => update(i, 'rate', e.target.value)}
                className="bg-white border border-outline-variant rounded-lg pl-7 pr-3 py-2 text-sm font-bold focus:border-primary focus:outline-none w-28"
              />
            </div>
          </div>
          <button
            onClick={() => remove(i)}
            className="mt-4 p-2 text-outline hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-2 text-xs font-bold text-primary border border-primary/30 hover:border-primary hover:bg-secondary-container/30 px-4 py-2 rounded-lg transition-all uppercase tracking-wider"
      >
        <Plus className="w-3.5 h-3.5" /> Add Time Range
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────
export default function CourtsPricingView({
  courts,
  onEditCourtDetails,
  onAddNewCourt,
  onUpdateCourtPricing,
}: CourtsPricingViewProps) {
  const { toasts, toast, removeToast } = useToast();

  const [globalRanges, setGlobalRanges] = useState<TimePriceRange[]>(DEFAULT_GLOBAL_RANGES);
  const [globalDirty, setGlobalDirty] = useState(false);
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [courtOverrides, setCourtOverrides] = useState<Record<number, CourtPricingOverride>>(() =>
    Object.fromEntries(courts.map(c => [c.id, { courtId: c.id, useGlobal: true, ranges: [...DEFAULT_GLOBAL_RANGES] }]))
  );
  const [savingCourt, setSavingCourt] = useState<number | null>(null);
  const [expandedCourt, setExpandedCourt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Load from Supabase on mount ──────────────────────────────
  useEffect(() => {
    if (!isSupabaseEnabled || !supabase) { setLoading(false); return; }
    const load = async () => {
      setLoading(true);

      // Load global pricing (court_id is null)
      const { data: globalData } = await supabase
        .from('court_pricing')
        .select('*')
        .is('court_id', null)
        .order('start_time');

      if (globalData && globalData.length > 0) {
        const loaded = globalData.map((r: any) => ({
          id: r.id,
          start: r.start_time.slice(0, 5),
          end: r.end_time.slice(0, 5),
          rate: Number(r.rate),
        }));
        setGlobalRanges(loaded);
      }

      // Load per-court overrides + use_global_pricing flag
      const { data: courtData } = await supabase
        .from('courts')
        .select('id, use_global_pricing');

      const { data: priceData } = await supabase
        .from('court_pricing')
        .select('*')
        .not('court_id', 'is', null)
        .order('start_time');

      if (courtData) {
        const overrides: Record<number, CourtPricingOverride> = {};
        courtData.forEach((c: any) => {
          const courtRanges = (priceData ?? [])
            .filter((r: any) => r.court_id === c.id)
            .map((r: any) => ({
              id: r.id,
              start: r.start_time.slice(0, 5),
              end: r.end_time.slice(0, 5),
              rate: Number(r.rate),
            }));
          overrides[c.id] = {
            courtId: c.id,
            useGlobal: c.use_global_pricing ?? true,
            ranges: courtRanges.length > 0 ? courtRanges : [...DEFAULT_GLOBAL_RANGES],
          };
        });
        setCourtOverrides(overrides);
      }

      setLoading(false);
    };
    load();
  }, [courts.length]);

  // ── Save global pricing ──────────────────────────────────────
  const handleSaveGlobal = async () => {
    setSavingGlobal(true);
    if (isSupabaseEnabled && supabase) {
      await supabase.from('court_pricing').delete().is('court_id', null);
      const rows = globalRanges.map(r => ({
        court_id: null,
        day: 'Mon' as const,
        start_time: r.start,
        end_time: r.end,
        rate: r.rate,
      }));
      const { error } = await supabase.from('court_pricing').insert(rows);
      if (error) { toast('error', 'Failed to save', error.message); setSavingGlobal(false); return; }
    }

    // Propagate to courts still using global in local state
    setCourtOverrides(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        const cid = Number(id);
        if (next[cid].useGlobal) next[cid] = { ...next[cid], ranges: [...globalRanges] };
      });
      return next;
    });

    setGlobalDirty(false);
    setEditingGlobal(false);
    setSavingGlobal(false);
    toast('success', 'Global pricing saved', 'All courts on global pricing have been updated.');
  };

  const handleGlobalChange = (ranges: TimePriceRange[]) => {
    setGlobalRanges(ranges);
    setGlobalDirty(true);
  };

  // ── Toggle court override ────────────────────────────────────
  const handleToggleOverride = async (courtId: number) => {
    const current = courtOverrides[courtId];
    const useGlobal = !current.useGlobal;

    setCourtOverrides(prev => ({
      ...prev,
      [courtId]: { ...prev[courtId], useGlobal, ranges: useGlobal ? [...globalRanges] : [...current.ranges] },
    }));

    if (isSupabaseEnabled && supabase) {
      await supabase.from('courts').update({ use_global_pricing: useGlobal }).eq('id', courtId);
    }

    toast('info', useGlobal ? 'Reverted to global pricing' : 'Custom pricing enabled for this court');
  };

  const handleCourtRangeChange = (courtId: number, ranges: TimePriceRange[]) => {
    setCourtOverrides(prev => ({ ...prev, [courtId]: { ...prev[courtId], ranges } }));
  };

  // ── Save per-court override ──────────────────────────────────
  const handleSaveCourtOverride = async (courtId: number) => {
    const court = courts.find(c => c.id === courtId);
    const override = courtOverrides[courtId];
    setSavingCourt(courtId);

    if (isSupabaseEnabled && supabase) {
      // Delete existing per-court rows
      await supabase.from('court_pricing').delete().eq('court_id', courtId);

      // Insert new ranges
      const rows = override.ranges.map(r => ({
        court_id: courtId,
        day: 'Mon' as const, // placeholder — applies to all days
        start_time: r.start,
        end_time: r.end,
        rate: r.rate,
      }));

      if (rows.length > 0) {
        const { error } = await supabase.from('court_pricing').insert(rows);
        if (error) { toast('error', 'Failed to save', error.message); setSavingCourt(null); return; }
      }

      // Mark court as using custom pricing
      await supabase.from('courts').update({ use_global_pricing: false }).eq('id', courtId);
    }

    setSavingCourt(null);
    toast('success', 'Court pricing saved', `Custom pricing saved for ${court?.name}.`);
  };

  // ── Reset court to global ────────────────────────────────────
  const handleResetCourt = async (courtId: number) => {
    setCourtOverrides(prev => ({
      ...prev,
      [courtId]: { ...prev[courtId], useGlobal: true, ranges: [...globalRanges] },
    }));

    if (isSupabaseEnabled && supabase) {
      await supabase.from('courts').update({ use_global_pricing: true }).eq('id', courtId);
      await supabase.from('court_pricing').delete().eq('court_id', courtId);
    }

    toast('info', 'Reset to global pricing');
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 gap-3 text-on-surface-variant">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span className="text-sm font-medium">Loading pricing…</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-outline-variant/30 pb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-on-surface tracking-tight">Courts &amp; Pricing</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Set global time-based pricing, then override per court as needed.
          </p>
        </div>
        <button
          onClick={onAddNewCourt}
          className="bg-primary text-on-primary font-semibold text-xs py-2.5 px-5 rounded-lg hover:bg-opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 uppercase tracking-wider shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Court
        </button>
      </div>

      {/* ── SECTION 1: Global Pricing ── */}
      <section className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/30 bg-surface-container-low/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#e8f5ee] flex items-center justify-center">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-extrabold text-on-surface text-base">Global Pricing</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Default time-based rates applied to all courts. Courts can override this.
              </p>
            </div>
          </div>
          <button
            onClick={() => setEditingGlobal(v => !v)}
            className={`text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-lg border transition-all ${
              editingGlobal
                ? 'border-primary bg-primary text-on-primary'
                : 'border-outline-variant text-on-surface hover:border-primary hover:text-primary'
            }`}
          >
            {editingGlobal ? 'Editing…' : 'Edit Global Rates'}
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Preview / edit */}
          {!editingGlobal ? (
            <div className="space-y-2">
              {globalRanges.map((r, i) => (
                <div key={r.id} className="flex items-center justify-between py-2.5 px-4 bg-[#f9faf9] rounded-xl border border-outline-variant/40">
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center">{i + 1}</span>
                    <span className="font-mono text-sm font-bold text-on-surface">{r.start} → {r.end}</span>
                  </div>
                  <span className="font-extrabold text-primary text-sm">₱{r.rate}<span className="text-[10px] font-medium text-outline">/hr</span></span>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {globalDirty && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-xl px-4 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Unsaved changes. Courts using global pricing will update when you save.
                </div>
              )}
              <RangeEditor ranges={globalRanges} onChange={handleGlobalChange} defaultRate={300} />
              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/30">
                <button
                  onClick={() => { setEditingGlobal(false); setGlobalDirty(false); }}
                  className="px-5 py-2.5 text-xs font-bold text-on-surface hover:bg-surface-container rounded-lg uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGlobal}
                  disabled={savingGlobal}
                  className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-opacity-95 transition-all disabled:opacity-60"
                >
                  {savingGlobal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Global Pricing
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── SECTION 2: Per-Court Overrides ── */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <h3 className="font-extrabold text-on-surface text-lg">Per-Court Pricing</h3>
          <span className="text-xs text-on-surface-variant font-medium hidden sm:inline">— override global rates for specific courts</span>
        </div>

        {courts.map(court => {
          const override = courtOverrides[court.id] ?? { useGlobal: true, ranges: globalRanges, courtId: court.id };
          const isExpanded = expandedCourt === court.id;
          const isActive = court.status === 'active';

          return (
            <div key={court.id} className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm">
              {/* Court header row */}
              <div className="flex flex-wrap items-center gap-3 px-4 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <h4 className="font-extrabold text-on-surface text-sm">{court.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-surface-container text-on-surface-variant">{court.surfaceType}</span>
                    <span className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-primary' : 'text-amber-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-primary' : 'bg-amber-500'}`} />
                      {court.status}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {override.useGlobal
                      ? 'Using global pricing'
                      : `${override.ranges.length} custom time range${override.ranges.length !== 1 ? 's' : ''}`
                    }
                  </p>
                </div>

                {/* Global / Custom toggle */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onEditCourtDetails(court.id)}
                    className="text-xs font-semibold text-on-surface-variant border border-outline-variant px-3 py-1.5 rounded-lg hover:border-primary hover:text-primary transition-colors uppercase tracking-wider"
                  >
                    Edit Details
                  </button>

                  <button
                    onClick={() => handleToggleOverride(court.id)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all uppercase tracking-wider ${
                      override.useGlobal
                        ? 'bg-[#e8f5ee] border-primary/30 text-primary'
                        : 'bg-amber-50 border-amber-300 text-amber-700'
                    }`}
                  >
                    {override.useGlobal
                      ? <><Globe className="w-3.5 h-3.5" /> Global</>
                      : <><Lock className="w-3.5 h-3.5" /> Custom</>
                    }
                  </button>

                  <button
                    onClick={() => setExpandedCourt(isExpanded ? null : court.id)}
                    className="p-1.5 text-on-surface-variant hover:text-on-surface transition-colors rounded-lg hover:bg-surface-container"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded pricing editor */}
              {isExpanded && (
                <div className="border-t border-outline-variant/30 px-6 py-5 bg-surface-container-low/10 space-y-4">
                  {override.useGlobal ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                        <Check className="w-4 h-4 text-primary" />
                        This court inherits global pricing. Click <strong className="text-on-surface">Custom</strong> above to set court-specific rates.
                      </div>
                      <div className="space-y-2 opacity-60 pointer-events-none">
                        {globalRanges.map((r, i) => (
                          <div key={r.id} className="flex items-center justify-between py-2.5 px-4 bg-white rounded-xl border border-outline-variant/40">
                            <div className="flex items-center gap-3">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-extrabold flex items-center justify-center">{i + 1}</span>
                              <span className="font-mono text-sm font-bold text-on-surface">{r.start} → {r.end}</span>
                            </div>
                            <span className="font-extrabold text-primary text-sm">₱{r.rate}<span className="text-[10px] font-medium text-outline">/hr</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        Custom rates are active for this court and will override global pricing.
                      </div>
                      <RangeEditor
                        ranges={override.ranges}
                        onChange={(r) => handleCourtRangeChange(court.id, r)}
                        defaultRate={court.defaultPrice}
                      />
                      <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
                        <button
                          onClick={() => handleResetCourt(court.id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface border border-outline-variant px-4 py-2 rounded-lg uppercase tracking-wider transition-colors"
                        >
                          <Unlock className="w-3.5 h-3.5" /> Reset to Global
                        </button>
                        <button
                          onClick={() => handleSaveCourtOverride(court.id)}
                          disabled={savingCourt === court.id}
                          className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-opacity-95 transition-all disabled:opacity-60"
                        >
                          {savingCourt === court.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Save Court Pricing
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}
