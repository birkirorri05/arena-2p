"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Chess } from "chess.js";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

type Square = string; // e.g. "e4"
type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";
type Color = "w" | "b";

const PIECE_UNICODE: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" },
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

interface Props {
  room: GameRoom;
}

export default function ChessBoard({ room }: Props) {
  const [game, setGame] = useState(() => new Chess());
  const [selected, setSelected] = useState<Square | null>(null);
  const [legalTargets, setLegalTargets] = useState<Square[]>([]);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);

  const myId = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const myColor: Color = isHost ? "w" : "b";

  // Reset on rematch
  useEffect(() => {
    setGame(new Chess());
    setSelected(null);
    setLegalTargets([]);
    setPromotion(null);
    appliedRef.current = 0;
  }, [room.hostId]);

  // Apply incoming opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (pending.length === 0) return;
    setGame((prev) => {
      const next = new Chess(prev.fen());
      for (const move of pending) {
        const { san } = move.payload as { san: string };
        try { next.move(san); } catch { /* ignore invalid */ }
      }
      return next;
    });
    appliedRef.current = moves.length;
  }, [moves]);

  // Notify store when game ends
  useEffect(() => {
    if (!game.isGameOver()) return;
    if (useGameStore.getState().result) return;
    let winnerId: string | null = null;
    let reason = "draw";
    if (game.isCheckmate()) {
      // The player whose turn it is lost
      const loserColor = game.turn();
      const loserIsHost = loserColor === "w";
      winnerId = loserIsHost ? room.guestId : room.hostId;
      reason = "checkmate";
    } else if (game.isResign?.()) {
      // handled by server
    }
    useGameStore.getState().setResult({ winnerId, reason });
  }, [game, room.hostId, room.guestId]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (game.isGameOver()) return;
      if (game.turn() !== myColor) return;

      // If a promotion dialog is open, ignore board clicks
      if (promotion) return;

      const piece = game.get(sq as any);

      if (selected) {
        if (legalTargets.includes(sq)) {
          // Check if this is a pawn promotion
          const movingPiece = game.get(selected as any);
          const isPromotion =
            movingPiece?.type === "p" &&
            ((myColor === "w" && sq[1] === "8") || (myColor === "b" && sq[1] === "1"));

          if (isPromotion) {
            setPromotion({ from: selected, to: sq });
            return;
          }

          applyMove(selected, sq);
        } else if (piece?.color === myColor) {
          selectSquare(sq);
        } else {
          setSelected(null);
          setLegalTargets([]);
        }
      } else {
        if (piece?.color === myColor) {
          selectSquare(sq);
        }
      }
    },
    [game, selected, legalTargets, myColor, promotion]
  );

  function selectSquare(sq: Square) {
    setSelected(sq);
    const targets = game.moves({ square: sq as any, verbose: true }).map((m) => m.to);
    setLegalTargets(targets);
  }

  function applyMove(from: Square, to: Square, promotionPiece?: PieceSymbol) {
    const result = game.move({ from: from as any, to: to as any, promotion: promotionPiece ?? "q" });
    if (!result) return;
    setGame(new Chess(game.fen()));
    setSelected(null);
    setLegalTargets([]);
    setPromotion(null);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "",
      timestamp: Date.now(),
      payload: { san: result.san },
    });
  }

  const board = game.board();
  const isMyTurn = game.turn() === myColor && !game.isGameOver();
  const status = game.isCheckmate()
    ? `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`
    : game.isDraw()
    ? "Draw"
    : game.isCheck()
    ? `${game.turn() === "w" ? "White" : "Black"} is in check`
    : isMyTurn
    ? "Your turn"
    : "Opponent's turn";

  // Flip board for black
  const displayRanks = myColor === "b" ? [...RANKS].reverse() : RANKS;
  const displayFiles = myColor === "b" ? [...FILES].reverse() : FILES;

  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-sm text-arena-text-muted">{status}</p>

      <div className="flex">
        {/* Rank labels */}
        <div className="flex flex-col justify-around pr-1">
          {displayRanks.map((r) => (
            <span key={r} className="text-xs text-arena-text-muted w-3 text-center">{r}</span>
          ))}
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-8 border border-arena-border">
            {displayRanks.map((rank) =>
              displayFiles.map((file) => {
                const sq = `${file}${rank}` as Square;
                const rankIdx = 8 - parseInt(rank);
                const fileIdx = FILES.indexOf(file);
                const piece = board[rankIdx][fileIdx];
                const isLight = (FILES.indexOf(file) + parseInt(rank)) % 2 === 0;
                const isSelected = selected === sq;
                const isTarget = legalTargets.includes(sq);
                const isLastMove = game.history({ verbose: true }).slice(-1)[0];
                const isRecent = isLastMove && (isLastMove.from === sq || isLastMove.to === sq);

                return (
                  <button
                    key={sq}
                    onClick={() => handleSquareClick(sq)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center text-2xl transition-colors",
                      isLight ? "bg-amber-100" : "bg-amber-800",
                      isSelected && "ring-2 ring-inset ring-yellow-400",
                      isRecent && !isSelected && "bg-yellow-300/40",
                      isTarget && piece && "ring-2 ring-inset ring-red-400",
                      isTarget && !piece && "after:content-[''] after:block after:w-3 after:h-3 after:rounded-full after:bg-black/25",
                    )}
                  >
                    {piece && (
                      <span className={cn(
                        "select-none leading-none",
                        piece.color === "w" ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : "text-gray-900"
                      )}>
                        {PIECE_UNICODE[piece.color][piece.type]}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* File labels */}
          <div className="flex">
            {displayFiles.map((f) => (
              <span key={f} className="w-10 text-center text-xs text-arena-text-muted">{f}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Promotion picker */}
      {promotion && (
        <div className="flex items-center gap-2 rounded-xl border border-arena-border bg-arena-surface p-3">
          <span className="text-sm text-arena-text-muted mr-1">Promote to:</span>
          {(["q", "r", "b", "n"] as PieceSymbol[]).map((p) => (
            <button
              key={p}
              onClick={() => applyMove(promotion.from, promotion.to, p)}
              className="flex h-12 w-12 items-center justify-center rounded-lg border border-arena-border bg-arena-bg text-3xl hover:bg-arena-surface"
            >
              <span className={cn(
                myColor === "w" ? "text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]" : "text-gray-900"
              )}>
                {PIECE_UNICODE[myColor][p]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
