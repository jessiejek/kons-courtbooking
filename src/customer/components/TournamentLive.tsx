import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Zap, Shield, Skull, RefreshCw, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { getTeamName } from '../../lib/tournamentBracket';
import type { TPlayer, TMatch } from '../../lib/tournamentBracket';
import BracketView from '../../components/BracketView';

interface Tournament {
  id: string;
  name: string;
  date: string;
  status: 'registration' | 'seeding' | 'active' | 'completed';
}

function PlayerCard({ player, rank }: { player: TPlayer; rank: number }) {
  const alive   = player.status !== 'eliminated';
  const danger  = player.losses === 1;
  return (
    <div className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all
      ${!alive    ? 'bg-gray-900/40 border-gray-700/40 opacity-50' :
        danger    ? 'bg-amber-950/60 border-amber-500/50 shadow-amber-900/30 shadow-lg' :
                    'bg-gray-800/80 border-green-700/50 shadow-green-900/20 shadow-lg'}`}>
      <span className={`text-[10px] font-black w-5 text-center shrink-0
        ${!alive ? 'text-gray-600' : danger ? 'text-amber-400' : 'text-green-400'}`}>
        {rank}
      </span>
      <span className={`text-sm font-bold flex-1 truncate
        ${!alive ? 'text-gray-500 line-through' : danger ? 'text-amber-200' : 'text-white'}`}>
        {player.player_name}
      </span>
      {!alive  && <Skull className="w-3.5 h-3.5 text-gray-600 shrink-0" />}
      {alive && danger  && (
        <span className="flex items-center gap-1 text-[9px] font-black text-amber-400 bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-500/40">
          <Shield className="w-2.5 h-2.5" /> 1 LOSS
        </span>
      )}
      {alive && !danger && (
        <span className="flex items-center gap-1 text-[9px] font-black text-green-400 bg-green-900/40 px-2 py-0.5 rounded-full border border-green-600/30">
          <Zap className="w-2.5 h-2.5" /> ALIVE
        </span>
      )}
    </div>
  );
}

function LiveScoreboard({ match, players }: { match: TMatch; players: TPlayer[] }) {
  const teamA = getTeamName(match, 'A', players);
  const teamB = getTeamName(match, 'B', players);
  const label = match.bracket === 'winners' ? 'Winners Bracket' :
                match.bracket === 'losers'  ? 'Losers Bracket' : '🏆 Grand Final';
  const isGF  = match.bracket === 'grand_final';
  return (
    <div className={`rounded-3xl overflow-hidden border shadow-2xl
      ${isGF ? 'border-amber-500/60 shadow-amber-900/40' : 'border-red-500/40 shadow-red-900/30'}`}>
      {/* top bar */}
      <div className={`flex items-center justify-center gap-3 px-6 py-2.5
        ${isGF ? 'bg-gradient-to-r from-amber-600 to-yellow-500' : 'bg-red-600'}`}>
        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span className="text-xs font-black uppercase tracking-widest text-white">LIVE NOW</span>
        <span className="text-xs text-white/70 font-semibold">· {label} · Round {match.round}</span>
      </div>
      {/* scoreboard */}
      <div className={`grid grid-cols-[1fr_auto_1fr] items-center gap-0
        ${isGF ? 'bg-gradient-to-b from-amber-950/80 to-gray-900' : 'bg-gray-900'}`}>
        {/* Team A */}
        <div className={`text-center px-6 py-8 ${match.winner_team === 'A' ? 'bg-green-900/30' : ''}`}>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Team A</p>
          <p className="text-lg font-black text-white leading-tight">{teamA.replace(' & ', '\n& ')}</p>
          <p className={`text-6xl font-black mt-4 tabular-nums
            ${match.score_a > match.score_b ? 'text-green-400' : 'text-white'}`}>
            {match.score_a}
          </p>
        </div>
        {/* VS divider */}
        <div className="flex flex-col items-center gap-1 px-4">
          <div className="w-px h-16 bg-gray-700" />
          <span className="text-xs font-black text-gray-500 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">VS</span>
          <div className="w-px h-16 bg-gray-700" />
        </div>
        {/* Team B */}
        <div className={`text-center px-6 py-8 ${match.winner_team === 'B' ? 'bg-green-900/30' : ''}`}>
          <p className="text-xs font-black uppercase tracking-widest text-gray-400 mb-2">Team B</p>
          <p className="text-lg font-black text-white leading-tight">{teamB.replace(' & ', '\n& ')}</p>
          <p className={`text-6xl font-black mt-4 tabular-nums
            ${match.score_b > match.score_a ? 'text-green-400' : 'text-white'}`}>
            {match.score_b}
          </p>
        </div>
      </div>
    </div>
  );
}

function ChampionBanner({ match, players }: { match: TMatch; players: TPlayer[] }) {
  if (!match.winner_team) return null;
  const champ = getTeamName(match, match.winner_team, players);
  const names = champ.split(' & ');
  return (
    <div className="relative rounded-3xl overflow-hidden border-2 border-amber-400/80 shadow-2xl shadow-amber-900/50">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-950 via-yellow-950 to-gray-900" />
      {/* Glow orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl" />
      <div className="relative z-10 text-center px-8 py-12">
        {/* Stars */}
        <div className="flex justify-center gap-1 mb-4">
          {[0,1,2,3,4].map(i => (
            <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
          ))}
        </div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-amber-400 mb-3">Tournament Champion</p>
        <div className="text-6xl mb-5">🏆</div>
        {names.map((name, i) => (
          <p key={i} className="text-3xl md:text-4xl font-black text-white leading-tight">{name}</p>
        ))}
        {names.length > 1 && (
          <p className="text-amber-400/70 font-bold text-lg mt-1">Partnership</p>
        )}
        <div className="mt-8 inline-flex items-center gap-2 px-5 py-2 bg-amber-400/10 border border-amber-400/30 rounded-full">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-black text-amber-300">Double Elimination · Grand Final Victory</span>
        </div>
      </div>
    </div>
  );
}

export default function TournamentLive() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers]       = useState<TPlayer[]>([]);
  const [matches, setMatches]       = useState<TMatch[]>([]);
  const [loading, setLoading]       = useState(true);

  const load = async () => {
    if (!supabase || !id) return;
    const [{ data: t }, { data: p }, { data: m }] = await Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('tournament_players').select('*').eq('tournament_id', id).order('seed'),
      supabase.from('tournament_matches').select('*').eq('tournament_id', id).order('round').order('match_number'),
    ]);
    if (t) setTournament(t as Tournament);
    if (p) setPlayers(p as TPlayer[]);
    if (m) setMatches(m as TMatch[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (!id || !supabase) return;
    const ch = supabase.channel(`tournament-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id]);

  const grandFinal = matches.find(m => m.bracket === 'grand_final');
  const liveMatch  = matches.find(m => m.status === 'active');
  const isCompleted = tournament?.status === 'completed';

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-green-400 animate-spin" />
        <p className="text-gray-500 text-sm font-semibold">Loading bracket…</p>
      </div>
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-500">Tournament not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#003d2c] to-gray-950 border-b border-green-900/40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#00694c22_0%,_transparent_70%)]" />
        <div className="relative max-w-5xl mx-auto px-6 py-10">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-[0.25em] text-green-400/80">Sunshine Pickleball</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight">{tournament.name}</h1>
              <p className="text-gray-400 text-sm mt-2 font-semibold">{tournament.date} · Double Elimination</p>
            </div>
            <div className={`shrink-0 px-4 py-2 rounded-full font-black text-xs uppercase tracking-widest border
              ${isCompleted              ? 'bg-amber-400/10 border-amber-400/50 text-amber-300' :
                tournament.status === 'active' ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                'bg-gray-700/50 border-gray-600 text-gray-300'}`}>
              {isCompleted ? '🏆 Completed' :
               tournament.status === 'active' ? '🔴 Live' :
               tournament.status.toUpperCase()}
            </div>
          </div>

          {/* Quick stats */}
          {players.length > 0 && (
            <div className="flex gap-6 mt-6 flex-wrap">
              <div>
                <p className="text-2xl font-black text-white">{players.length}</p>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Players</p>
              </div>
              <div className="w-px bg-gray-800" />
              <div>
                <p className="text-2xl font-black text-white">{matches.filter(m => m.status === 'completed').length}</p>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Matches Played</p>
              </div>
              <div className="w-px bg-gray-800" />
              <div>
                <p className="text-2xl font-black text-white">{players.filter(p => p.status !== 'eliminated').length}</p>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Still In</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Champion banner ── */}
        {isCompleted && grandFinal && (
          <ChampionBanner match={grandFinal} players={players} />
        )}

        {/* ── Live scoreboard ── */}
        {liveMatch && <LiveScoreboard match={liveMatch} players={players} />}

        {/* ── Player roster ── */}
        {players.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">Player Standings</p>
              <div className="flex-1 h-px bg-gray-800" />
              <p className="text-xs text-gray-600 font-semibold">{players.filter(p => p.status !== 'eliminated').length} / {players.length} remaining</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {players.map((p, i) => <PlayerCard key={p.id} player={p} rank={i + 1} />)}
            </div>
          </div>
        )}

        {/* ── Bracket ── */}
        {matches.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <p className="text-xs font-black uppercase tracking-widest text-gray-500">Bracket</p>
              <div className="flex-1 h-px bg-gray-800" />
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 overflow-x-auto">
              <BracketView matches={matches} players={players} />
            </div>
          </div>
        )}

        {/* ── Registration / waiting state ── */}
        {tournament.status === 'registration' && (
          <div className="text-center py-16 space-y-3">
            <Trophy className="w-14 h-14 mx-auto text-gray-700" />
            <p className="text-lg font-black text-gray-400">Tournament hasn't started yet</p>
            <p className="text-sm text-gray-600">Check back soon — bracket drops when registration closes.</p>
          </div>
        )}

      </div>
    </div>
  );
}
