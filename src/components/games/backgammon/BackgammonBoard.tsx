"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Col = "W" | "B";
type Pt = { col: Col; n: number } | null;

interface S {
  pts: Pt[];                   // 24 points, index 0 = point 1 (White's home side)
  bar: Record<Col, number>;
  off: Record<Col, number>;
  turn: Col;
  phase: "roll" | "move";
  dice: number[];              // remaining usable dice
}

type Mv =
  | { t: "roll"; d1: number; d2: number }
  | { t: "move"; from: number | "bar"; to: number | "off" };

// ── Initial board ──────────────────────────────────────────────────────────
// White moves 23→0 (bearing off past 0). Black moves 0→23 (bearing off past 23).
// Standard starting position:
//   idx 0  = point 1  (White home)   : 2 Black
//   idx 5  = point 6  (White home)   : 5 White
//   idx 7  = point 8                 : 3 White
//   idx 11 = point 12                : 5 Black
//   idx 12 = point 13                : 5 White
//   idx 16 = point 17                : 3 Black
//   idx 18 = point 19                : 5 Black
//   idx 23 = point 24 (Black home)   : 2 White

function init(): S {
  const pts: Pt[] = Array(24).fill(null);
  pts[0]  = { col: "B", n: 2 };
  pts[5]  = { col: "W", n: 5 };
  pts[7]  = { col: "W", n: 3 };
  pts[11] = { col: "B", n: 5 };
  pts[12] = { col: "W", n: 5 };
  pts[16] = { col: "B", n: 3 };
  pts[18] = { col: "B", n: 5 };
  pts[23] = { col: "W", n: 2 };
  return { pts, bar: { W: 0, B: 0 }, off: { W: 0, B: 0 }, turn: "W", phase: "roll", dice: [] };
}

// ── Logic helpers ──────────────────────────────────────────────────────────

const op = (c: Col): Col => c === "W" ? "B" : "W";
const mv = (c: Col) => c === "W" ? -1 : 1;  // direction per color

function canLand(pts: Pt[], i: number, c: Col) {
  if (i < 0 || i > 23) return false;
  const p = pts[i];
  return !p || p.col === c || p.n === 1;     // empty, own, or blot
}

function homeRange(c: Col): [number, number] {
  return c === "W" ? [0, 5] : [18, 23];
}

function allHome(s: S, c: Col) {
  if (s.bar[c] > 0) return false;
  const [lo, hi] = homeRange(c);
  let n = s.off[c];
  for (let i = lo; i <= hi; i++) if (s.pts[i]?.col === c) n += s.pts[i]!.n;
  return n === 15;
}

// Is there a checker on a point further from bearing off than idx?
function hasBeyond(pts: Pt[], idx: number, c: Col) {
  if (c === "W") { for (let j = idx + 1; j <= 5; j++) if (pts[j]?.col === "W") return true; }
  else           { for (let j = 18; j < idx; j++)     if (pts[j]?.col === "B") return true; }
  return false;
}

function destsFor(s: S, from: number | "bar"): Array<number | "off"> {
  const c = s.turn;
  const bearing = allHome(s, c);
  const dir = mv(c);
  const out = new Set<number | "off">();

  for (const die of new Set(s.dice)) {
    if (from === "bar") {
      const to = c === "W" ? 24 - die : die - 1;
      if (canLand(s.pts, to, c)) out.add(to);
    } else {
      const f = from as number;
      const to = f + die * dir;
      if (to >= 0 && to <= 23) {
        if (canLand(s.pts, to, c)) out.add(to);
      } else if (bearing) {
        if (c === "W" && to < 0  && (to === -1 || !hasBeyond(s.pts, f, c))) out.add("off");
        if (c === "B" && to > 23 && (to === 24 || !hasBeyond(s.pts, f, c))) out.add("off");
      }
    }
  }
  return [...out];
}

function anyMoves(s: S): boolean {
  const c = s.turn;
  if (s.bar[c] > 0) return destsFor(s, "bar").length > 0;
  for (let i = 0; i < 24; i++) if (s.pts[i]?.col === c && destsFor(s, i).length > 0) return true;
  return false;
}

function pickDie(dice: number[], from: number | "bar", to: number | "off", c: Col): number | null {
  if (from === "bar" && to !== "off") {
    const need = c === "W" ? 24 - (to as number) : (to as number) + 1;
    return dice.includes(need) ? need : null;
  }
  if (to === "off" && from !== "bar") {
    // Use smallest die that overshoots (or exact)
    for (const d of [...dice].sort((a, b) => a - b)) {
      const t = (from as number) + d * mv(c);
      if (c === "W" ? t < 0 : t > 23) return d;
    }
    return null;
  }
  if (from !== "bar" && to !== "off") {
    const need = Math.abs((to as number) - (from as number));
    return dice.includes(need) ? need : null;
  }
  return null;
}

function applyMv(s: S, move: Mv): S {
  if (move.t === "roll") {
    const dice = move.d1 === move.d2 ? [move.d1, move.d1, move.d1, move.d1] : [move.d1, move.d2];
    return { ...s, dice, phase: "move" };
  }

  const { from, to } = move;
  const c = s.turn;
  const pts = s.pts.map(p => p ? { ...p } : null) as Pt[];
  const bar = { ...s.bar };
  const off = { ...s.off };

  const die = pickDie(s.dice, from, to, c);
  if (die === null) return s;
  const dice = [...s.dice];
  dice.splice(dice.indexOf(die), 1);

  // Remove from source
  if (from === "bar") {
    if (bar[c] === 0) return s;
    bar[c]--;
  } else {
    const f = from as number;
    if (!pts[f] || pts[f]!.col !== c) return s;
    if (--pts[f]!.n === 0) pts[f] = null;
  }

  // Place at destination
  if (to === "off") {
    off[c]++;
  } else {
    const t = to as number;
    if (pts[t] && pts[t]!.col !== c) { bar[op(c)]++; pts[t] = null; }  // hit blot
    pts[t] = pts[t] ? { ...pts[t]!, n: pts[t]!.n + 1 } : { col: c, n: 1 };
  }

  if (off[c] === 15) return { ...s, pts, bar, off, dice: [], phase: "roll" };

  const next: S = { ...s, pts, bar, off, dice, phase: "move" };
  if (!dice.length || !anyMoves(next)) return { ...next, turn: op(c), phase: "roll", dice: [] };
  return next;
}

// ── Component ──────────────────────────────────────────────────────────────

interface Props { room: GameRoom }

export default function BackgammonBoard({ room }: Props) {
  const myId   = useGameStore(s => s.myPlayerId);
  const moves  = useGameStore(s => s.moves);
  const applied = useRef(0);
  const sRef   = useRef<S>(init());

  const myCol: Col = room.hostId === myId ? "W" : "B";

  const [gs, setGs]   = useState<S>(init());
  const [sel, setSel] = useState<number | "bar" | null>(null);

  const myTurn = gs.turn === myCol;

  const push = (s: S) => { sRef.current = s; setGs({ ...s }); };

  useEffect(() => { push(init()); applied.current = 0; setSel(null); }, [room.hostId]);

  useEffect(() => {
    const pending = moves.slice(applied.current);
    if (!pending.length) return;
    let s = sRef.current;
    for (const m of pending) s = applyMv(s, m.payload as Mv);
    push(s); setSel(null); applied.current = moves.length;
  }, [moves]);

  useEffect(() => {
    if (useGameStore.getState().result) return;
    if (gs.off.W === 15) useGameStore.getState().setResult({ winnerId: room.hostId,         reason: "bearoff" });
    if (gs.off.B === 15) useGameStore.getState().setResult({ winnerId: room.guestId ?? null, reason: "bearoff" });
  }, [gs.off.W, gs.off.B, room.hostId, room.guestId]);

  const emit = useCallback((payload: Mv) => {
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [room.id, myId]);

  const handleRoll = () => {
    if (!myTurn || gs.phase !== "roll") return;
    const d1 = Math.ceil(Math.random() * 6);
    const d2 = Math.ceil(Math.random() * 6);
    const payload: Mv = { t: "roll", d1, d2 };
    push(applyMv(sRef.current, payload));
    emit(payload);
  };

  const handleMove = (to: number | "off") => {
    if (!myTurn || sel === null) return;
    const payload: Mv = { t: "move", from: sel, to };
    const next = applyMv(sRef.current, payload);
    if (next === sRef.current) return;
    push(next); setSel(null); emit(payload);
  };

  const handleSelect = (from: number | "bar") => {
    if (!myTurn || gs.phase !== "move") return;
    if (from === "bar") { if (!gs.bar[gs.turn]) return; }
    else if (gs.pts[from as number]?.col !== gs.turn) return;
    setSel(p => p === from ? null : from);
  };

  const dests = sel !== null ? destsFor(gs, sel) : [];

  // Layout: top row L→R: 12..17 | bar | 18..23
  //         bot row L→R: 11..6  | bar | 5..0
  const topLeft  = [12,13,14,15,16,17];
  const topRight = [18,19,20,21,22,23];
  const botLeft  = [11,10,9,8,7,6];
  const botRight = [5,4,3,2,1,0];

  const ptColor = (i: number) => i % 2 === 0 ? "#7f1d1d" : "#92400e";

  const barClickable = myTurn && gs.phase === "move" && gs.bar[gs.turn] > 0;

  const statusMsg = myTurn
    ? gs.phase === "roll" ? "Your turn — roll the dice" : sel !== null ? "Choose a destination" : "Select a checker to move"
    : gs.phase === "roll" ? "Opponent's turn to roll" : "Opponent is moving…";

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <p className="text-sm text-arena-text-muted">
        {statusMsg} · <span className="font-medium">{myCol === "W" ? "You are White ○" : "You are Black ●"}</span>
      </p>

      {/* Board */}
      <div className="w-full overflow-x-auto">
        <div style={{ minWidth: 520, maxWidth: 760, margin: "0 auto" }}>
          <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#1b5e30", border: "6px solid #78350f" }}>

            {/* TOP ROW */}
            <div className="flex" style={{ height: 150 }}>
              <Half
                indices={topLeft} pts={gs.pts} sel={sel} dests={dests}
                isTop ptColor={ptColor} onSelect={handleSelect} onMove={handleMove}
              />
              <Bar
                gs={gs} isTop
                selected={sel === "bar"}
                clickable={barClickable}
                dests={dests}
                onClick={() => handleSelect("bar")}
                onMoveTo={handleMove}
              />
              <Half
                indices={topRight} pts={gs.pts} sel={sel} dests={dests}
                isTop ptColor={ptColor} onSelect={handleSelect} onMove={handleMove}
              />
            </div>

            {/* MIDDLE: dice + roll */}
            <div className="flex items-center justify-center gap-3 py-2 px-3" style={{ background: "#0d3b1f", minHeight: 48 }}>
              {gs.dice.map((v, i) => <Die key={i} value={v} />)}
              {myTurn && gs.phase === "roll" && (
                <button
                  onClick={handleRoll}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold shadow transition-colors"
                >
                  Roll dice
                </button>
              )}
              {gs.phase === "move" && gs.dice.length === 0 && (
                <span className="text-white/40 text-xs">No dice remaining</span>
              )}
            </div>

            {/* BOTTOM ROW */}
            <div className="flex" style={{ height: 150 }}>
              <Half
                indices={botLeft} pts={gs.pts} sel={sel} dests={dests}
                isTop={false} ptColor={ptColor} onSelect={handleSelect} onMove={handleMove}
              />
              <Bar
                gs={gs} isTop={false}
                selected={sel === "bar"}
                clickable={barClickable}
                dests={dests}
                onClick={() => handleSelect("bar")}
                onMoveTo={handleMove}
              />
              <Half
                indices={botRight} pts={gs.pts} sel={sel} dests={dests}
                isTop={false} ptColor={ptColor} onSelect={handleSelect} onMove={handleMove}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bear-off button + borne-off counts */}
      <div className="flex items-center gap-6 text-sm text-arena-text-muted flex-wrap justify-center">
        <span>○ White off: <strong className="text-arena-text">{gs.off.W}</strong>/15</span>
        {sel !== null && dests.includes("off") && (
          <button
            onClick={() => handleMove("off")}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold shadow transition-colors"
          >
            Bear off checker
          </button>
        )}
        <span>● Black off: <strong className="text-arena-text">{gs.off.B}</strong>/15</span>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function Half({ indices, pts, sel, dests, isTop, ptColor, onSelect, onMove }: {
  indices: number[]; pts: Pt[]; sel: number | "bar" | null;
  dests: Array<number | "off">; isTop: boolean;
  ptColor: (i: number) => string;
  onSelect: (f: number) => void;
  onMove: (t: number) => void;
}) {
  return (
    <div className="flex flex-1">
      {indices.map(idx => {
        const pt = pts[idx];
        const isSelected = sel === idx;
        const isValidDest = dests.includes(idx);
        const count = pt ? Math.min(pt.n, 6) : 0;
        return (
          <div
            key={idx}
            className="relative flex-1 flex cursor-pointer"
            style={{ flexDirection: isTop ? "column" : "column-reverse" }}
            onClick={() => isValidDest ? onMove(idx) : onSelect(idx)}
          >
            {/* Triangle */}
            <div className="absolute inset-0" style={{
              background: ptColor(idx),
              clipPath: isTop ? "polygon(12% 2%, 88% 2%, 50% 90%)" : "polygon(12% 98%, 88% 98%, 50% 10%)",
              opacity: 0.9,
            }} />
            {/* Highlights */}
            {isValidDest && (
              <div className="absolute inset-0 z-10" style={{ background: "rgba(251,191,36,0.28)" }} />
            )}
            {isSelected && (
              <div className="absolute inset-0 z-10" style={{ background: "rgba(255,255,255,0.18)" }} />
            )}
            {/* Checkers */}
            <div
              className="relative z-20 flex flex-col items-center gap-[2px]"
              style={{ paddingTop: isTop ? 4 : 0, paddingBottom: isTop ? 0 : 4 }}
            >
              {Array.from({ length: count }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-full flex items-center justify-center text-[9px] font-bold border-2 shrink-0",
                    "w-[26px] h-[26px]",
                    pt!.col === "W"
                      ? "bg-gray-100 border-gray-400 text-gray-500"
                      : "bg-zinc-900 border-zinc-500 text-zinc-300"
                  )}
                >
                  {i === count - 1 && pt!.n > 6 ? pt!.n : ""}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bar({ gs, isTop, selected, clickable, dests, onClick, onMoveTo }: {
  gs: S; isTop: boolean; selected: boolean; clickable: boolean;
  dests: Array<number | "off">;
  onClick: () => void;
  onMoveTo: (t: number | "off") => void;
}) {
  // Top bar shows Black's bar checkers; bottom bar shows White's
  const col: Col = isTop ? "B" : "W";
  const count = gs.bar[col];
  const hasBarDests = selected && dests.filter(d => d !== "off").length > 0;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-1 transition-colors",
        clickable && count > 0 && "cursor-pointer hover:bg-white/10",
        selected && "bg-white/15"
      )}
      style={{ width: 40, background: selected ? "rgba(255,255,255,0.12)" : "#0d3b1f" }}
      onClick={clickable && count > 0 ? onClick : undefined}
    >
      {count > 0 && (
        <>
          {Array.from({ length: Math.min(count, 3) }, (_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full border-2 w-[24px] h-[24px]",
                col === "W" ? "bg-gray-100 border-gray-400" : "bg-zinc-900 border-zinc-500"
              )}
            />
          ))}
          {count > 3 && <span className="text-white/70 text-[9px] font-bold">×{count}</span>}
        </>
      )}
      {/* Quick-enter buttons if bar is selected */}
      {hasBarDests && dests.filter(d => d !== "off").map(d => (
        <button
          key={d}
          onClick={(e) => { e.stopPropagation(); onMoveTo(d as number); }}
          className="text-[9px] font-bold bg-amber-400 text-white rounded px-1 leading-tight"
        >
          {(d as number) + 1}
        </button>
      ))}
    </div>
  );
}

function Die({ value }: { value: number }) {
  const dots: [number, number][][] = [
    [], [[50,50]],
    [[28,28],[72,72]],
    [[28,28],[50,50],[72,72]],
    [[28,28],[72,28],[28,72],[72,72]],
    [[28,28],[72,28],[50,50],[28,72],[72,72]],
    [[28,22],[72,22],[28,50],[72,50],[28,78],[72,78]],
  ];
  return (
    <div className="relative w-9 h-9 bg-white rounded-lg border-2 border-gray-300 shadow">
      {dots[value].map(([x, y], i) => (
        <div key={i} className="absolute w-[7px] h-[7px] bg-gray-900 rounded-full"
          style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }} />
      ))}
    </div>
  );
}
