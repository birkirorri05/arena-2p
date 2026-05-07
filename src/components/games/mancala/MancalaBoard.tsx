"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Game logic ─────────────────────────────────────────────────────────────

function initBoard(): number[] {
  const b = Array(14).fill(4);
  b[6] = 0; b[13] = 0;
  return b;
}

function getSowingPath(board: number[], pit: number): number[] {
  const p1 = pit < 6;
  const skip = p1 ? 13 : 6;
  const path: number[] = [];
  let seeds = board[pit];
  let pos = pit;
  while (seeds > 0) {
    pos = (pos + 1) % 14;
    if (pos === skip) pos = (pos + 1) % 14;
    path.push(pos);
    seeds--;
  }
  return path;
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

const STONES: [string, string][] = [
  ['#f5c978', '#7a3a10'],
  ['#e8956d', '#6b2608'],
  ['#c8a560', '#5c300d'],
  ['#d4b050', '#704010'],
  ['#b87333', '#4e2210'],
  ['#c48a50', '#5c2e10'],
  ['#deb887', '#7a4820'],
];

function Stone({ colorIdx, size = 10 }: { colorIdx: number; size?: number }) {
  const [hi, lo] = STONES[colorIdx % STONES.length];
  return (
    <div
      className="rounded-full flex-shrink-0"
      style={{
        width: size, height: size,
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
    <div className="relative flex items-center justify-center w-[44px] h-[44px]">
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

// ── Pit ────────────────────────────────────────────────────────────────────

function MancalaPit({ seeds, active, lit, pitIdx, onClick }: {
  seeds: number; active: boolean; lit: boolean; pitIdx: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!active}
      className={cn(
        "relative flex items-center justify-center rounded-full transition-all duration-150 select-none",
        "w-[56px] h-[56px] border-[3px]",
        active
          ? "border-yellow-400/70 cursor-pointer bg-[#2d1206] hover:scale-105 hover:border-yellow-300 hover:shadow-[0_0_12px_rgba(255,180,0,0.3)]"
          : "border-[#2a1005]/60 cursor-default bg-[#3a1a08]",
        "shadow-[inset_0_3px_8px_rgba(0,0,0,0.6)]",
        seeds === 0 && !active && "opacity-40",
        // seed-just-landed glow
        lit && "scale-110 shadow-[inset_0_2px_6px_rgba(0,0,0,0.5),0_0_18px_rgba(255,200,80,0.55)] border-yellow-200/80 z-10",
      )}
    >
      <div className="absolute inset-[3px] rounded-full shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] pointer-events-none" />
      <SeedGroup count={seeds} pitIdx={pitIdx} />
      {seeds > 0 && (
        <span className={cn(
          "absolute bottom-[5px] right-[5px] text-[9px] font-bold leading-none",
          active ? "text-yellow-300/80" : "text-amber-600/70",
          lit && "text-yellow-200",
        )}>
          {seeds}
        </span>
      )}
    </button>
  );
}

// ── Store ──────────────────────────────────────────────────────────────────

function MancalaStore({ seeds, lit, label }: { seeds: number; lit: boolean; label: string }) {
  const show = Math.min(seeds, 15);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600/80">{label}</span>
      <div className={cn(
        "relative flex h-[140px] w-[62px] flex-col items-center justify-center gap-1 rounded-2xl",
        "bg-[#2d1206] border-[3px] border-[#1a0a02]",
        "shadow-[inset_0_4px_12px_rgba(0,0,0,0.7),0_2px_4px_rgba(0,0,0,0.4)]",
        "transition-all duration-150",
        lit && "shadow-[inset_0_4px_12px_rgba(0,0,0,0.5),0_0_18px_rgba(255,200,80,0.5)] border-yellow-300/60",
      )}>
        <div className="absolute inset-[4px] rounded-xl shadow-[inset_0_2px_5px_rgba(0,0,0,0.4)] pointer-events-none" />
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

// ── Board ──────────────────────────────────────────────────────────────────

export default function MancalaBoard({ room }: { room: GameRoom }) {
  const [board,    setBoard]    = useState<number[]>(initBoard);
  const [p1Turn,   setP1Turn]   = useState(true);
  const [extraMsg, setExtraMsg] = useState(false);

  // displayBoard is what's rendered — it animates step-by-step toward board
  const [displayBoard, setDisplayBoard] = useState<number[]>(() => initBoard());
  const [animating,    setAnimating]    = useState(false);
  const [litPit,       setLitPit]       = useState<number | null>(null);

  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost   = room.hostId === myId;
  const isMyTurn = p1Turn === isHost;
  const gameOver = isGameOver(board);

  const myPits    = isHost ? [0,1,2,3,4,5] : [7,8,9,10,11,12];
  const validPits = isMyTurn && !gameOver && !animating
    ? myPits.filter(i => board[i] > 0)
    : [];

  // Clear all pending timers
  const clearTimers = useCallback(() => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  // Reset on rematch
  useEffect(() => {
    clearTimers();
    setBoard(initBoard());
    setDisplayBoard(initBoard());
    setP1Turn(true);
    setExtraMsg(false);
    setAnimating(false);
    setLitPit(null);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Animate sowing: show seeds landing one by one
  const playSow = useCallback((sourceBoard: number[], pit: number, finalBoard: number[]) => {
    clearTimers();
    const path = getSowingPath(sourceBoard, pit);
    if (path.length === 0) { setDisplayBoard(finalBoard); return; }

    const stepMs = Math.max(85, Math.min(200, 900 / path.length));
    const working = [...sourceBoard];
    working[pit] = 0;
    setDisplayBoard([...working]);
    setAnimating(true);

    const timers: ReturnType<typeof setTimeout>[] = [];

    path.forEach((toPit, i) => {
      const t = setTimeout(() => {
        working[toPit]++;
        setDisplayBoard([...working]);
        setLitPit(toPit);

        const clear = setTimeout(() => setLitPit(l => l === toPit ? null : l), 220);
        timerRefs.current.push(clear);

        if (i === path.length - 1) {
          // Brief pause then snap to final state (handles captures)
          const finish = setTimeout(() => {
            setDisplayBoard(finalBoard);
            setAnimating(false);
            setLitPit(null);
          }, 350);
          timerRefs.current.push(finish);
        }
      }, i * stepMs);
      timers.push(t);
    });

    timerRefs.current.push(...timers);
  }, [clearTimers]);

  // Apply incoming opponent moves (animate the last one)
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;

    setBoard(prev => {
      let b = prev;
      for (const m of pending) {
        const p = m.payload as MovePayload;
        if (typeof p?.pit === "number") b = applyMove(b, p.pit).board;
      }
      return b;
    });

    const last = pending[pending.length - 1].payload as MovePayload;
    if (typeof last?.nextP1Turn === "boolean") setP1Turn(last.nextP1Turn);
    setExtraMsg(false);
    appliedRef.current = moves.length;

    // Animate the last incoming move from the current display state
    if (typeof last?.pit === "number") {
      setDisplayBoard(prev => {
        // catch up to pre-last-move state instantly for multi-move batches
        let b = prev;
        for (let i = 0; i < pending.length - 1; i++) {
          const p = pending[i].payload as MovePayload;
          if (typeof p?.pit === "number") b = applyMove(b, p.pit).board;
        }
        // animate the last move from b
        let finalB = b;
        if (typeof last.pit === "number") finalB = applyMove(b, last.pit).board;
        playSow(b, last.pit, finalB);
        return prev; // playSow will update displayBoard
      });
    }
  }, [moves, playSow]);

  // Game over → store result
  useEffect(() => {
    if (!gameOver || useGameStore.getState().result) return;
    const d = finalize(board);
    const s1 = d[6], s2 = d[13];
    const winnerId = s1 > s2 ? room.hostId
      : s1 < s2 ? (room.playerIds[1] ?? null)
      : null;
    useGameStore.getState().setResult({ winnerId, reason: "most seeds" });
  }, [gameOver, board, room.hostId, room.playerIds]);

  const handleClick = useCallback((pit: number) => {
    if (room.status !== "playing" || !validPits.includes(pit)) return;
    const { board: next, extraTurn } = applyMove(board, pit);
    const nextP1Turn = extraTurn ? p1Turn : !p1Turn;

    // Animate from current board, then snap to final
    playSow(board, pit, next);

    setBoard(next);
    setP1Turn(nextP1Turn);
    setExtraMsg(extraTurn);

    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "", timestamp: Date.now(),
      payload: { pit, nextP1Turn } satisfies MovePayload,
    });
  }, [board, p1Turn, validPits, myId, room.id, room.status, playSow]);

  const display = gameOver ? finalize(displayBoard) : displayBoard;
  const s1 = display[6], s2 = display[13];

  const status = gameOver
    ? s1 === s2 ? "Draw!"
      : (s1 > s2) === isHost ? "You win! 🎉" : "You lost."
    : extraMsg ? "Extra turn! Go again."
    : animating ? "Sowing…"
    : isMyTurn ? "Your turn"
    : "Opponent's turn";

  const p2Row = [12, 11, 10, 9, 8, 7];
  const p1Row = [0, 1, 2, 3, 4, 5];

  return (
    <div className="flex flex-col items-center gap-4">
      <p className={cn(
        "text-sm font-medium transition-colors",
        extraMsg && "text-yellow-400",
        animating && "text-amber-500",
        !extraMsg && !animating && "text-arena-text-muted",
      )}>
        {status}
      </p>

      <div className="flex items-center gap-4">
        <MancalaStore seeds={display[13]} lit={litPit === 13} label={isHost ? "Opp" : "You"} />

        <div className={cn(
          "flex flex-col gap-3 rounded-2xl p-4 shadow-2xl",
          "bg-gradient-to-b from-[#7c4420] to-[#4a2410]",
          "border-2 border-[#2d1006]",
          "shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,180,80,0.15)]",
        )}>
          <div className="flex gap-2.5">
            {p2Row.map(i => (
              <MancalaPit key={i} seeds={display[i]} active={validPits.includes(i)}
                lit={litPit === i} pitIdx={i} onClick={() => handleClick(i)} />
            ))}
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-[#2d1006]/60 to-transparent" />
          <div className="flex gap-2.5">
            {p1Row.map(i => (
              <MancalaPit key={i} seeds={display[i]} active={validPits.includes(i)}
                lit={litPit === i} pitIdx={i} onClick={() => handleClick(i)} />
            ))}
          </div>
        </div>

        <MancalaStore seeds={display[6]} lit={litPit === 6} label={isHost ? "You" : "Opp"} />
      </div>

      <div className="flex w-full max-w-md justify-between px-20 text-[10px] text-arena-text-muted">
        <span>↑ {isHost ? "Opponent" : "You"}</span>
        <span>{isHost ? "You" : "Opponent"} ↓</span>
      </div>

      {!gameOver && (
        <div className="flex gap-6 text-xs text-arena-text-muted">
          <span className={cn(isHost && isMyTurn && !animating && "text-yellow-400 font-semibold")}>
            {isHost ? "You" : "Opp"}: {display[6]}
          </span>
          <span className={cn(!isHost && isMyTurn && !animating && "text-yellow-400 font-semibold")}>
            {!isHost ? "You" : "Opp"}: {display[13]}
          </span>
        </div>
      )}
    </div>
  );
}
