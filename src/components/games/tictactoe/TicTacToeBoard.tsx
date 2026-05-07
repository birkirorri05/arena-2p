"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

type Mark = "X" | "O" | null;
type Board = Mark[];

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(board: Board): Mark {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

interface Props {
  room: GameRoom;
}

export default function TicTacToeBoard({ room }: Props) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const myId = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const myMark: Mark = isHost ? "X" : "O";
  const winner = checkWinner(board);
  const isDraw = !winner && board.every(Boolean);
  const isMyTurn = (xIsNext ? "X" : "O") === myMark;

  // Reset board when rematch swaps sides (hostId changes)
  useEffect(() => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming opponent moves in order
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (pending.length === 0) return;
    setBoard((prev) => {
      const next = [...prev];
      for (const move of pending) {
        const { idx, mark } = move.payload as { idx: number; mark: Mark };
        if (!next[idx]) next[idx] = mark;
      }
      return next;
    });
    if (pending.length % 2 !== 0) setXIsNext((p) => !p);
    appliedRef.current = moves.length;
  }, [moves]);

  // Show GameOverlay when the game ends
  useEffect(() => {
    if (!winner && !isDraw) return;
    if (useGameStore.getState().result) return;
    const opponentId = isHost ? room.guestId : room.hostId;
    const winnerId = winner ? (winner === myMark ? myId ?? null : opponentId) : null;
    useGameStore.getState().setResult({ winnerId, reason: winner ? "checkmate" : "draw" });
  }, [winner, isDraw, myMark, myId, isHost, room.guestId, room.hostId]);

  const handleClick = useCallback(
    (idx: number) => {
      if (room.status !== "playing" || !isMyTurn || board[idx] || winner) return;
      const next = [...board];
      next[idx] = myMark;
      setBoard(next);
      setXIsNext((p) => !p);
      getSocket().emit("game:move", room.id, {
        playerId: myId ?? "",
        timestamp: Date.now(),
        payload: { idx, mark: myMark },
      });
    },
    [isMyTurn, board, winner, myMark, myId, room.id, room.status]
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <p className="text-sm text-arena-text-muted">
        {winner
          ? `${winner} wins!`
          : isDraw
          ? "Draw!"
          : isMyTurn
          ? "Your turn"
          : "Opponent's turn"}
      </p>

      <div className="grid grid-cols-3 gap-2">
        {board.map((mark, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className={cn(
              "flex h-24 w-24 items-center justify-center rounded-lg border text-4xl font-bold transition-colors",
              mark === "X" && "text-arena-accent",
              mark === "O" && "text-pink-400",
              !mark && isMyTurn && !winner && "hover:bg-arena-surface cursor-pointer",
              "border-arena-border bg-arena-bg"
            )}
          >
            {mark}
          </button>
        ))}
      </div>
    </div>
  );
}
