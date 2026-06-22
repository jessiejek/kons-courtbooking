/**
 * BracketView — MSC / TI-style double elimination bracket
 *
 * Upper Bracket (winners) on top, Lower Bracket (losers) below,
 * Grand Final at the end. Each section is a horizontal tree with
 * SVG connector lines between rounds.
 */

import React, { type ReactNode } from 'react';
import { Trophy } from 'lucide-react';
import { DndContext, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { getTeamName } from '../lib/tournamentBracket';
import type { TMatch, TPlayer } from '../lib/tournamentBracket';

// ─── Layout constants ─────────────────────────────────────────────────────────

const MATCH_H = 80;   // px — match box height (keep in sync with rendered box)
const MATCH_W = 216;  // px — match box width  (w-54 ≈ 216px)
const SLOT_H  = MATCH_H + 20; // 100px — vertical slot per R1 match (includes inter-match gap)
const CONN_X  = 20;  // px — horizontal distance from match right to vertical connector line
const COL_GAP = 48;  // px — full horizontal gap between columns (connector lives inside this)

// ─── Slot key helper ─────────────────────────────────────────────────────────

export interface PlayerSlot { matchId: string; team: 'A' | 'B'; pos: 0 | 1; playerId: string | null; }

// ─── Drag-and-drop chip sub-components ───────────────────────────────────────

function DraggableChip({ id, name, isOver }: { id: string; name: string; isOver?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-grab active:cursor-grabbing transition-all z-10 relative touch-none
        ${isDragging  ? 'opacity-40 scale-95 border-amber-300 bg-amber-50'  :
          isOver      ? 'ring-2 ring-amber-400 bg-amber-50 border-amber-400' :
                        'bg-white text-slate-700 border-gray-300 hover:border-amber-400 hover:bg-amber-50'}`}
    >
      {name}
    </div>
  );
}

function DroppableSlot({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={`rounded-lg transition-all ${isOver ? 'bg-amber-100/60' : ''}`}>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<{ isOver?: boolean }>, { isOver })
        : children}
    </div>
  );
}

// ─── Match box ────────────────────────────────────────────────────────────────

interface MatchBoxProps {
  match: TMatch;
  players: TPlayer[];
  isActive?: boolean;
  onClick?: () => void;
  editMode?: boolean;
  selectedSlot?: PlayerSlot | null;
  onSlotClick?: (slot: PlayerSlot) => void;
}

function MatchBox({ match, players, isActive, onClick, editMode, onSlotClick }: MatchBoxProps) {
  const find = (id: string | null) => players.find(p => p.id === id)?.player_name ?? (id ? '?' : null);
  const isBye     = match.status === 'bye';
  const isDone    = match.status === 'completed';
  const isLive    = match.status === 'active';
  const isPending = match.status === 'pending';
  const canEdit   = editMode && isPending;

  const teamAStr = `${find(match.team_a_p1) ?? '?'} & ${find(match.team_a_p2) ?? '?'}`;
  const teamBStr = `${find(match.team_b_p1) ?? '?'} & ${find(match.team_b_p2) ?? '?'}`;

  const slotId = (team: 'A' | 'B', pos: 0 | 1) => `${match.id}|${team}|${pos}`;

  return (
    <div
      onClick={!canEdit ? onClick : undefined}
      style={{ width: MATCH_W, minHeight: canEdit ? 'auto' : MATCH_H }}
      className={`rounded-xl border-2 overflow-hidden flex flex-col transition-all select-none
        ${isLive    ? 'border-red-400 shadow-lg shadow-red-100/60 cursor-pointer' : ''}
        ${isDone    ? 'border-gray-200' : ''}
        ${isPending && !isBye && !canEdit ? 'border-outline-variant/40 hover:border-primary/60 cursor-pointer' : ''}
        ${isBye     ? 'border-dashed border-gray-200 opacity-60' : ''}
        ${isActive  ? 'ring-2 ring-primary ring-offset-1' : ''}
        ${canEdit   ? 'border-amber-300 shadow-amber-100/60 shadow-md' : ''}
      `}
    >
      {isLive && (
        <div className="bg-red-500 text-white text-[7px] font-black uppercase tracking-widest text-center shrink-0 flex items-center justify-center gap-1 py-[2px]">
          <span className="w-1 h-1 rounded-full bg-white animate-pulse" />LIVE
        </div>
      )}
      {canEdit && (
        <div className="bg-amber-400 text-amber-900 text-[7px] font-black uppercase tracking-widest text-center shrink-0 py-[2px]">
          ✦ DRAG TO REARRANGE
        </div>
      )}

      {canEdit ? (
        /* ── Edit mode: compact Team A / VS / Team B ── */
        <div className="flex flex-col">
          {/* Team A row */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-green-50/70">
            <span className="text-[7px] font-black text-green-700 bg-green-200 px-1 py-0.5 rounded shrink-0">A</span>
            {([0, 1] as const).map(pos => {
              const pid = pos === 0 ? match.team_a_p1 : match.team_a_p2;
              const name = find(pid);
              if (!name) return null;
              const id = slotId('A', pos);
              return <DroppableSlot key={pos} id={id}><DraggableChip id={id} name={name} /></DroppableSlot>;
            })}
          </div>
          {/* VS divider */}
          <div className="flex items-center gap-1 px-2 bg-white">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[7px] font-black text-gray-400">VS</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {/* Team B row */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-blue-50/50">
            <span className="text-[7px] font-black text-blue-700 bg-blue-200 px-1 py-0.5 rounded shrink-0">B</span>
            {([0, 1] as const).map(pos => {
              const pid = pos === 0 ? match.team_b_p1 : match.team_b_p2;
              const name = find(pid);
              if (!name) return null;
              const id = slotId('B', pos);
              return <DroppableSlot key={pos} id={id}><DraggableChip id={id} name={name} /></DroppableSlot>;
            })}
          </div>
        </div>
      ) : (
        /* ── Normal mode: original team-name rows ── */
        <>
          <div className={`flex-1 px-3 flex items-center justify-between gap-2
            ${match.winner_team === 'A' ? 'bg-green-50' : 'bg-white'}
            ${match.winner_team === 'B' ? 'opacity-40' : ''}`}
            style={{ minHeight: MATCH_H / 2 }}>
            <div className="flex items-center gap-1 min-w-0">
              {match.winner_team === 'A' && <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
              <span className={`text-[11px] font-bold truncate leading-tight ${match.winner_team === 'A' ? 'text-primary' : 'text-slate-700'}`}>{teamAStr}</span>
            </div>
            {(isLive || isDone) && (
              <span className={`text-sm font-black shrink-0 tabular-nums ${match.winner_team === 'A' ? 'text-primary' : isLive ? 'text-red-500' : 'text-gray-400'}`}>{match.score_a}</span>
            )}
          </div>
          <div className="h-px shrink-0 bg-gray-100" />
          {isBye ? (
            <div className="flex-1 px-3 flex items-center bg-gray-50" style={{ minHeight: MATCH_H / 2 }}>
              <span className="text-[10px] text-gray-400 italic">BYE — auto advance</span>
            </div>
          ) : (
            <div className={`flex-1 px-3 flex items-center justify-between gap-2
              ${match.winner_team === 'B' ? 'bg-green-50' : 'bg-white'}
              ${match.winner_team === 'A' ? 'opacity-40' : ''}`}
              style={{ minHeight: MATCH_H / 2 }}>
              <div className="flex items-center gap-1 min-w-0">
                {match.winner_team === 'B' && <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                <span className={`text-[11px] font-bold truncate leading-tight ${match.winner_team === 'B' ? 'text-primary' : 'text-slate-700'}`}>{teamBStr}</span>
              </div>
              {(isLive || isDone) && (
                <span className={`text-sm font-black shrink-0 tabular-nums ${match.winner_team === 'B' ? 'text-primary' : isLive ? 'text-red-500' : 'text-gray-400'}`}>{match.score_b}</span>
              )}
            </div>
          )}
        </>
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
  editMode?: boolean;
}

function BracketSection({
  label, labelIcon, accentColor, rounds, roundLabels, players, onMatchClick, activeMatchId,
  editMode,
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
                        editMode={editMode}
                        onClick={onMatchClick && match.status !== 'bye' ? () => onMatchClick(match) : undefined}
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
  editMode?: boolean;
  onSlotSwap?: (a: PlayerSlot, b: PlayerSlot) => void;
}

function parseSlotId(id: string): PlayerSlot | null {
  const parts = id.split('|');
  if (parts.length !== 3) return null;
  const [matchId, team, posStr] = parts;
  if (team !== 'A' && team !== 'B') return null;
  const pos = parseInt(posStr) as 0 | 1;
  if (pos !== 0 && pos !== 1) return null;
  return { matchId, team, pos, playerId: null };
}

export default function BracketView({ matches, players, onMatchClick, activeMatchId, editMode, onSlotSwap }: BracketViewProps) {
  const [dragOverlay, setDragOverlay] = React.useState<string | null>(null);

  const wbMatches = matches.filter(m => m.bracket === 'winners');
  const lbMatches = matches.filter(m => m.bracket === 'losers');
  const gf        = matches.find(m => m.bracket === 'grand_final');

  const wbRounds = [...new Set(wbMatches.map(m => m.round))].sort((a, b) => a - b);
  const lbRounds = [...new Set(lbMatches.map(m => m.round))].sort((a, b) => a - b);

  const wbByRound = wbRounds.map(r => wbMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number));
  const lbByRound = lbRounds.map(r => lbMatches.filter(m => m.round === r).sort((a, b) => a.match_number - b.match_number));

  const wbLabels = wbRounds.map((r, i) => {
    if (i === wbRounds.length - 1) return 'UB Final';
    if (i === wbRounds.length - 2 && wbRounds.length > 2) return 'UB Semi';
    return `Round ${r}`;
  });

  const lbLabels = lbRounds.map((r, i) => {
    if (i === lbRounds.length - 1) return 'LB Final';
    return `LB Round ${r}`;
  });

  const handleDragEnd = (event: DragEndEvent) => {
    setDragOverlay(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const slotA = parseSlotId(String(active.id));
    const slotB = parseSlotId(String(over.id));
    if (!slotA || !slotB || !onSlotSwap) return;
    // attach playerId from matches
    const findPlayer = (s: PlayerSlot) => {
      const m = matches.find(mx => mx.id === s.matchId);
      if (!m) return null;
      if (s.team === 'A') return s.pos === 0 ? m.team_a_p1 : m.team_a_p2;
      return s.pos === 0 ? m.team_b_p1 : m.team_b_p2;
    };
    onSlotSwap({ ...slotA, playerId: findPlayer(slotA) }, { ...slotB, playerId: findPlayer(slotB) });
  };

  const clickable = (m: TMatch) =>
    onMatchClick && m.status !== 'bye' ? () => onMatchClick(m) : undefined;

  // Find name of dragging chip for overlay
  const overlayName = dragOverlay
    ? (() => {
        const s = parseSlotId(dragOverlay);
        if (!s) return null;
        const m = matches.find(mx => mx.id === s.matchId);
        if (!m) return null;
        const pid = s.team === 'A' ? (s.pos === 0 ? m.team_a_p1 : m.team_a_p2) : (s.pos === 0 ? m.team_b_p1 : m.team_b_p2);
        return players.find(p => p.id === pid)?.player_name ?? null;
      })()
    : null;

  const inner = (
    <div className="space-y-10">
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
          editMode={editMode}
        />
      )}
      {lbByRound.length > 0 && (
        <BracketSection
          label="Lower Bracket"
          labelIcon={<span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] flex items-center justify-center font-black shrink-0">L</span>}
          accentColor="#93c5fd"
          rounds={lbByRound}
          roundLabels={lbLabels}
          players={players}
          onMatchClick={onMatchClick}
          activeMatchId={activeMatchId}
          editMode={editMode}
        />
      )}
      {gf && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <span className="text-xs font-black uppercase tracking-widest text-on-surface">Grand Final</span>
          </div>
          <MatchBox match={gf} players={players} isActive={activeMatchId === gf.id} onClick={clickable(gf)} />
        </div>
      )}
      {wbByRound.length === 0 && lbByRound.length === 0 && !gf && (
        <div className="text-center py-12 text-slate-400">
          <Trophy className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm font-bold">Bracket not generated yet</p>
        </div>
      )}
    </div>
  );

  if (!editMode) return inner;

  return (
    <DndContext
      onDragStart={e => setDragOverlay(String(e.active.id))}
      onDragCancel={() => setDragOverlay(null)}
      onDragEnd={handleDragEnd}
    >
      {inner}
      <DragOverlay>
        {overlayName && (
          <div className="text-[10px] font-bold px-2 py-1 rounded-lg border bg-amber-400 text-amber-900 border-amber-500 shadow-lg cursor-grabbing">
            {overlayName}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
