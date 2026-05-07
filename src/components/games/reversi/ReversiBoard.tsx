"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

const SIZE = 8;
const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

type Color = "b" | "w"; // black = host, white = guest
type Cell = Color | null;
type Board = Cell[][];

function initBoard(): Board {
  const b: Board = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  b[3][3] = "w"; b[3][4] = "b";
  b[4][3] = "b"; b[4][4] = "w";
  return b;
}

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

// Returns the list of cells that would be flipped by placing `color` at (row,col).
function getFlips(board: Board, row: number, col: number, color: Color): [number, number][] {
  if (board[row][col]) return [];
  const opp: Color = color === "b" ? "w" : "b";
  const flips: [number, number][] = [];

  for (const [dr, dc] of DIRS) {
    const line: [number, number][] = [];
    let r = row + dr, c = col + dc;
    while (inBounds(r, c) && board[r][c] === opp) {
      line.push([r, c]);
      r += dr; c += dc;
    }
    if (line.length > 0 && inBounds(r, c) && board[r][c] === color) {
      flips.push(...line);
    }
  }
  return flips;
}

function getLegalMoves(board: Board, color: Color): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!board[r][c] && getFlips(board, r, c, color).length > 0)
        moves.push([r, c]);
  return moves;
}

function applyMove(board: Board, row: number, col: number, color: Color): Board {
  const flips = getFlips(board, row, col, color);
  const next = board.map((r) => [...r]) as Board;
  next[row][col] = color;
  for (const [r, c] of flips) next[r][c] = color;
  return next;
}

function countPieces(board: Board): { b: number; w: number } {
  let b = 0, w = 0;
  for (const row of board) for (const cell of row) {
    if (cell === "b") b++;
    if (cell === "w") w++;
  }
  return { b, w };
}

interface Props { room: GameRoom }

export default function ReversiBoard({ room }: Props) {
  const [board, setBoard] = useState<Board>(initBoard);
  const [blackNext, setBlackNext] = useState(true); // black always goes first
  const [passed, setPassed] = useState(false); // did previous player pass?

  const myId = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const myColor: Color = isHost ? "b" : "w";
  const currentColor: Color = blackNext ? "b" : "w";
  const isMyTurn = currentColor === myColor;

  const legalMoves = getLegalMoves(board, currentColor);
  const myLegalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));

  const counts = countPieces(board);
  const totalCells = SIZE * SIZE;
  const boardFull = counts.b + counts.w === totalCells;

  // Game over: board full, or both players had to pass consecutively
  const opponentMoves = getLegalMoves(board, currentColor === "b" ? "w" : "b");
  const gameOver = boardFull || (legalMoves.length === 0 && opponentMoves.length === 0);

  // Reset on rematch
  useEffect(() => {
    setBoard(initBoard());
    setBlackNext(true);
    setPassed(false);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (pending.length === 0) return;
    let anyPass = false;
    setBoard((prev) => {
      let next = prev;
      for (const move of pending) {
        const p = move.payload as { row?: number; col?: number; color?: Color };
        // Skip moves with an invalid payload (e.g. stale moves from another game)
        if (typeof p?.row !== "number" || typeof p?.col !== "number" || !p?.color) continue;
        if (p.row === -1) { anyPass = true; continue; }
        next = applyMove(next, p.row, p.col, p.color);
      }
      return next;
    });
    if (pending.length % 2 !== 0) setBlackNext((p) => !p);
    setPassed(anyPass);
    appliedRef.current = moves.length;
  }, [moves]);

  // Trigger GameOverlay
  useEffect(() => {
    if (!gameOver) return;
    if (useGameStore.getState().result) return;
    let winnerId: string | null = null;
    if (counts.b !== counts.w) {
      const winnerColor: Color = counts.b > counts.w ? "b" : "w";
      winnerId = winnerColor === "b" ? room.hostId : (room.guestId ?? null);
    }
    useGameStore.getState().setResult({ winnerId, reason: "most pieces" });
  }, [gameOver, counts.b, counts.w, room.hostId, room.guestId]);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (room.status !== "playing" || !isMyTurn || gameOver) return;
      if (!myLegalSet.has(`${row},${col}`)) return;

      const next = applyMove(board, row, col, myColor);
      setBoard(next);
      setBlackNext((p) => !p);
      setPassed(false);
      getSocket().emit("game:move", room.id, {
        playerId: myId ?? "",
        timestamp: Date.now(),
        payload: { row, col, color: myColor },
      });
    },
    [isMyTurn, gameOver, board, myColor, myLegalSet, myId, room.id, room.status]
  );

  const handlePass = useCallback(() => {
    if (room.status !== "playing" || !isMyTurn || gameOver || legalMoves.length > 0) return;
    setBlackNext((p) => !p);
    setPassed(true);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "",
      timestamp: Date.now(),
      payload: { row: -1, col: -1, color: myColor },
    });
  }, [isMyTurn, gameOver, legalMoves.length, myId, room.id, room.status]);

  const status = gameOver
    ? counts.b === counts.w
      ? "Draw!"
      : `${counts.b > counts.w ? "Black" : "White"} wins!`
    : isMyTurn && legalMoves.length === 0
    ? "No moves — you must pass"
    : isMyTurn
    ? "Your turn"
    : passed
    ? "Opponent passed — your turn"
    : "Opponent's turn";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Score bar */}
      <div className="flex items-center gap-6 text-sm">
        <span className={cn(
          "flex items-center gap-2 font-semibold",
          isHost && isMyTurn && !gameOver ? "text-arena-text" : "text-arena-text-muted"
        )}>
          <span className="inline-block h-4 w-4 rounded-full bg-gray-900 border border-gray-600 shadow" />
          {isHost ? "You" : "Opponent"} (Black) — {counts.b}
        </span>
        <span className="text-arena-text-muted">·</span>
        <span className={cn(
          "flex items-center gap-2 font-semibold",
          !isHost && isMyTurn && !gameOver ? "text-arena-text" : "text-arena-text-muted"
        )}>
          <span className="inline-block h-4 w-4 rounded-full bg-white border border-gray-300 shadow" />
          {!isHost ? "You" : "Opponent"} (White) — {counts.w}
        </span>
      </div>

      <p className="text-sm text-arena-text-muted">{status}</p>

      {/* Board */}
      <div className="rounded-xl overflow-hidden border-2 border-arena-border shadow-lg bg-[#1a6b3c]">
        <div
          className="grid gap-px bg-black/30 p-px"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
        >
          {Array.from({ length: SIZE }, (_, row) =>
            Array.from({ length: SIZE }, (_, col) => {
              const cell = board[row][col];
              const isLegal = isMyTurn && myLegalSet.has(`${row},${col}`);

              return (
                <button
                  key={`${row}-${col}`}
                  onClick={() => handleClick(row, col)}
                  className={cn(
                    "relative flex h-[60px] w-[60px] items-center justify-center bg-[#1a6b3c] transition-colors",
                    isLegal && "hover:bg-[#1f7d46] cursor-pointer",
                  )}
                >
                  {/* Legal move hint dot */}
                  {isLegal && !cell && (
                    <span className="absolute h-4 w-4 rounded-full bg-white/30 pointer-events-none" />
                  )}

                  {/* Piece */}
                  {cell && (
                    <div className={cn(
                      "h-11 w-11 rounded-full shadow-md transition-transform duration-150",
                      cell === "b"
                        ? "bg-gray-900 border-2 border-gray-700"
                        : "bg-white border-2 border-gray-200",
                    )} />
                  )}

                  {/* Capture preview ring on opponent pieces */}
                  {isLegal && cell && (
                    <div className="absolute inset-0 rounded-full ring-2 ring-yellow-400/70 pointer-events-none" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Pass button */}
      {isMyTurn && !gameOver && legalMoves.length === 0 && (
        <button
          onClick={handlePass}
          className="rounded-lg border border-arena-border bg-arena-surface px-4 py-2 text-sm text-arena-text hover:bg-arena-bg transition-colors"
        >
          Pass turn
        </button>
      )}
    </div>
  );
}
