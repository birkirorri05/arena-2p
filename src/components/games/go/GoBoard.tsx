"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import type { GameRoom } from "@/types/game";

const SIZE = 19;
const CELL = 28;
const PAD = 24;
const STONE_R = CELL / 2 - 2;
const SVG_SIZE = (SIZE - 1) * CELL + PAD * 2;
const KOMI = 6.5;

type Color = "B" | "W";
type Grid = (Color | null)[][];

const STAR_POINTS: [number, number][] = [
  [3, 3], [9, 3], [15, 3],
  [3, 9], [9, 9], [15, 9],
  [3, 15], [9, 15], [15, 15],
];

interface GoState {
  grid: Grid;
  blackNext: boolean;
  prevKey: string | null;
  passes: number;
  capturedByBlack: number;
  capturedByWhite: number;
}

type MovePayload = { type: "place"; x: number; y: number } | { type: "pass" };

function emptyGrid(): Grid {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function initState(): GoState {
  return { grid: emptyGrid(), blackNext: true, prevKey: null, passes: 0, capturedByBlack: 0, capturedByWhite: 0 };
}

function gridKey(grid: Grid): string {
  return grid.map(row => row.map(c => c ?? ".").join("")).join("|");
}

function nbrs(x: number, y: number): [number, number][] {
  return ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as [number, number][]).filter(
    ([nx, ny]) => nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE
  );
}

function getGroup(grid: Grid, x: number, y: number, color: Color): Set<string> {
  const visited = new Set<string>();
  const stack: [number, number][] = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop()!;
    const key = `${cx},${cy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    for (const [nx, ny] of nbrs(cx, cy)) {
      if (!visited.has(`${nx},${ny}`) && grid[ny][nx] === color) stack.push([nx, ny]);
    }
  }
  return visited;
}

function liberties(grid: Grid, group: Set<string>): number {
  const libs = new Set<string>();
  for (const pos of group) {
    const [x, y] = pos.split(",").map(Number);
    for (const [nx, ny] of nbrs(x, y)) {
      if (grid[ny][nx] === null) libs.add(`${nx},${ny}`);
    }
  }
  return libs.size;
}

// Returns [newGrid, capturedCount] or null if the move is invalid
function placeStone(grid: Grid, x: number, y: number, color: Color, prevKey: string | null): [Grid, number] | null {
  if (grid[y][x] !== null) return null;
  const next = grid.map(row => [...row]) as Grid;
  next[y][x] = color;
  const opp: Color = color === "B" ? "W" : "B";
  let captured = 0;
  for (const [nx, ny] of nbrs(x, y)) {
    if (next[ny][nx] === opp) {
      const group = getGroup(next, nx, ny, opp);
      if (liberties(next, group) === 0) {
        for (const pos of group) {
          const [gx, gy] = pos.split(",").map(Number);
          next[gy][gx] = null;
          captured++;
        }
      }
    }
  }
  // Self-capture not allowed
  if (liberties(next, getGroup(next, x, y, color)) === 0) return null;
  // Ko: resulting board cannot equal the board before the last move
  if (prevKey !== null && gridKey(next) === prevKey) return null;
  return [next, captured];
}

function applyPayload(state: GoState, payload: MovePayload): GoState {
  const color: Color = state.blackNext ? "B" : "W";
  if (payload.type === "pass") {
    return { ...state, blackNext: !state.blackNext, passes: state.passes + 1 };
  }
  const { x, y } = payload;
  const result = placeStone(state.grid, x, y, color, state.prevKey);
  if (!result) return state;
  const [newGrid, removed] = result;
  return {
    grid: newGrid,
    blackNext: !state.blackNext,
    prevKey: gridKey(state.grid),
    passes: 0,
    capturedByBlack: color === "B" ? state.capturedByBlack + removed : state.capturedByBlack,
    capturedByWhite: color === "W" ? state.capturedByWhite + removed : state.capturedByWhite,
  };
}

function computeScore(grid: Grid): { B: number; W: number } {
  let stonesB = 0, stonesW = 0;
  const visited = new Set<string>();

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] === "B") stonesB++;
      else if (grid[y][x] === "W") stonesW++;
    }
  }

  let terrB = 0, terrW = 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] !== null || visited.has(`${x},${y}`)) continue;
      const region: string[] = [];
      const borders = new Set<Color>();
      const stack: [number, number][] = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        const key = `${cx},${cy}`;
        if (visited.has(key)) continue;
        if (grid[cy][cx] !== null) { borders.add(grid[cy][cx]!); continue; }
        visited.add(key);
        region.push(key);
        for (const [nx, ny] of nbrs(cx, cy)) stack.push([nx, ny]);
      }
      if (borders.size === 1) {
        if ([...borders][0] === "B") terrB += region.length;
        else terrW += region.length;
      }
    }
  }

  return { B: stonesB + terrB, W: stonesW + terrW };
}

interface Props { room: GameRoom }

export default function GoBoard({ room }: Props) {
  const myId = useGameStore(s => s.myPlayerId);
  const moves = useGameStore(s => s.moves);
  const appliedRef = useRef(0);
  const stateRef = useRef<GoState>(initState());

  const isHost = room.hostId === myId;
  const myColor: Color = isHost ? "B" : "W";

  const [gs, setGs] = useState<GoState>(initState());
  const [hover, setHover] = useState<[number, number] | null>(null);

  const myTurn = (gs.blackNext ? "B" : "W") === myColor;

  // Reset on rematch
  useEffect(() => {
    const s = initState();
    stateRef.current = s;
    setGs(s);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    let s = stateRef.current;
    for (const move of pending) s = applyPayload(s, move.payload as MovePayload);
    stateRef.current = s;
    setGs({ ...s });
    appliedRef.current = moves.length;
  }, [moves]);

  // Trigger game over when both pass
  useEffect(() => {
    if (gs.passes < 2 || useGameStore.getState().result) return;
    const score = computeScore(gs.grid);
    const bScore = score.B;
    const wScore = score.W + KOMI;
    const winnerId = bScore > wScore ? room.hostId : (room.playerIds[1] ?? null);
    useGameStore.getState().setResult({
      winnerId,
      reason: `B ${bScore} – W ${wScore.toFixed(1)}`,
    });
  }, [gs.passes, gs.grid, room.hostId, room.playerIds]);

  const emitMove = useCallback((payload: MovePayload) => {
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [room.id, myId]);

  const handlePlace = useCallback((x: number, y: number) => {
    if (room.status !== "playing" || !myTurn || gs.passes >= 2) return;
    const color: Color = stateRef.current.blackNext ? "B" : "W";
    const result = placeStone(stateRef.current.grid, x, y, color, stateRef.current.prevKey);
    if (!result) return;
    const payload: MovePayload = { type: "place", x, y };
    const newState = applyPayload(stateRef.current, payload);
    stateRef.current = newState;
    setGs({ ...newState });
    emitMove(payload);
  }, [myTurn, gs.passes, emitMove, room.status]);

  const handlePass = useCallback(() => {
    if (room.status !== "playing" || !myTurn || gs.passes >= 2) return;
    const payload: MovePayload = { type: "pass" };
    const newState = applyPayload(stateRef.current, payload);
    stateRef.current = newState;
    setGs({ ...newState });
    emitMove(payload);
  }, [myTurn, gs.passes, emitMove, room.status]);

  const canPlace = useCallback((x: number, y: number): boolean => {
    if (!myTurn || gs.grid[y][x] !== null || gs.passes >= 2) return false;
    const color: Color = gs.blackNext ? "B" : "W";
    return placeStone(gs.grid, x, y, color, gs.prevKey) !== null;
  }, [myTurn, gs]);

  const toSVG = (n: number) => PAD + n * CELL;

  const statusMsg = gs.passes >= 2
    ? "Game over — both players passed"
    : gs.passes === 1
    ? (myTurn ? "Your turn (opponent passed)" : "Opponent's turn (you passed)")
    : myTurn
    ? `Your turn — ${myColor === "B" ? "Black" : "White"}`
    : `Opponent's turn — ${myColor === "B" ? "White" : "Black"}`;

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      {/* Scoreboard */}
      <div className="flex w-full max-w-2xl justify-between text-sm">
        <div className={`px-3 py-1 rounded-lg ${gs.blackNext && gs.passes < 2 ? "bg-arena-surface ring-1 ring-arena-accent" : ""}`}>
          <span className="font-medium text-arena-text">⚫ Black</span>
          <span className="ml-2 text-arena-text-muted">captured {gs.capturedByBlack}</span>
          {myColor === "B" && <span className="ml-2 text-xs text-arena-accent">(you)</span>}
        </div>
        <div className={`px-3 py-1 rounded-lg ${!gs.blackNext && gs.passes < 2 ? "bg-arena-surface ring-1 ring-arena-accent" : ""}`}>
          {myColor === "W" && <span className="mr-2 text-xs text-arena-accent">(you)</span>}
          <span className="font-medium text-arena-text">⚪ White</span>
          <span className="ml-2 text-arena-text-muted">captured {gs.capturedByWhite}</span>
        </div>
      </div>

      <p className="text-sm text-arena-text-muted">{statusMsg}</p>

      {/* Board */}
      <div className="overflow-auto rounded-xl shadow-2xl">
        <svg
          width={SVG_SIZE}
          height={SVG_SIZE}
          style={{ background: "#c8a45a", display: "block" }}
        >
          {/* Grid lines */}
          {Array.from({ length: SIZE }, (_, i) => (
            <g key={i}>
              <line x1={toSVG(0)} y1={toSVG(i)} x2={toSVG(SIZE - 1)} y2={toSVG(i)} stroke="#7a5c1a" strokeWidth={1} />
              <line x1={toSVG(i)} y1={toSVG(0)} x2={toSVG(i)} y2={toSVG(SIZE - 1)} stroke="#7a5c1a" strokeWidth={1} />
            </g>
          ))}

          {/* Star points */}
          {STAR_POINTS.map(([x, y]) => (
            <circle key={`s${x},${y}`} cx={toSVG(x)} cy={toSVG(y)} r={3.5} fill="#7a5c1a" />
          ))}

          {/* Ghost stone on hover */}
          {hover && canPlace(hover[0], hover[1]) && (
            <circle
              cx={toSVG(hover[0])} cy={toSVG(hover[1])} r={STONE_R}
              fill={myColor === "B" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.5)"}
              stroke={myColor === "B" ? "#333" : "#aaa"} strokeWidth={1}
            />
          )}

          {/* Stones */}
          {gs.grid.map((row, y) =>
            row.map((cell, x) => {
              if (!cell) return null;
              return (
                <circle
                  key={`${x},${y}`}
                  cx={toSVG(x)} cy={toSVG(y)} r={STONE_R}
                  fill={cell === "B" ? "#111" : "#f0ede0"}
                  stroke={cell === "B" ? "#000" : "#999"} strokeWidth={1}
                />
              );
            })
          )}

          {/* Transparent click / hover targets */}
          {Array.from({ length: SIZE }, (_, y) =>
            Array.from({ length: SIZE }, (_, x) => (
              <rect
                key={`t${x},${y}`}
                x={toSVG(x) - CELL / 2} y={toSVG(y) - CELL / 2}
                width={CELL} height={CELL}
                fill="transparent"
                style={{ cursor: canPlace(x, y) ? "pointer" : "default" }}
                onMouseEnter={() => setHover([x, y])}
                onMouseLeave={() => setHover(null)}
                onClick={() => handlePlace(x, y)}
              />
            ))
          )}
        </svg>
      </div>

      {/* Pass button */}
      <button
        onClick={handlePass}
        disabled={!myTurn || gs.passes >= 2}
        className="px-5 py-2 rounded-lg border border-arena-border text-sm text-arena-text-muted hover:bg-arena-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Pass{gs.passes === 1 ? " (opponent passed)" : ""}
      </button>

      <p className="text-xs text-arena-text-muted">
        Chinese rules · {KOMI} komi for White · two passes ends the game
      </p>
    </div>
  );
}
