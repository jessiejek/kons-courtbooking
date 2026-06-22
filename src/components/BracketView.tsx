/**
 * BracketView — MSC / TI-style double elimination bracket
 *
 * Upper Bracket (winners) on top, Lower Bracket (losers) below,
 * Grand Final at the end. Each section is a horizontal tree with
 * SVG connector lines between rounds.
 */

import React, { type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { getTeamName } from '../lib/tournamentBracket';
import type { TMatch, TPlayer } from '../lib/tournamentBracket';

// ─── Layout constants ─────────────────────────────────────────────────────────

const MATCH_H = 80;   // px — match box height (keep in sync with rendered box)
const MATCH_W = 216;  // px — match box width  (w-54 ≈ 216px)
const SLOT_H  = MATCH_H + 20; // 100px — vertical slot per R1 match (includes inter-match gap)
const CONN_X  = 20;  // px — horizontal distance from match right to vertical connector line
const COL_GAP = 48;  // px — full horizontal gap between columns (connector lives inside this)

// ─── Match box ────────────────────────────────────────────────────────────────

interface MatchBoxProps {
  match: TMatch;
  players: TPlayer[];
  isActive?: boolean;
  isSwapSelected?: boolean;
  isSwapTarget?: boolean;
  isSwapable?: boolean;
  onClick?: () => void;
}

function MatchBox({ match, players, isActive, isSwapSelected, isSwapTarget, isSwapable, onClick }: MatchBoxProps) {
  const teamA = getTeamName(match, 'A', players);
  const teamB = getTeamName(match, 'B', players);
  const isBye  = match.status === 'bye';
  const isDone = match.status === 'completed';
  const isLive = match.status === 'active';
  const isPending = match.status === 'pending';

  return (
    <div
      onClick={onClick}
      style={{ width: MATCH_W, height: MATCH_H }}
      className={`rounded-xl border-2 overflow-hidden flex flex-col transition-all select-none
        ${isLive  ? 'border-red-400 shadow-lg shadow-red-100/60 cursor-pointer' : ''}
        ${isDone  ? 'border-gray-200' : ''}
        ${isPending && !isBye && !isSwapable ? 'border-outline-variant/40 hover:border-primary/60 cursor-pointer' : ''}
        ${isBye   ? 'border-dashed border-gray-200 opacity-60' : ''}
        ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}
        ${isSwapSelected ? 'border-amber-400 ring-2 ring-amber-300 ring-offset-1 shadow-amber-100 shadow-lg cursor-pointer' : ''}
        ${isSwapTarget ? 'border-blue-400 ring-2 ring-blue-300 ring-offset-1 cursor-pointer animate-pulse' : ''}
        ${isSwapable && !isSwapSelected && !isSwapTarget ? 'border-amber-200 hover:border-amber-400 cursor-pointer' : ''}
      `}
    >
      {isLive && (
        <div className="bg-red-500 text-white text-[7px] font-black uppercase tracking-widest text-center shrink-0 flex items-center justify-center gap-1 py-[2px]">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
        </div>
      )}
      {isSwapSelected && (
        <div className="bg-amber-400 text-amber-900 text-[7px] font-black uppercase tracking-widest text-center shrink-0 py-[2px]">
          ↕ SELECTED — click another to swap
        </div>
      )}
      {isSwapTarget && (
        <div className="bg-blue-400 text-white text-[7px] font-black uppercase tracking-widest text-center shrink-0 py-[2px]">
          ↕ CLICK TO SWAP HERE
        </div>
      )}
      {/* Team A row */}
      <div className={`flex-1 px-3 flex items-center justify-between gap-2
        ${match.winner_team === 'A' ? 'bg-green-50' : 'bg-white'}
        ${match.winner_team === 'B' ? 'opacity-40' : ''}
      `}>
        <div className="flex items-center gap-1 min-w-0">
          {match.winner_team === 'A' && <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
          <span className={`text-[11px] font-bold truncate leading-tight
            ${match.winner_team === 'A' ? 'text-primary' : 'text-slate-700'}`}>
            {teamA}
          </span>
        </div>
        {(isLive || isDone) && (
          <span className={`text-sm font-black shrink-0 tabular-nums
            ${match.winner_team === 'A' ? 'text-primary' : isLive ? 'text-red-500' : 'text-gray-400'}`}>
            {match.score_a}
          </span>
        )}
      </div>
      {/* Divider */}
      <div className="h-px shrink-0 bg-gray-100" />
      {/* Team B row */}
      {isBye ? (
        <div className="flex-1 px-3 flex items-center bg-gray-50">
          <span className="text-[10px] text-gray-400 italic">BYE — auto advance</span>
        </div>
      ) : (
        <div className={`flex-1 px-3 flex items-center justify-between gap-2
          ${match.winner_team === 'B' ? 'bg-green-50' : 'bg-white'}
          ${match.winner_team === 'A' ? 'opacity-40' : ''}
        `}>
          <div className="flex items-center gap-1 min-w-0">
            {match.winner_team === 'B' && <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
            <span className={`text-[11px] font-bold truncate leading-tight
              ${match.winner_team === 'B' ? 'text-primary' : 'text-slate-700'}`}>
              {teamB}
            </span>
          </div>
          {(isLive || isDone) && (
            <span className={`text-sm font-black shrink-0 tabular-nums
              ${match.winner_team === 'B' ? 'text-primary' : isLive ? 'text-red-500' : 'text-gray-400'}`}>
              {match.score_b}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Position math ────────────────────────────────────────────────────────────

/**
 * For a bracket section with `r1Count` R1 matches, compute the top-Y
 * (in px from section top) for every match in every round.
 *
 * Rule: each R(N+1) match is vertically centred between its two R(N) feeders.
 * A lone feeder (bye/odd) keeps the same centre.
 */
function computeTopY(r1Count: number): number[][] {
  if (r1Count === 0) return [];

  const allRounds: number[][] = [];

  // Round 0: evenly spaced
  const r1TopY = Array.from({ length: r1Count }, (_, i) => i * SLOT_H);
  allRounds.push(r1TopY);

  let prevCenters = r1TopY.map(y => y + MATCH_H / 2);

  while (prevCenters.length > 1) {
    const nextCenters: number[] = [];
    for (let i = 0; i < prevCenters.length; i += 2) {
      if (i + 1 < prevCenters.length) {
        nextCenters.push((prevCenters[i] + prevCenters[i + 1]) / 2);
      } else {
        // Odd (lone) — same centre as its feeder
        nextCenters.push(prevCenters[i]);
      }
    }
    allRounds.push(nextCenters.map(c => c - MATCH_H / 2));
    prevCenters = nextCenters;
  }

  return allRounds;
}

// ─── Connector SVG ────────────────────────────────────────────────────────────

interface ConnectorsProps {
  positions: number[][];
  rounds: TMatch[][];
  totalH: number;
  totalW: number;
  colW: number;
  accentColor: string;
}

function ConnectorLines({ positions, rounds, totalH, totalW, colW, accentColor }: ConnectorsProps) {
  const lines: React.ReactNode[] = [];

  for (let ri = 0; ri < rounds.length - 1; ri++) {
    const fromPos = positions[ri];
    const toPos   = positions[ri + 1];
    if (!fromPos || !toPos) continue;

    const matchLeft = ri * colW;
    const connX     = matchLeft + MATCH_W + CONN_X;
    const nextLeft  = (ri + 1) * colW;

    for (let k = 0; k < toPos.length; k++) {
      const topIdx    = k * 2;
      const botIdx    = k * 2 + 1;
      const topCenter = fromPos[topIdx] + MATCH_H / 2;
      const nextCenter = toPos[k] + MATCH_H / 2;

      if (botIdx < fromPos.length) {
        // Pair — bracket shape
        const botCenter = fromPos[botIdx] + MATCH_H / 2;
        lines.push(
          // Top match → connector
          <line key={`${ri}-${k}-tH`} x1={matchLeft + MATCH_W} y1={topCenter}    x2={connX} y2={topCenter}    stroke={accentColor} strokeWidth={1.5} />,
          // Bot match → connector
          <line key={`${ri}-${k}-bH`} x1={matchLeft + MATCH_W} y1={botCenter}    x2={connX} y2={botCenter}    stroke={accentColor} strokeWidth={1.5} />,
          // Vertical bracket
          <line key={`${ri}-${k}-V`}  x1={connX}               y1={topCenter}    x2={connX} y2={botCenter}    stroke={accentColor} strokeWidth={1.5} />,
          // Output → next match
          <line key={`${ri}-${k}-O`}  x1={connX}               y1={nextCenter}   x2={nextLeft} y2={nextCenter} stroke={accentColor} strokeWidth={1.5} />,
        );
      } else {
        // Lone match — straight line (BYE or single)
        lines.push(
          <line key={`${ri}-${k}-lone`} x1={matchLeft + MATCH_W} y1={topCenter} x2={nextLeft} y2={nextCenter} stroke={accentColor} strokeWidth={1.5} strokeDasharray={topCenter === nextCenter ? undefined : '4 3'} />,
        );
      }
    }
  }

  // Horizontal stub on the last round's match (so it doesn't end abruptly)
  const lastRi = rounds.length - 1;
  const lastPos = positions[lastRi];
  if (lastPos) {
    const matchLeft = lastRi * colW;
    lastPos.forEach((topY, mi) => {
      const cy = topY + MATCH_H / 2;
      lines.push(
        <line key={`last-${mi}`} x1={matchLeft + MATCH_W} y1={cy} x2={matchLeft + MATCH_W + 12} y2={cy} stroke={accentColor} strokeWidth={1.5} />
      );
    });
  }

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: totalW, height: totalH, overflow: 'visible', pointerEvents: 'none' }}
    >
      {lines}
    </svg>
  );
}

// ─── Bracket section (UB or LB) ───────────────────────────────────────────────

interface SectionProps {
  label: string;
  labelIcon: ReactNode;
  accentColor: string;
  rounds: TMatch[][];
  roundLabels: string[];
  players: TPlayer[];
  onMatchClick?: (m: TMatch) => void;
  activeMatchId?: string | null;
  swapMode?: boolean;
  swapFirstId?: string | null;
  onSwapClick?: (m: TMatch) => void;
}

function BracketSection({
  label, labelIcon, accentColor, rounds, roundLabels, players, onMatchClick, activeMatchId,
  swapMode, swapFirstId, onSwapClick,
}: SectionProps) {
  const r1Count = rounds[0]?.length ?? 0;
  if (r1Count === 0) return null;

  const positions = computeTopY(r1Count);
  const totalH    = r1Count * SLOT_H;
  const colW      = MATCH_W + COL_GAP;
  const totalW    = rounds.length * colW;

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        {labelIcon}
        <span className="text-xs font-black uppercase tracking-widest text-on-surface">{label}</span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="relative min-w-max" style={{ height: totalH, width: totalW }}>

          {/* SVG connector lines */}
          <ConnectorLines
            positions={positions} rounds={rounds}
            totalH={totalH} totalW={totalW} colW={colW}
            accentColor={accentColor}
          />

          {/* Match boxes + round labels */}
          {rounds.map((roundMatches, ri) => {
            const roundPos = positions[ri] ?? [];
            const colLeft  = ri * colW;

            return (
              <React.Fragment key={ri}>
                {/* Round label */}
                <div
                  style={{ position: 'absolute', left: colLeft, top: -20, width: MATCH_W }}
                  className="text-[9px] font-black uppercase tracking-widest text-slate-400 text-center"
                >
                  {roundLabels[ri] ?? `Round ${ri + 1}`}
                </div>

                {/* Matches */}
                {roundMatches.map((match, mi) => {
                  const topY = roundPos[mi] ?? 0;
                  return (
                    <div
                      key={match.id}
                      style={{ position: 'absolute', left: colLeft, top: topY }}
                    >
                      <MatchBox
                        match={match}
                        players={players}
                        isActive={activeMatchId === match.id}
                        isSwapSelected={swapFirstId === match.id}
                        isSwapTarget={swapMode && match.status === 'pending' && swapFirstId !== match.id && !!swapFirstId}
                        isSwapable={swapMode && match.status === 'pending'}
                        onClick={
                          swapMode && match.status === 'pending' && onSwapClick
                            ? () => onSwapClick(match)
                            : onMatchClick && match.status !== 'bye'
                            ? () => onMatchClick(match)
                            : undefined
                        }
                      />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BracketViewProps {
  matches: TMatch[];
  players: TPlayer[];
  onMatchClick?: (m: TMatch) => void;
  activeMatchId?: string | null;
  swapMode?: boolean;
  swapFirstId?: string | null;
  onSwapClick?: (m: TMatch) => void;
}

export default function BracketView({ matches, players, onMatchClick, activeMatchId, swapMode, swapFirstId, onSwapClick }: BracketViewProps) {
  // Separate brackets
  const wbMatches = matches.filter(m => m.bracket === 'winners');
  const lbMatches = matches.filter(m => m.bracket === 'losers');
  const gf        = matches.find(m => m.bracket === 'grand_final');

  const wbRounds = [...new Set(wbMatches.map(m => m.round))].sort((a, b) => a - b);
  const lbRounds = [...new Set(lbMatches.map(m => m.round))].sort((a, b) => a - b);

  const wbByRound = wbRounds.map(r => wbMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number));
  const lbByRound = lbRounds.map(r => lbMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number));

  // Round labels
  const wbLabels = wbRounds.map((r, i) => {
    if (i === wbRounds.length - 1) return 'UB Final';
    if (i === wbRounds.length - 2 && wbRounds.length > 2) return 'UB Semi';
    return `Round ${r}`;
  });

  const lbLabels = lbRounds.map((r, i) => {
    if (i === lbRounds.length - 1) return 'LB Final';
    return `LB Round ${r}`;
  });

  const clickable = (m: TMatch) =>
    onMatchClick && m.status !== 'bye'
      ? () => onMatchClick(m)
      : undefined;

  return (
    <div className="space-y-10">

      {/* ── Upper / Winners Bracket ── */}
      {wbByRound.length > 0 && (
        <BracketSection
          label="Upper Bracket"
          labelIcon={<Trophy className="w-4 h-4 text-amber-500" />}
          accentColor="#d1d5db"
          rounds={wbByRound}
          roundLabels={wbLabels}
          players={players}
          onMatchClick={onMatchClick}
          activeMatchId={activeMatchId}
          swapMode={swapMode}
          swapFirstId={swapFirstId}
          onSwapClick={onSwapClick}
        />
      )}

      {/* ── Lower / Losers Bracket ── */}
      {lbByRound.length > 0 && (
        <BracketSection
          label="Lower Bracket"
          labelIcon={
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-black shrink-0">L</span>
          }
          accentColor="#93c5fd"
          rounds={lbByRound}
          roundLabels={lbLabels}
          players={players}
          onMatchClick={onMatchClick}
          activeMatchId={activeMatchId}
          swapMode={swapMode}
          swapFirstId={swapFirstId}
          onSwapClick={onSwapClick}
        />
      )}

      {/* ── Grand Final ── */}
      {gf && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-black uppercase tracking-widest text-on-surface">Grand Final</span>
          </div>
          <MatchBox
            match={gf}
            players={players}
            isActive={activeMatchId === gf.id}
            onClick={clickable(gf)}
          />
        </div>
      )}

      {/* Empty state */}
      {wbByRound.length === 0 && lbByRound.length === 0 && !gf && (
        <div className="text-center py-12 text-slate-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold">Bracket not generated yet</p>
        </div>
      )}
    </div>
  );
}
