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

type PieceObj = { color: Color; king: boolean };

function pieceDirs(piece: PieceObj): number[][] {
  return piece.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "r" ? [[-1,-1],[-1,1]]
    : [[1,-1],[1,1]];
}

// Recursively find all terminal landing squares for multi-jump chains.
// Returns true if at least one further jump was found (used to determine
// whether to record this position as a terminal landing).
function findJumps(
  board: Board,
  piece: PieceObj,       // passed explicitly — never re-read from board
  origin: Pos,           // original square (for Move.from)
  r: number, c: number,  // current square
  captured: Pos[],
  results: Move[]
): boolean {
  let extended = false;
  for (const [dr, dc] of pieceDirs(piece)) {
    const mr = r + dr, mc = c + dc;   // square being captured
    const lr = r + dr * 2, lc = c + dc * 2; // landing square
    if (!inBounds(lr, lc)) continue;
    const mid = board[mr]?.[mc];
    if (!mid || mid.color === piece.color) continue;
    if (board[lr][lc]) continue;
    if (captured.some(([pr, pc]) => pr === mr && pc === mc)) continue;

    extended = true;
    const newCaptures: Pos[] = [...captured, [mr, mc]];

    // Simulate the jump; clear current square (not origin) so recursive
    // calls see the correct board state.
    const tmp: Board = board.map((row) => row.map((p) => (p ? { ...p } : null)));
    const landed: PieceObj = {
      ...piece,
      king: piece.king
        || (piece.color === "r" && lr === 0)
        || (piece.color === "b" && lr === SIZE - 1),
    };
    tmp[lr][lc] = landed;
    tmp[mr][mc] = null;
    tmp[r][c] = null; // ← clear current pos, not origin

    const wentFurther = findJumps(tmp, landed, origin, lr, lc, newCaptures, results);
    if (!wentFurther) {
      // Terminal — no further jumps from landing square
      results.push({ from: origin, to: [lr, lc], captures: newCaptures });
    }
  }
  return extended;
}

function getMoves(board: Board, row: number, col: number): Move[] {
  const piece = board[row][col];
  if (!piece) return [];

  const jumps: Move[] = [];
  findJumps(board, piece, [row, col], row, col, [], jumps);
  if (jumps.length > 0) return jumps;

  // Non-capture steps
  const steps: Move[] = [];
  for (const [dr, dc] of pieceDirs(piece)) {
    const nr = row + dr, nc = col + dc;
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
    const winnerId = loserIsHost ? room.playerIds[1] : room.hostId;
    useGameStore.getState().setResult({ winnerId, reason: "no moves" });
  }, [gameOver, currentColor, room.hostId, room.playerIds]);

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (room.status !== "playing" || !isMyTurn || gameOver) return;

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
    [isMyTurn, gameOver, board, selected, allMoves, myColor, myId, room.id, room.status]
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
