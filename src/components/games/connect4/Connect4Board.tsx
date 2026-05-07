"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

const ROWS = 6;
const COLS = 7;

type Cell = "r" | "y" | null; // red = host, yellow = guest
type Board = Cell[][];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function dropPiece(board: Board, col: number, color: Cell): Board | null {
  for (let row = ROWS - 1; row >= 0; row--) {
    if (!board[row][col]) {
      const next = board.map((r) => [...r]);
      next[row][col] = color;
      return next;
    }
  }
  return null; // column full
}

function checkWinner(board: Board): Cell {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of directions) {
        let count = 1;
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) break;
          count++;
        }
        if (count === 4) return cell;
      }
    }
  }
  return null;
}

function getWinningCells(board: Board): [number, number][] {
  const directions = [
    [0, 1], [1, 0], [1, 1], [1, -1],
  ];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of directions) {
        const line: [number, number][] = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || board[nr][nc] !== cell) break;
          line.push([nr, nc]);
        }
        if (line.length === 4) return line;
      }
    }
  }
  return [];
}

interface Props {
  room: GameRoom;
}

export default function Connect4Board({ room }: Props) {
  const [board, setBoard] = useState<Board>(emptyBoard);
  const [redNext, setRedNext] = useState(true); // red (host) goes first

  const myId = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const myColor: Cell = isHost ? "r" : "y";
  const winner = checkWinner(board);
  const isDraw = !winner && board[0].every(Boolean);
  const isMyTurn = (redNext ? "r" : "y") === myColor;
  const winLine = winner ? getWinningCells(board) : [];

  // Reset on rematch
  useEffect(() => {
    setBoard(emptyBoard());
    setRedNext(true);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (pending.length === 0) return;
    setBoard((prev) => {
      let next = prev;
      for (const move of pending) {
        const { col, color } = move.payload as { col: number; color: Cell };
        next = dropPiece(next, col, color) ?? next;
      }
      return next;
    });
    if (pending.length % 2 !== 0) setRedNext((p) => !p);
    appliedRef.current = moves.length;
  }, [moves]);

  // Trigger GameOverlay on win/draw
  useEffect(() => {
    if (!winner && !isDraw) return;
    if (useGameStore.getState().result) return;
    const opponentId = isHost ? room.playerIds[1] : room.hostId;
    const winnerId = winner
      ? (winner === myColor ? myId ?? null : opponentId)
      : null;
    useGameStore.getState().setResult({ winnerId, reason: winner ? "connect4" : "draw" });
  }, [winner, isDraw, myColor, myId, isHost, room.playerIds, room.hostId]);

  const handleColClick = useCallback(
    (col: number) => {
      if (room.status !== "playing" || !isMyTurn || winner || isDraw) return;
      const next = dropPiece(board, col, myColor);
      if (!next) return; // column full
      setBoard(next);
      setRedNext((p) => !p);
      getSocket().emit("game:move", room.id, {
        playerId: myId ?? "",
        timestamp: Date.now(),
        payload: { col, color: myColor },
      });
    },
    [isMyTurn, board, winner, isDraw, myColor, myId, room.id, room.status]
  );

  const status = winner
    ? `${winner === "r" ? "Red" : "Yellow"} wins!`
    : isDraw
    ? "Draw!"
    : isMyTurn
    ? "Your turn"
    : "Opponent's turn";

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-arena-text-muted">{status}</p>

      {/* Board — click any cell in a column to drop */}
      <div className="rounded-xl bg-blue-700 p-2 shadow-lg group/board">
        <div className="flex gap-1.5">
          {Array.from({ length: COLS }, (_, col) => {
            const canDrop = isMyTurn && !winner && !isDraw && board[0][col] === null;
            return (
              <button
                key={col}
                onClick={() => handleColClick(col)}
                disabled={!canDrop}
                className={cn(
                  "flex flex-col gap-1.5 rounded-lg p-0",
                  canDrop ? "cursor-pointer hover:brightness-125" : "cursor-default"
                )}
              >
                {Array.from({ length: ROWS }, (_, row) => {
                  const cell = board[row][col];
                  const isWinCell = winLine.some(([r, c]) => r === row && c === col);
                  return (
                    <div
                      key={row}
                      className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-900"
                    >
                      <div
                        className={cn(
                          "h-10 w-10 rounded-full transition-all duration-150",
                          !cell && "bg-blue-950",
                          cell === "r" && "bg-red-500",
                          cell === "y" && "bg-yellow-400",
                          isWinCell && "ring-4 ring-white scale-110"
                        )}
                      />
                    </div>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-arena-text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          {isHost ? "You (Red)" : "Opponent (Red)"}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-yellow-400" />
          {!isHost ? "You (Yellow)" : "Opponent (Yellow)"}
        </span>
      </div>
    </div>
  );
}
