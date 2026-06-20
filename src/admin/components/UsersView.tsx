import { useState, useEffect } from 'react';
import { Search, Users, Phone, Mail, Calendar, ShieldCheck } from 'lucide-react';
import { supabase, isSupabaseEnabled } from '../../lib/supabase';

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  created_at: string;
  booking_count: number;
}

export default function UsersView() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    if (!isSupabaseEnabled || !supabase) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, role, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (!profiles) { setLoading(false); return; }

    // Get booking counts per user email
    const { data: bookings } = await supabase
      .from('bookings')
      .select('customer_email');

    const countMap: Record<string, number> = {};
    (bookings ?? []).forEach((b: any) => {
      if (b.customer_email) countMap[b.customer_email] = (countMap[b.customer_email] ?? 0) + 1;
    });

    setUsers(profiles.map((p: any) => ({
      ...p,
      booking_count: countMap[p.email ?? ''] ?? 0,
    })));
    setLoading(false);
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const admins = filtered.filter(u => u.role === 'admin');
  const players = filtered.filter(u => u.role !== 'admin');

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const UserCard = ({ u }: { u: UserRow }) => (
    <div className="bg-white border border-outline-variant/40 rounded-xl p-4 shadow-sm flex items-start gap-3">
      <div className="shrink-0">
        {u.avatar_url
          ? <img src={u.avatar_url} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover border border-outline-variant/40" />
          : <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-sm">
              {(u.full_name?.[0] ?? u.email?.[0] ?? '?').toUpperCase()}
            </div>
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-sm text-on-surface truncate">{u.full_name ?? '—'}</span>
          {u.role === 'admin' && (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded">
              <ShieldCheck className="w-3 h-3" /> Admin
            </span>
          )}
        </div>
        <div className="mt-1 space-y-0.5">
          {u.email && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{u.email}</span>
            </div>
          )}
          {u.phone && (
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <Phone className="w-3 h-3 shrink-0" />
              <span>{u.phone}</span>
            </div>
          )}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-on-surface-variant">
              <Calendar className="w-3 h-3" /> Joined {fmtDate(u.created_at)}
            </span>
            <span className="text-[11px] font-bold text-primary">
              {u.booking_count} booking{u.booking_count !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface tracking-tight">Users</h2>
          <p className="text-sm text-on-surface-variant mt-0.5">{users.length} registered accounts</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, phone…"
            className="pl-9 pr-4 py-2 text-sm border border-outline-variant rounded-lg bg-surface focus:border-primary focus:ring-0 w-full sm:w-64"
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total users', value: users.length },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length },
          { label: 'Players', value: users.filter(u => u.role !== 'admin').length },
        ].map(s => (
          <div key={s.label} className="bg-white border border-outline-variant/40 rounded-xl p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline">{s.label}</p>
            <p className="text-2xl font-extrabold text-on-surface mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-on-surface-variant animate-pulse">Loading users…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-on-surface-variant">No users found.</div>
      ) : (
        <div className="space-y-6">
          {admins.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-outline mb-3">Admins</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {admins.map(u => <UserCard key={u.id} u={u} />)}
              </div>
            </div>
          )}
          {players.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-outline mb-3">Players</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {players.map(u => <UserCard key={u.id} u={u} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
