"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import { Chess } from "chess.js";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

type Square = string; // e.g. "e4"
type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";
type Color = "w" | "b";

// ︎ = Unicode text-presentation selector — forces monochrome text
// rendering instead of emoji on Windows/Android/iOS.
const T = "︎";
const PIECE_GLYPH: Record<PieceSymbol, string> = {
  k: `♚${T}`, q: `♛${T}`, r: `♜${T}`, b: `♝${T}`, n: `♞${T}`, p: `♟${T}`,
};

// Prefer symbol fonts so the OS emoji font doesn't override the glyph.
const PIECE_FONT = '"Segoe UI Symbol","Apple Symbols","FreeSerif",serif';
const OUTLINE = "-1px -1px 0 #1a1a1a, 1px -1px 0 #1a1a1a, -1px 1px 0 #1a1a1a, 1px 1px 0 #1a1a1a";
const WHITE_PIECE_STYLE: CSSProperties = {
  color: "#ffffff",
  fontFamily: PIECE_FONT,
  textShadow: `${OUTLINE}, 0 2px 6px rgba(0,0,0,0.4)`,
};
const BLACK_PIECE_STYLE: CSSProperties = {
  color: "#1a1a1a",
  fontFamily: PIECE_FONT,
  textShadow: "0 1px 3px rgba(0,0,0,0.35)",
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
      winnerId = loserIsHost ? room.playerIds[1] : room.hostId;
      reason = "checkmate";
    } else if (game.isResign?.()) {
      // handled by server
    }
    useGameStore.getState().setResult({ winnerId, reason });
  }, [game, room.hostId, room.playerIds]);

  const handleSquareClick = useCallback(
    (sq: Square) => {
      if (room.status !== "playing") return;
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
    [game, selected, legalTargets, myColor, promotion, room.status]
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
        <div className="flex flex-col pr-1">
          {displayRanks.map((r) => (
            <span key={r} className="flex h-[60px] w-4 items-center justify-center text-xs text-arena-text-muted">{r}</span>
          ))}
        </div>

        <div className="flex flex-col">
          <div className="grid grid-cols-8 border-2 border-arena-border">
            {displayRanks.map((rank) =>
              displayFiles.map((file) => {
                const sq = `${file}${rank}` as Square;
                const rankIdx = 8 - parseInt(rank);
                const fileIdx = FILES.indexOf(file);
                const piece = board[rankIdx][fileIdx];
                const isLight = (FILES.indexOf(file) + parseInt(rank)) % 2 === 0;
                const isSelected = selected === sq;
                const isTarget = legalTargets.includes(sq);
                const lastMove = game.history({ verbose: true }).slice(-1)[0];
                const isRecent = lastMove && (lastMove.from === sq || lastMove.to === sq);

                return (
                  <button
                    key={sq}
                    onClick={() => handleSquareClick(sq)}
                    className={cn(
                      "relative flex h-[60px] w-[60px] items-center justify-center transition-colors",
                      isLight ? "bg-[#f0d9b5]" : "bg-[#b58863]",
                      isSelected && "brightness-110 ring-3 ring-inset ring-yellow-400",
                      isRecent && !isSelected && "brightness-90",
                      isTarget && piece && "ring-3 ring-inset ring-red-500",
                    )}
                  >
                    {isTarget && !piece && (
                      <span className="absolute block h-5 w-5 rounded-full bg-black/25 pointer-events-none" />
                    )}
                    {piece && (
                      <span
                        className="select-none leading-none text-[42px]"
                        style={piece.color === "w" ? WHITE_PIECE_STYLE : BLACK_PIECE_STYLE}
                      >
                        {PIECE_GLYPH[piece.type]}
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
              <span key={f} className="w-[60px] text-center text-xs text-arena-text-muted">{f}</span>
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
              className="flex h-14 w-14 items-center justify-center rounded-lg border border-arena-border bg-arena-bg hover:bg-arena-surface"
            >
              <span
                className="text-[36px] leading-none select-none"
                style={myColor === "w" ? WHITE_PIECE_STYLE : BLACK_PIECE_STYLE}
              >
                {PIECE_GLYPH[p]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
