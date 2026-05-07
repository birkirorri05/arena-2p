"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Game logic (unchanged) ─────────────────────────────────────────────────

// Board indices:
//   0-5  → P1 pits (bottom row, left→right)
//   6    → P1 store (right)
//   7-12 → P2 pits (top row; pit 7 faces pit 5, pit 12 faces pit 0)
//   13   → P2 store (left)

function initBoard(): number[] {
  const b = Array(14).fill(4);
  b[6] = 0; b[13] = 0;
  return b;
}

function applyMove(board: number[], pit: number): { board: number[]; extraTurn: boolean } {
  const p1 = pit < 6;
  const skip  = p1 ? 13 : 6;
  const store = p1 ? 6  : 13;
  const myPits = p1 ? [0,1,2,3,4,5] : [7,8,9,10,11,12];
  const next = [...board];
  let seeds = next[pit];
  if (seeds === 0) return { board, extraTurn: false };
  next[pit] = 0;
  let pos = pit;
  while (seeds > 0) {
    pos = (pos + 1) % 14;
    if (pos === skip) pos = (pos + 1) % 14;
    next[pos]++;
    seeds--;
  }
  if (myPits.includes(pos) && next[pos] === 1 && next[12 - pos] > 0) {
    next[store] += next[pos] + next[12 - pos];
    next[pos] = 0;
    next[12 - pos] = 0;
  }
  return { board: next, extraTurn: pos === store };
}

function isGameOver(board: number[]): boolean {
  return board.slice(0, 6).every(v => v === 0) || board.slice(7, 13).every(v => v === 0);
}

function finalize(board: number[]): number[] {
  const next = [...board];
  next[6]  += next.slice(0, 6).reduce((s, v) => s + v, 0);
  next[13] += next.slice(7, 13).reduce((s, v) => s + v, 0);
  for (let i = 0; i < 6; i++)  next[i] = 0;
  for (let i = 7; i < 13; i++) next[i] = 0;
  return next;
}

type MovePayload = { pit: number; nextP1Turn: boolean };

// ── Stone visuals ──────────────────────────────────────────────────────────

// Natural stone colour pairs [highlight, shadow]
const STONES: [string, string][] = [
  ['#f5c978', '#7a3a10'],  // golden
  ['#e8956d', '#6b2608'],  // terracotta
  ['#c8a560', '#5c300d'],  // sandy
  ['#d4b050', '#704010'],  // amber
  ['#b87333', '#4e2210'],  // copper
  ['#c48a50', '#5c2e10'],  // teak
  ['#deb887', '#7a4820'],  // burlywood
];

function Stone({ colorIdx }: { colorIdx: number }) {
  const [hi, lo] = STONES[colorIdx % STONES.length];
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: 10, height: 10,
        background: `radial-gradient(circle at 32% 28%, ${hi}, ${lo})`,
        boxShadow: `0 1px 3px rgba(0,0,0,0.65), inset 0 -1px 1px rgba(0,0,0,0.3)`,
      }}
    />
  );
}

function SeedGroup({ count, pitIdx }: { count: number; pitIdx: number }) {
  if (count === 0) return null;
  const show = Math.min(count, 9);
  const cols = show <= 1 ? 1 : show <= 4 ? 2 : 3;
  return (
    <div className="flex items-center justify-center w-[44px] h-[44px]">
      <div
        className="grid gap-[3px] items-center justify-items-center"
        style={{ gridTemplateColumns: `repeat(${cols}, 10px)` }}
      >
        {Array.from({ length: show }, (_, i) => (
          <Stone key={i} colorIdx={pitIdx * 7 + i} />
        ))}
      </div>
      {count > 9 && (
        <span className="absolute text-sm font-bold text-amber-100 drop-shadow-md">
          {count}
        </span>
      )}
    </div>
  );
}

// ── Pit component ──────────────────────────────────────────────────────────

interface PitProps {
  seeds: number;
  active: boolean;
  pitIdx: number;
  onClick: () => void;
}

function MancalaPit({ seeds, active, pitIdx, onClick }: PitProps) {
  const [lifted, setLifted] = useState(false);
  const didDrag = useRef(false);

  return (
    <button
      disabled={!active}
      // Click: only trigger if it wasn't a drag
      onClick={() => { if (!didDrag.current) onClick(); }}
      // Drag: lift the pit visually; trigger move on drop
      draggable={active}
      onDragStart={(e) => {
        if (!active) { e.preventDefault(); return; }
        didDrag.current = true;
        setLifted(true);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={() => {
        setLifted(false);
        if (active && didDrag.current) onClick();
        setTimeout(() => { didDrag.current = false; }, 100);
      }}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-150 select-none",
        "w-[56px] h-[56px]",
        // Bowl appearance
        "border-[3px]",
        active
          ? cn(
              "border-yellow-400/70 cursor-grab active:cursor-grabbing",
              "bg-[#2d1206]",
              "shadow-[inset_0_3px_8px_rgba(0,0,0,0.6),0_2px_0_rgba(255,200,80,0.15)]",
              "hover:border-yellow-300 hover:shadow-[inset_0_3px_8px_rgba(0,0,0,0.5),0_0_12px_rgba(255,180,0,0.3)]",
              lifted ? "scale-125 -translate-y-3 z-10 shadow-[0_8px_24px_rgba(255,160,0,0.5)]" : "hover:scale-105",
            )
          : cn(
              "border-[#2a1005]/60 cursor-default",
              "bg-[#3a1a08]",
              "shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
              seeds === 0 && "opacity-40",
            ),
      )}
    >
      {/* Pit inner shadow ring */}
      <div className="absolute inset-[3px] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none" />
      <SeedGroup count={seeds} pitIdx={pitIdx} />
      {/* Seed count badge for large piles */}
      {seeds > 0 && (
        <span className={cn(
          "absolute bottom-[5px] right-[5px] text-[9px] font-bold leading-none",
          active ? "text-yellow-300/80" : "text-amber-600/70",
        )}>
          {seeds}
        </span>
      )}
    </button>
  );
}

// ── Store component ────────────────────────────────────────────────────────

function MancalaStore({ seeds, label }: { seeds: number; label: string }) {
  const show = Math.min(seeds, 15);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/80">
        {label}
      </span>
      <div className={cn(
        "relative flex h-[140px] w-[62px] flex-col items-center justify-center gap-1 rounded-2xl",
        "bg-[#2d1206] border-[3px] border-[#1a0a02]",
        "shadow-[inset_0_4px_12px_rgba(0,0,0,0.7),0_2px_4px_rgba(0,0,0,0.4)]",
      )}>
        {/* Inner rim */}
        <div className="absolute inset-[4px] rounded-xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.4)] pointer-events-none" />
        {/* Stone pile */}
        {show > 0 && (
          <div
            className="grid gap-[3px] items-center justify-items-center px-2"
            style={{ gridTemplateColumns: `repeat(3, 10px)` }}
          >
            {Array.from({ length: show }, (_, i) => (
              <Stone key={i} colorIdx={i * 3 + (label === "You" ? 0 : 4)} />
            ))}
          </div>
        )}
        <span className="relative text-2xl font-bold text-amber-100 drop-shadow">{seeds}</span>
        <span className="relative text-[9px] uppercase tracking-wider text-amber-600/70">seeds</span>
      </div>
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────

export default function MancalaBoard({ room }: { room: GameRoom }) {
  const [board,    setBoard]    = useState<number[]>(initBoard);
  const [p1Turn,   setP1Turn]   = useState(true);
  const [extraMsg, setExtraMsg] = useState(false);

  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost   = room.hostId === myId;
  const isMyTurn = p1Turn === isHost;
  const gameOver = isGameOver(board);
  const display  = gameOver ? finalize(board) : board;

  const myPits    = isHost ? [0,1,2,3,4,5] : [7,8,9,10,11,12];
  const validPits = isMyTurn && !gameOver ? myPits.filter(i => board[i] > 0) : [];

  useEffect(() => {
    setBoard(initBoard()); setP1Turn(true); setExtraMsg(false);
    appliedRef.current = 0;
  }, [room.hostId]);

  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setBoard(prev => {
      let b = prev;
      for (const m of pending) {
        const p = m.payload as MovePayload;
        if (typeof p?.pit !== "number") continue;
        b = applyMove(b, p.pit).board;
      }
      return b;
    });
    const last = pending[pending.length - 1].payload as MovePayload;
    if (typeof last?.nextP1Turn === "boolean") setP1Turn(last.nextP1Turn);
    setExtraMsg(false);
    appliedRef.current = moves.length;
  }, [moves]);

  useEffect(() => {
    if (!gameOver || useGameStore.getState().result) return;
    const s1 = display[6], s2 = display[13];
    const winnerId = s1 > s2 ? room.hostId
      : s1 < s2 ? (room.playerIds[1] ?? null)
      : null;
    useGameStore.getState().setResult({ winnerId, reason: "most seeds" });
  }, [gameOver, display, room.hostId, room.playerIds]);

  const handleClick = useCallback((pit: number) => {
    if (room.status !== "playing" || !validPits.includes(pit)) return;
    const { board: next, extraTurn } = applyMove(board, pit);
    const nextP1Turn = extraTurn ? p1Turn : !p1Turn;
    setBoard(next);
    setP1Turn(nextP1Turn);
    setExtraMsg(extraTurn);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "", timestamp: Date.now(),
      payload: { pit, nextP1Turn } satisfies MovePayload,
    });
  }, [board, p1Turn, validPits, myId, room.id, room.status]);

  const s1 = display[6], s2 = display[13];
  const status = gameOver
    ? s1 === s2 ? "Draw!"
      : (s1 > s2) === isHost ? "You win! 🎉" : "You lost."
    : extraMsg ? "Extra turn! Go again."
    : isMyTurn ? "Your turn — click or drag a pit"
    : "Opponent's turn";

  const p2Row = [12, 11, 10, 9, 8, 7];
  const p1Row = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className={cn(
        "text-sm font-medium transition-colors",
        extraMsg ? "text-yellow-400" : "text-arena-text-muted",
      )}>
        {status}
      </p>

      <div className="flex items-center gap-4">
        {/* P2 store */}
        <MancalaStore seeds={display[13]} label={isHost ? "Opp" : "You"} />

        {/* Board */}
        <div className={cn(
          "flex flex-col gap-3 rounded-2xl p-4 shadow-2xl",
          "bg-gradient-to-b from-[#7c4420] to-[#4a2410]",
          "border-2 border-[#2d1006]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,180,80,0.15)]",
        )}>
          {/* P2 row (top) */}
          <div className="flex gap-2.5">
            {p2Row.map(i => (
              <MancalaPit key={i} seeds={display[i]} active={validPits.includes(i)}
                pitIdx={i} onClick={() => handleClick(i)} />
            ))}
          </div>

          {/* Centre divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-[#2d1006]/60 to-transparent" />

          {/* P1 row (bottom) */}
          <div className="flex gap-2.5">
            {p1Row.map(i => (
              <MancalaPit key={i} seeds={display[i]} active={validPits.includes(i)}
                pitIdx={i} onClick={() => handleClick(i)} />
            ))}
          </div>
        </div>

        {/* P1 store */}
        <MancalaStore seeds={display[6]} label={isHost ? "You" : "Opp"} />
      </div>

      {/* Row labels */}
      <div className="flex w-full max-w-md justify-between px-20 text-[10px] text-arena-text-muted">
        <span>↑ {isHost ? "Opponent" : "You"}</span>
        <span>{isHost ? "You" : "Opponent"} ↓</span>
      </div>

      {/* Live scores */}
      {!gameOver && (
        <div className="flex gap-6 text-xs text-arena-text-muted">
          <span className={cn(isHost && isMyTurn && "text-yellow-400 font-semibold")}>
            {isHost ? "You" : "Opp"}: {display[6]}
          </span>
          <span className={cn(!isHost && isMyTurn && "text-yellow-400 font-semibold")}>
            {!isHost ? "You" : "Opp"}: {display[13]}
          </span>
        </div>
      )}
    </div>
  );
}
