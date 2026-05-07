"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// Board indices:
//   0-5  → P1 pits (bottom row, left→right)
//   6    → P1 store (right)
//   7-12 → P2 pits (top row; pit 7 faces pit 5, pit 12 faces pit 0)
//   13   → P2 store (left)
// Sowing is counter-clockwise: 0→1→2→3→4→5→6→7→8→9→10→11→12→(skip 13)→0→…
// opposite(i) = 12 - i  (works for all pit indices 0-5 and 7-12)

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

  // Capture: last seed on own empty pit, opposite pit has seeds
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

interface Props { room: GameRoom }

export default function MancalaBoard({ room }: Props) {
  const [board,   setBoard]   = useState<number[]>(initBoard);
  const [p1Turn,  setP1Turn]  = useState(true);
  const [extraMsg, setExtraMsg] = useState(false);

  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost   = room.hostId === myId;
  const isMyTurn = p1Turn === isHost;
  const gameOver = isGameOver(board);
  const display  = gameOver ? finalize(board) : board;

  const myPits      = isHost ? [0,1,2,3,4,5] : [7,8,9,10,11,12];
  const validPits   = isMyTurn && !gameOver ? myPits.filter(i => board[i] > 0) : [];

  // Reset on rematch
  useEffect(() => {
    setBoard(initBoard()); setP1Turn(true); setExtraMsg(false);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming moves
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

  // Game over → store result
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
    : isMyTurn ? "Your turn"
    : "Opponent's turn";

  // P2's row displayed right→left (pit 12 on left, pit 7 on right)
  const p2Row = [12, 11, 10, 9, 8, 7];
  const p1Row = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className={cn("text-sm font-medium", extraMsg ? "text-yellow-400" : "text-arena-text-muted")}>
        {status}
      </p>

      <div className="flex items-center gap-3">
        {/* P2 store */}
        <MancalaStore seeds={display[13]} label={isHost ? "Opp" : "You"} />

        {/* Board */}
        <div className="flex flex-col gap-3 rounded-2xl bg-[#6b3a1f] p-4 shadow-2xl border-2 border-[#3d1f0a]">
          {/* P2 row (top) */}
          <div className="flex gap-2">
            {p2Row.map(i => (
              <MancalaPit key={i} seeds={display[i]}
                active={validPits.includes(i)}
                onClick={() => handleClick(i)} />
            ))}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#3d1f0a]/60" />

          {/* P1 row (bottom) */}
          <div className="flex gap-2">
            {p1Row.map(i => (
              <MancalaPit key={i} seeds={display[i]}
                active={validPits.includes(i)}
                onClick={() => handleClick(i)} />
            ))}
          </div>
        </div>

        {/* P1 store */}
        <MancalaStore seeds={display[6]} label={isHost ? "You" : "Opp"} />
      </div>

      {/* Labels */}
      <div className="flex w-full max-w-md justify-between px-20 text-[10px] text-arena-text-muted">
        <span>↑ {isHost ? "Opponent" : "You"} (top)</span>
        <span>{isHost ? "You" : "Opponent"} (bottom) ↓</span>
      </div>

      {/* Scores while playing */}
      {!gameOver && (
        <div className="flex gap-6 text-xs text-arena-text-muted">
          <span className={cn(isHost && isMyTurn && "text-yellow-400 font-semibold")}>
            {isHost ? "You" : "Opp"}: {display[6]} seeds
          </span>
          <span className={cn(!isHost && isMyTurn && "text-yellow-400 font-semibold")}>
            {!isHost ? "You" : "Opp"}: {display[13]} seeds
          </span>
        </div>
      )}
    </div>
  );
}

function MancalaPit({ seeds, active, onClick }: { seeds: number; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={!active}
      className={cn(
        "relative flex h-14 w-14 flex-col items-center justify-center rounded-full",
        "border-2 transition-all select-none",
        active
          ? "border-yellow-400 bg-[#3d1a06] hover:bg-[#4a2209] hover:scale-110 cursor-pointer shadow-lg shadow-yellow-500/20"
          : "border-[#3d1f0a] bg-[#4a2610] cursor-default",
        seeds === 0 && "opacity-50",
      )}>
      <span className="text-lg font-bold leading-none text-amber-100">{seeds}</span>
      {seeds > 0 && (
        <span className="text-[8px] text-amber-500 leading-none tracking-[-1px]">
          {"●".repeat(Math.min(seeds, 6))}
        </span>
      )}
    </button>
  );
}

function MancalaStore({ seeds, label }: { seeds: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-arena-text-muted">{label}</span>
      <div className="flex h-36 w-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-[#3d1f0a] bg-[#6b3a1f] shadow-inner">
        <span className="text-3xl font-bold text-amber-100">{seeds}</span>
        <span className="text-[10px] text-amber-600">seeds</span>
      </div>
    </div>
  );
}
