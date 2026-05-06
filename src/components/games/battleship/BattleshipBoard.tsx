"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

const G = 10;
const SHIP_DEFS = [
  { id: "carrier",    name: "Carrier",    length: 5 },
  { id: "battleship", name: "Battleship", length: 4 },
  { id: "cruiser",    name: "Cruiser",    length: 3 },
  { id: "submarine",  name: "Submarine",  length: 3 },
  { id: "destroyer",  name: "Destroyer",  length: 2 },
];

type CS  = null | "ship" | "hit" | "miss"; // own-grid cell
type AS  = null | "hit" | "miss";          // attack-grid cell
type PlacedShip = { id: string; cells: [number, number][] };
type Payload =
  | { type: "ready";  ships: PlacedShip[] }
  | { type: "attack"; row: number; col: number };

const makeGrid = <T,>(val: T): T[][] =>
  Array.from({ length: G }, () => Array(G).fill(val) as T[]);

function shipCells(r: number, c: number, len: number, h: boolean): [number, number][] {
  return Array.from({ length: len }, (_, i) =>
    (h ? [r, c + i] : [r + i, c]) as [number, number]
  );
}

function canPlace(grid: CS[][], cells: [number, number][]): boolean {
  return cells.every(([r, c]) => r >= 0 && r < G && c >= 0 && c < G && grid[r][c] === null);
}

function isSunk(ship: PlacedShip, hits: Set<string>): boolean {
  return ship.cells.every(([r, c]) => hits.has(`${r},${c}`));
}

interface Props { room: GameRoom }

export default function BattleshipBoard({ room }: Props) {
  const [myGrid,   setMyGrid]   = useState<CS[][]>(() => makeGrid(null));
  const [atkGrid,  setAtkGrid]  = useState<AS[][]>(() => makeGrid(null));
  const [myShips,  setMyShips]  = useState<PlacedShip[]>([]);
  const [oppShips, setOppShips] = useState<PlacedShip[]>([]);
  const [shipIdx,  setShipIdx]  = useState(0);
  const [horiz,    setHoriz]    = useState(true);
  const [hover,    setHover]    = useState<[number, number] | null>(null);
  const [iAmReady, setIAmReady] = useState(false);
  const [oppReady, setOppReady] = useState(false);
  const [hostTurn, setHostTurn] = useState(true); // host fires first

  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost   = room.hostId === myId;
  const allPlaced = shipIdx >= SHIP_DEFS.length;
  const phase    = !iAmReady ? "placing" : !oppReady ? "waiting" : "playing";
  const isMyTurn = phase === "playing" && hostTurn === isHost;

  // Hit sets derived from grid state
  const myHits  = new Set<string>();
  const oppHits = new Set<string>();
  for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) {
    if (atkGrid[r][c] === "hit") myHits.add(`${r},${c}`);
    if (myGrid[r][c]  === "hit") oppHits.add(`${r},${c}`);
  }

  const iWon  = phase === "playing" && oppShips.length === SHIP_DEFS.length
    && oppShips.every(s => isSunk(s, myHits));
  const iLost = phase === "playing" && myShips.length === SHIP_DEFS.length
    && myShips.every(s => isSunk(s, oppHits));
  const gameOver = iWon || iLost;

  // Placement preview
  const previewCells = hover && !allPlaced
    ? shipCells(hover[0], hover[1], SHIP_DEFS[shipIdx].length, horiz) : [];
  const previewOk  = previewCells.length > 0 && canPlace(myGrid, previewCells);
  const previewSet = new Set(previewCells.map(([r, c]) => `${r},${c}`));

  // Reset on rematch
  useEffect(() => {
    setMyGrid(makeGrid(null)); setAtkGrid(makeGrid(null));
    setMyShips([]); setOppShips([]);
    setShipIdx(0); setHoriz(true); setHover(null);
    setIAmReady(false); setOppReady(false); setHostTurn(true);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    for (const move of pending) {
      const p = move.payload as Payload;
      if (!p?.type) continue;
      if (p.type === "ready") {
        setOppShips(p.ships);
        setOppReady(true);
      } else if (p.type === "attack") {
        const { row, col } = p;
        setMyGrid(prev => {
          const next = prev.map(r => [...r]) as CS[][];
          next[row][col] = next[row][col] === "ship" ? "hit" : "miss";
          return next;
        });
        setHostTurn(h => !h);
      }
    }
    appliedRef.current = moves.length;
  }, [moves]);

  // Game over
  useEffect(() => {
    if (!gameOver || useGameStore.getState().result) return;
    const winnerId = iWon ? (myId ?? null) : (isHost ? room.guestId : room.hostId);
    useGameStore.getState().setResult({ winnerId, reason: "all ships sunk" });
  }, [gameOver, iWon, myId, isHost, room.guestId, room.hostId]);

  const handlePlace = useCallback((r: number, c: number) => {
    if (allPlaced) return;
    const cells = shipCells(r, c, SHIP_DEFS[shipIdx].length, horiz);
    if (!canPlace(myGrid, cells)) return;
    const ship = SHIP_DEFS[shipIdx];
    setMyGrid(prev => {
      const next = prev.map(row => [...row]) as CS[][];
      cells.forEach(([r, c]) => { next[r][c] = "ship"; });
      return next;
    });
    setMyShips(prev => [...prev, { id: ship.id, cells }]);
    setShipIdx(i => i + 1);
  }, [allPlaced, shipIdx, horiz, myGrid]);

  const handleReady = useCallback(() => {
    if (!allPlaced || iAmReady) return;
    setIAmReady(true);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "", timestamp: Date.now(),
      payload: { type: "ready", ships: myShips },
    });
  }, [allPlaced, iAmReady, myShips, myId, room.id]);

  const handleAttack = useCallback((r: number, c: number) => {
    if (!isMyTurn || gameOver || atkGrid[r][c] !== null) return;
    const hit = oppShips.some(s => s.cells.some(([sr, sc]) => sr === r && sc === c));
    setAtkGrid(prev => {
      const next = prev.map(row => [...row]) as AS[][];
      next[r][c] = hit ? "hit" : "miss";
      return next;
    });
    setHostTurn(h => !h);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "", timestamp: Date.now(),
      payload: { type: "attack", row: r, col: c },
    });
  }, [isMyTurn, gameOver, atkGrid, oppShips, myId, room.id]);

  const statusMsg =
    gameOver ? (iWon ? "Victory! All enemy ships sunk." : "Defeat! All your ships were sunk.")
    : phase === "placing" ? (allPlaced ? "All ships placed — press Ready!" : `Placing: ${SHIP_DEFS[shipIdx].name} (${SHIP_DEFS[shipIdx].length} cells)`)
    : phase === "waiting" ? "Waiting for opponent to finish placing ships…"
    : isMyTurn ? "Your turn — click the target grid to fire"
    : "Opponent's turn…";

  return (
    <div className="flex flex-col items-center gap-5">
      <p className="text-sm font-medium text-arena-text">{statusMsg}</p>

      {/* ── PLACEMENT PHASE ── */}
      {phase === "placing" && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-2 flex-wrap justify-center">
            {SHIP_DEFS.map((s, i) => (
              <span key={s.id} className={cn(
                "rounded px-2 py-1 text-xs border font-mono",
                i < shipIdx  ? "border-green-700 bg-green-950 text-green-500 line-through"
                : i === shipIdx ? "border-indigo-400 bg-indigo-950 text-indigo-300"
                : "border-arena-border text-arena-text-muted"
              )}>
                {s.name} {"█".repeat(s.length)}
              </span>
            ))}
          </div>

          {!allPlaced && (
            <button onClick={() => setHoriz(h => !h)}
              className="rounded border border-arena-border bg-arena-surface px-3 py-1 text-xs text-arena-text hover:bg-arena-bg transition-colors">
              {horiz ? "→ Horizontal (click to rotate)" : "↓ Vertical (click to rotate)"}
            </button>
          )}

          <BattleGrid size={40}
            onCellClick={handlePlace}
            onCellHover={allPlaced ? undefined : (r, c) => setHover([r, c])}
            onLeave={() => setHover(null)}
            cellClass={(r, c) => {
              const cell = myGrid[r][c];
              const key = `${r},${c}`;
              const isPrev = previewSet.has(key);
              return cn(
                isPrev && previewOk  ? "bg-emerald-600/70 hover:bg-emerald-500/70"
                : isPrev             ? "bg-red-600/70"
                : cell === "ship"    ? "bg-slate-400"
                :                      "bg-blue-950 hover:bg-blue-800 cursor-crosshair"
              );
            }}
          />

          {allPlaced && (
            <button onClick={handleReady}
              className="rounded-lg bg-arena-accent px-8 py-2 text-sm font-semibold text-white hover:bg-indigo-600 transition-colors">
              Ready!
            </button>
          )}
        </div>
      )}

      {/* ── WAITING PHASE ── */}
      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs text-arena-text-muted">Your fleet:</p>
          <BattleGrid size={36} cellClass={(r, c) =>
            myGrid[r][c] === "ship" ? "bg-slate-400" : "bg-blue-950"
          } />
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {phase === "playing" && (
        <div className="flex gap-8 flex-wrap justify-center">
          {/* My fleet */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-arena-text-muted">Your Fleet</p>
            <BattleGrid size={36}
              cellClass={(r, c) => {
                const cell = myGrid[r][c];
                const sunk = myShips.some(s => isSunk(s, oppHits) && s.cells.some(([sr,sc]) => sr===r && sc===c));
                return cn(
                  cell === null   ? "bg-blue-950"
                  : cell === "ship" ? "bg-slate-400"
                  : cell === "hit"  ? (sunk ? "bg-red-800" : "bg-red-600")
                  :                    "bg-blue-900"
                );
              }}
              overlay={(r, c) => {
                const cell = myGrid[r][c];
                if (cell === "hit")  return <span className="text-white text-[11px] font-bold leading-none">✕</span>;
                if (cell === "miss") return <span className="text-blue-400 text-[11px] leading-none">•</span>;
                return null;
              }}
            />
            {/* Sunk indicator */}
            <div className="flex gap-1 flex-wrap justify-center mt-1">
              {myShips.map(s => (
                <span key={s.id} className={cn("text-[10px] px-1 rounded",
                  isSunk(s, oppHits) ? "bg-red-900 text-red-300 line-through" : "bg-slate-800 text-slate-400"
                )}>{SHIP_DEFS.find(d => d.id === s.id)?.name}</span>
              ))}
            </div>
          </div>

          {/* Target grid */}
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-arena-text-muted">
              Target {isMyTurn && !gameOver ? "← Fire!" : ""}
            </p>
            <BattleGrid size={36}
              onCellClick={isMyTurn && !gameOver ? handleAttack : undefined}
              cellClass={(r, c) => {
                const cell = atkGrid[r][c];
                const sunk = oppShips.some(s => isSunk(s, myHits) && s.cells.some(([sr,sc]) => sr===r && sc===c));
                return cn(
                  cell === null   ? cn("bg-blue-950", isMyTurn && !gameOver && "hover:bg-blue-800 cursor-crosshair")
                  : cell === "hit"  ? (sunk ? "bg-red-800" : "bg-orange-600")
                  :                    "bg-blue-900"
                );
              }}
              overlay={(r, c) => {
                const cell = atkGrid[r][c];
                if (cell === "hit")  return <span className="text-white text-[11px] font-bold leading-none">✕</span>;
                if (cell === "miss") return <span className="text-blue-400 text-[11px] leading-none">•</span>;
                return null;
              }}
            />
            {/* Sunk indicator */}
            <div className="flex gap-1 flex-wrap justify-center mt-1">
              {oppShips.map(s => (
                <span key={s.id} className={cn("text-[10px] px-1 rounded",
                  isSunk(s, myHits) ? "bg-red-900 text-red-300 line-through" : "bg-slate-800 text-slate-400"
                )}>{SHIP_DEFS.find(d => d.id === s.id)?.name}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reusable grid component ──────────────────────────────────────────────────

interface GridProps {
  size: number;
  cellClass: (r: number, c: number) => string;
  overlay?: (r: number, c: number) => React.ReactNode;
  onCellClick?: (r: number, c: number) => void;
  onCellHover?: (r: number, c: number) => void;
  onLeave?: () => void;
}

function BattleGrid({ size, cellClass, overlay, onCellClick, onCellHover, onLeave }: GridProps) {
  const cols = "ABCDEFGHIJ";
  return (
    <div onMouseLeave={onLeave}>
      {/* Column labels */}
      <div className="flex ml-5">
        {Array.from({ length: G }, (_, c) => (
          <div key={c} style={{ width: size }} className="text-center text-[10px] text-arena-text-muted">{cols[c]}</div>
        ))}
      </div>
      <div className="flex">
        {/* Row labels */}
        <div className="flex flex-col">
          {Array.from({ length: G }, (_, r) => (
            <div key={r} style={{ height: size, width: 20 }}
              className="flex items-center justify-center text-[10px] text-arena-text-muted">
              {r + 1}
            </div>
          ))}
        </div>
        {/* Grid */}
        <div className="border border-arena-border"
          style={{ display: "grid", gridTemplateColumns: `repeat(${G}, ${size}px)` }}>
          {Array.from({ length: G }, (_, r) =>
            Array.from({ length: G }, (_, c) => (
              <button
                key={`${r}-${c}`}
                style={{ width: size, height: size }}
                className={cn("relative flex items-center justify-center border-r border-b border-black/10 transition-colors", cellClass(r, c))}
                onClick={() => onCellClick?.(r, c)}
                onMouseEnter={() => onCellHover?.(r, c)}
              >
                {overlay?.(r, c)}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
