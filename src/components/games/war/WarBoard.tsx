"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Card types ────────────────────────────────────────────────────────────────

const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"] as const;
const SUITS = ["♠","♥","♦","♣"] as const;
type Rank = typeof RANKS[number];
type Suit = typeof SUITS[number];
type Card = { rank: Rank; suit: Suit };

const RANK_VALUE: Record<Rank, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14,
};

function buildDeck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ rank, suit })));
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  let s = h >>> 0;
  const rand = () => { s = (Math.imul(1664525, s) + 1013904223) >>> 0; return s / 0x100000000; };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Game state ────────────────────────────────────────────────────────────────

interface WarState {
  p1Hand: Card[];
  p2Hand: Card[];
  warPile: Card[];
  lastP1: Card | null;
  lastP2: Card | null;
  lastResult: "p1" | "p2" | "war" | null;
  gameWinner: "p1" | "p2" | null;
}

function initState(seed: string): WarState {
  const deck = seededShuffle(buildDeck(), seed);
  return {
    p1Hand: deck.slice(0, 26),
    p2Hand: deck.slice(26),
    warPile: [],
    lastP1: null,
    lastP2: null,
    lastResult: null,
    gameWinner: null,
  };
}

function playRound(state: WarState): WarState {
  const { p1Hand, p2Hand, warPile } = state;
  if (!p1Hand.length) return { ...state, gameWinner: "p2" };
  if (!p2Hand.length) return { ...state, gameWinner: "p1" };

  const p1Card = p1Hand[0];
  const p2Card = p2Hand[0];
  let p1Rest = p1Hand.slice(1);
  let p2Rest = p2Hand.slice(1);

  const pot = [...warPile, p1Card, p2Card];
  const v1 = RANK_VALUE[p1Card.rank];
  const v2 = RANK_VALUE[p2Card.rank];

  if (v1 > v2) {
    const newHand = [...p1Rest, ...pot];
    return { p1Hand: newHand, p2Hand: p2Rest, warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "p1", gameWinner: p2Rest.length === 0 ? "p1" : null };
  }
  if (v2 > v1) {
    const newHand = [...p2Rest, ...pot];
    return { p1Hand: p1Rest, p2Hand: newHand, warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "p2", gameWinner: p1Rest.length === 0 ? "p2" : null };
  }

  // War — each player commits up to 3 face-down cards
  const bet = Math.min(3, p1Rest.length, p2Rest.length);
  const newPot = [...pot, ...p1Rest.slice(0, bet), ...p2Rest.slice(0, bet)];
  p1Rest = p1Rest.slice(bet);
  p2Rest = p2Rest.slice(bet);

  if (!p1Rest.length) return { p1Hand: [], p2Hand: [...p2Rest, ...newPot], warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: "p2" };
  if (!p2Rest.length) return { p1Hand: [...p1Rest, ...newPot], p2Hand: [], warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: "p1" };

  return { p1Hand: p1Rest, p2Hand: p2Rest, warPile: newPot, lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: null };
}

// ── Card component ────────────────────────────────────────────────────────────

function PlayingCard({ card, label }: { card: Card | null; label?: string }) {
  if (!card) {
    return (
      <div className="flex h-36 w-24 flex-col items-center justify-center rounded-xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-700 shadow-lg">
        <span className="text-slate-500 text-xs">{label ?? "?"}</span>
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="flex h-36 w-24 flex-col justify-between rounded-xl border-2 border-gray-200 bg-white p-2 shadow-lg select-none">
      <div className={cn("text-sm font-bold leading-tight", red ? "text-red-600" : "text-gray-900")}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
      <div className={cn("self-center text-4xl leading-none", red ? "text-red-600" : "text-gray-900")}>
        {card.suit}
      </div>
      <div className={cn("self-end rotate-180 text-sm font-bold leading-tight", red ? "text-red-600" : "text-gray-900")}>
        <div>{card.rank}</div>
        <div>{card.suit}</div>
      </div>
    </div>
  );
}

function CardBack() {
  return (
    <div className="flex h-36 w-24 items-center justify-center rounded-xl border-2 border-slate-600 bg-gradient-to-br from-blue-900 to-blue-800 shadow-lg">
      <div className="h-28 w-[72px] rounded-lg border border-blue-600 bg-[repeating-linear-gradient(45deg,#1e3a5f,#1e3a5f_2px,#1e40af_2px,#1e40af_8px)]" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { room: GameRoom }

export default function WarBoard({ room }: Props) {
  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);

  const isHost = room.hostId === myId;
  const [gs, setGs] = useState<WarState>(() => initState(room.id));

  // Reset on rematch
  useEffect(() => {
    setGs(initState(room.id));
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  // Apply incoming moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs((prev) => {
      let s = prev;
      for (let i = 0; i < pending.length; i++) s = playRound(s);
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves]);

  // Trigger game over overlay
  useEffect(() => {
    if (!gs.gameWinner || useGameStore.getState().result) return;
    const winnerId = gs.gameWinner === "p1" ? room.hostId : (room.playerIds[1] ?? null);
    useGameStore.getState().setResult({ winnerId, reason: "all cards captured" });
  }, [gs.gameWinner, room.hostId, room.playerIds]);

  // Host flips on even moves, guest on odd
  const isMyTurn = (moves.length % 2 === 0) === isHost;

  const handleFlip = useCallback(() => {
    if (room.status !== "playing" || !isMyTurn || gs.gameWinner) return;
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "",
      timestamp: Date.now(),
      payload: {},
    });
    setGs((prev) => playRound(prev));
    appliedRef.current += 1;
  }, [room.status, room.id, isMyTurn, myId, gs.gameWinner]);

  const p1Label = isHost ? "You" : "Opponent";
  const p2Label = isHost ? "Opponent" : "You";

  const statusText = gs.gameWinner
    ? (gs.gameWinner === "p1") === isHost ? "You win! 🎉" : "Opponent wins!"
    : gs.lastResult === "war" ? "⚔️  WAR!"
    : gs.lastResult === "p1" ? `${p1Label} wins the round`
    : gs.lastResult === "p2" ? `${p2Label} wins the round`
    : "Flip to battle!";

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <p className={cn(
        "text-sm font-semibold",
        gs.lastResult === "war" ? "text-yellow-400 text-lg animate-pulse" : "text-arena-text-muted"
      )}>
        {statusText}
      </p>

      {/* Battle area */}
      <div className="flex items-center gap-8">
        {/* P1 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-arena-text-muted">{p1Label}</span>
          <PlayingCard card={gs.lastP1} label="Not flipped" />
          <div className="flex items-center gap-1.5 text-xs text-arena-text-muted">
            <CardStack count={gs.p1Hand.length} />
            <span>{gs.p1Hand.length} cards</span>
          </div>
        </div>

        {/* VS / War pot */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-arena-text-muted">VS</span>
          {gs.warPile.length > 0 && (
            <span className="text-xs text-yellow-400 animate-pulse">
              ⚔️ {gs.warPile.length} at stake
            </span>
          )}
        </div>

        {/* P2 */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs text-arena-text-muted">{p2Label}</span>
          <PlayingCard card={gs.lastP2} label="Not flipped" />
          <div className="flex items-center gap-1.5 text-xs text-arena-text-muted">
            <CardStack count={gs.p2Hand.length} />
            <span>{gs.p2Hand.length} cards</span>
          </div>
        </div>
      </div>

      {/* Round counter */}
      <p className="text-xs text-arena-text-muted">Round {moves.length + 1}</p>

      {/* Flip button */}
      {!gs.gameWinner && room.status === "playing" && (
        <button
          onClick={handleFlip}
          disabled={!isMyTurn}
          className={cn(
            "rounded-xl px-10 py-3 text-base font-bold transition-all",
            isMyTurn
              ? "bg-arena-accent text-white hover:bg-arena-accent-hover active:scale-95 cursor-pointer"
              : "bg-arena-surface text-arena-text-muted cursor-not-allowed"
          )}
        >
          {isMyTurn ? "Flip!" : "Waiting…"}
        </button>
      )}
    </div>
  );
}

function CardStack({ count }: { count: number }) {
  const layers = Math.min(3, Math.ceil(count / 9));
  return (
    <span className="relative inline-flex h-4 w-4">
      {Array.from({ length: layers }, (_, i) => (
        <span
          key={i}
          className="absolute inset-0 rounded-sm border border-slate-600 bg-blue-900"
          style={{ transform: `translate(${-i}px, ${-i}px)` }}
        />
      ))}
    </span>
  );
}
