import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, RefreshCw } from 'lucide-react';
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


function PlayerPill({ player }: { player: TPlayer }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-bold
      ${player.status === 'eliminated'
        ? 'bg-gray-100 text-gray-400 border-gray-200'
        : player.losses === 1
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-green-50 text-[#00694c] border-[#00694c]/20'
      }`}>
      {player.player_name}
      <span className="text-[9px] font-black">
        {player.status === 'eliminated' ? '❌' : player.losses === 1 ? '⚠️ 1L' : '✓'}
      </span>
    </div>
  );
}

export default function TournamentLive() {
  const { id } = useParams<{ id: string }>();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [players, setPlayers] = useState<TPlayer[]>([]);
  const [matches, setMatches] = useState<TMatch[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Realtime
  useEffect(() => {
    if (!id || !supabase) return;
    const channel = supabase.channel(`tournament-live-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_players', filter: `tournament_id=eq.${id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const grandFinal = matches.find(m => m.bracket === 'grand_final');
  const liveMatch = matches.find(m => m.status === 'active');

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <RefreshCw className="w-6 h-6 text-[#00694c] animate-spin" />
    </div>
  );

  if (!tournament) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-slate-500">Tournament not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#00694c] text-white px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Trophy className="w-5 h-5 text-amber-300" />
              <span className="text-xs font-black uppercase tracking-widest text-white/70">Tournament</span>
            </div>
            <h1 className="text-2xl font-black">{tournament.name}</h1>
            <p className="text-white/70 text-sm mt-0.5">{tournament.date} · Double Elimination</p>
          </div>
          <span className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wide
            ${tournament.status === 'active' ? 'bg-red-500 text-white' :
              tournament.status === 'completed' ? 'bg-amber-400 text-amber-900' :
              'bg-white/20 text-white'}`}>
            {tournament.status === 'active' ? '🔴 LIVE' : tournament.status.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">

        {/* Live match highlight */}
        {liveMatch && (
          <div className="bg-white rounded-2xl border-2 border-red-300 shadow-lg p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-widest text-red-600">Now Playing</span>
              <span className="text-xs text-slate-400 ml-1">
                {liveMatch.bracket === 'winners' ? 'Winners' : liveMatch.bracket === 'losers' ? 'Losers' : 'Grand Final'} · Round {liveMatch.round}
              </span>
            </div>
            <div className="flex items-center justify-center gap-8 flex-wrap">
              <div className="text-center">
                <p className="text-base font-black text-slate-800">{getTeamName(liveMatch, 'A', players)}</p>
                <p className="text-5xl font-black text-[#00694c] mt-2">{liveMatch.score_a}</p>
              </div>
              <div className="text-2xl font-black text-slate-300">VS</div>
              <div className="text-center">
                <p className="text-base font-black text-slate-800">{getTeamName(liveMatch, 'B', players)}</p>
                <p className="text-5xl font-black text-[#00694c] mt-2">{liveMatch.score_b}</p>
              </div>
            </div>
          </div>
        )}

        {/* Player status pills */}
        {players.length > 0 && (
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Players</p>
            <div className="flex flex-wrap gap-2">
              {players.map(p => <PlayerPill key={p.id} player={p} />)}
            </div>
          </div>
        )}

        {/* Bracket — MSC / TI style */}
        <BracketView matches={matches} players={players} />

        {/* Champion */}
        {tournament.status === 'completed' && grandFinal?.winner_team && (
          <div className="bg-gradient-to-b from-amber-50 to-white border-2 border-amber-400 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-3">🏆</div>
            <p className="text-xs font-black uppercase tracking-widest text-amber-600 mb-1">Tournament Champion</p>
            <p className="text-2xl font-black text-amber-700">{getTeamName(grandFinal, grandFinal.winner_team, players)}</p>
          </div>
        )}

        {tournament.status === 'registration' && (
          <div className="text-center py-12 text-slate-400">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-bold">Tournament hasn't started yet</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
