"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

const SIZE = 8;
type Color = "r" | "b";
type Piece = { color: Color; king: boolean } | null;
type Board = Piece[][];
type Pos = [number, number];
type Move = { from: Pos; to: Pos; captures: Pos[] };

function initBoard(): Board {
  return Array.from({ length: SIZE }, (_, row) =>
    Array.from({ length: SIZE }, (_, col) => {
      if ((row + col) % 2 === 0) return null;
      if (row < 3) return { color: "b", king: false };
      if (row > 4) return { color: "r", king: false };
      return null;
    })
  );
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

// Recursively find all multi-jump chains; adds each chain as one Move.
function findJumps(
  board: Board,
  origin: Pos,
  r: number,
  c: number,
  captured: Pos[],
  results: Move[]
) {
  const piece = board[origin[0]][origin[1]]!;
  const dirs =
    piece.king ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "r" ? [[-1,-1],[-1,1]]
    : [[1,-1],[1,1]];

  let extended = false;
  for (const [dr, dc] of dirs) {
    const mr = r + dr;  const mc = c + dc;
    const lr = r + dr * 2; const lc = c + dc * 2;
    if (!inBounds(lr, lc)) continue;
    const mid = board[mr]?.[mc];
    if (!mid || mid.color === piece.color) continue;
    if (board[lr][lc]) continue;
    if (captured.some(([pr, pc]) => pr === mr && pc === mc)) continue;

    extended = true;
    // Simulate jump on a temporary board for further chaining
    const tmp: Board = board.map((row) => row.map((p) => (p ? { ...p } : null)));
    tmp[lr][lc] = tmp[origin[0]][origin[1]];
    tmp[mr][mc] = null;
    tmp[origin[0]][origin[1]] = null;

    findJumps(tmp, origin, lr, lc, [...captured, [mr, mc]], results);
  }

  // Record this chain as a valid landing if at least one capture occurred
  if (captured.length > 0 && !extended) {
    results.push({ from: origin, to: [r, c], captures: captured });
  }
  // Also record every intermediate stop (player may land here)
  if (captured.length > 0 && extended) {
    results.push({ from: origin, to: [r, c], captures: captured });
  }
}

function getMoves(board: Board, row: number, col: number): Move[] {
  const piece = board[row][col];
  if (!piece) return [];

  const jumps: Move[] = [];
  findJumps(board, [row, col], row, col, [], jumps);
  if (jumps.length > 0) return jumps;

  // Non-capture steps
  const dirs =
    piece.king ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "r" ? [[-1,-1],[-1,1]]
    : [[1,-1],[1,1]];
  const steps: Move[] = [];
  for (const [dr, dc] of dirs) {
    const nr = row + dr; const nc = col + dc;
    if (inBounds(nr, nc) && !board[nr][nc])
      steps.push({ from: [row, col], to: [nr, nc], captures: [] });
  }
  return steps;
}

function getAllMoves(board: Board, color: Color): Move[] {
  const all: Move[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (board[r][c]?.color === color) all.push(...getMoves(board, r, c));
  const hasJump = all.some((m) => m.captures.length > 0);
  return hasJump ? all.filter((m) => m.captures.length > 0) : all;
}

function applyMove(board: Board, move: Move): Board {
  const next: Board = board.map((r) => r.map((p) => (p ? { ...p } : null)));
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = next[fr][fc]!;
  const becomeKing =
    piece.king ||
    (piece.color === "r" && tr === 0) ||
    (piece.color === "b" && tr === SIZE - 1);
  next[tr][tc] = { ...piece, king: becomeKing };
  next[fr][fc] = null;
  for (const [cr, cc] of move.captures) next[cr][cc] = null;
  return next;
}

interface Props { room: GameRoom }

export default function CheckersBoard({ room }: Props) {
  const [board, setBoard] = useState<Board>(initBoard);
  const [redNext, setRedNext] = useState(true);
  const [selected, setSelected] = useState<Pos | null>(null);

  const myId = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const myColor: Color = isHost ? "r" : "b";
  const currentColor: Color = redNext ? "r" : "b";
  const isMyTurn = currentColor === myColor;

  const allMoves = getAllMoves(board, currentColor);
  const gameOver = allMoves.length === 0;

  const legalTargets: Pos[] = selected
    ? allMoves
        .filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
        .map((m) => m.to)
    : [];

  // Reset on rematch
  useEffect(() => {
    setBoard(initBoard());
    setRedNext(true);
    setSelected(null);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (pending.length === 0) return;
    setBoard((prev) => {
      let next = prev;
      for (const move of pending) next = applyMove(next, move.payload as Move);
      return next;
    });
    if (pending.length % 2 !== 0) setRedNext((p) => !p);
    appliedRef.current = moves.length;
  }, [moves]);

  // Game over — current player has no moves, they lose
  useEffect(() => {
    if (!gameOver) return;
    if (useGameStore.getState().result) return;
    const loserIsHost = currentColor === "r";
    const winnerId = loserIsHost ? room.guestId : room.hostId;
    useGameStore.getState().setResult({ winnerId, reason: "no moves" });
  }, [gameOver, currentColor, room.hostId, room.guestId]);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (!isMyTurn || gameOver) return;

      if (selected) {
        const move = allMoves.find(
          (m) =>
            m.from[0] === selected[0] && m.from[1] === selected[1] &&
            m.to[0] === row && m.to[1] === col
        );
        if (move) {
          const next = applyMove(board, move);
          setBoard(next);
          setRedNext((p) => !p);
          setSelected(null);
          getSocket().emit("game:move", room.id, {
            playerId: myId ?? "",
            timestamp: Date.now(),
            payload: move,
          });
          return;
        }
      }

      const piece = board[row][col];
      const isMovable = piece?.color === myColor && allMoves.some(
        (m) => m.from[0] === row && m.from[1] === col
      );
      setSelected(isMovable ? [row, col] : null);
    },
    [isMyTurn, gameOver, board, selected, allMoves, myColor, myId, room.id]
  );

  const status = gameOver
    ? `${currentColor === "r" ? "Black" : "Red"} wins!`
    : isMyTurn ? "Your turn" : "Opponent's turn";

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-arena-text-muted">{status}</p>

      <div className="rounded-xl border-2 border-arena-border overflow-hidden shadow-lg">
        {Array.from({ length: SIZE }, (_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: SIZE }, (_, col) => {
              const isDark = (row + col) % 2 === 1;
              const piece = board[row][col];
              const isSel = selected?.[0] === row && selected?.[1] === col;
              const isTarget = legalTargets.some(([r, c]) => r === row && c === col);
              const isMovable =
                isMyTurn && !gameOver && piece?.color === myColor &&
                allMoves.some((m) => m.from[0] === row && m.from[1] === col);

              return (
                <button
                  key={col}
                  onClick={() => handleClick(row, col)}
                  className={cn(
                    "relative flex h-[60px] w-[60px] items-center justify-center",
                    isDark ? "bg-[#b58863]" : "bg-[#f0d9b5]",
                    isSel && "brightness-125",
                  )}
                >
                  {isTarget && !piece && (
                    <span className="absolute h-5 w-5 rounded-full bg-black/25 pointer-events-none" />
                  )}
                  {piece && (
                    <div className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-full shadow-md transition-transform",
                      piece.color === "r"
                        ? "bg-red-500 border-2 border-red-300"
                        : "bg-gray-900 border-2 border-gray-600",
                      isSel && "scale-110 ring-2 ring-yellow-400",
                      isMovable && !isSel && "hover:scale-105 cursor-pointer",
                      isTarget && piece && "ring-2 ring-yellow-400",
                    )}>
                      {piece.king && (
                        <span
                          className="text-xl leading-none select-none"
                          style={{ color: "#fff", WebkitTextStroke: "1px rgba(0,0,0,0.6)", paintOrder: "stroke fill" }}
                        >
                          ♛
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-sm text-arena-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          {isHost ? "You (Red)" : "Opponent (Red)"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-900 border border-gray-600" />
          {!isHost ? "You (Black)" : "Opponent (Black)"}
        </span>
      </div>
    </div>
  );
}
