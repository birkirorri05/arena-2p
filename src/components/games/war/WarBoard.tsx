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

// ── Game logic ────────────────────────────────────────────────────────────────

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
  return { p1Hand: deck.slice(0, 26), p2Hand: deck.slice(26), warPile: [], lastP1: null, lastP2: null, lastResult: null, gameWinner: null };
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
  const v1 = RANK_VALUE[p1Card.rank], v2 = RANK_VALUE[p2Card.rank];

  if (v1 > v2) {
    return { p1Hand: [...p1Rest, ...pot], p2Hand: p2Rest, warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "p1", gameWinner: p2Rest.length === 0 ? "p1" : null };
  }
  if (v2 > v1) {
    return { p1Hand: p1Rest, p2Hand: [...p2Rest, ...pot], warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "p2", gameWinner: p1Rest.length === 0 ? "p2" : null };
  }

  // Tie — each player commits up to 3 face-down cards to the war pile
  const bet = Math.min(3, p1Rest.length, p2Rest.length);
  const newPot = [...pot, ...p1Rest.slice(0, bet), ...p2Rest.slice(0, bet)];
  p1Rest = p1Rest.slice(bet);
  p2Rest = p2Rest.slice(bet);

  if (!p1Rest.length) return { p1Hand: [], p2Hand: [...p2Rest, ...newPot], warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: "p2" };
  if (!p2Rest.length) return { p1Hand: [...p1Rest, ...newPot], p2Hand: [], warPile: [], lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: "p1" };
  return { p1Hand: p1Rest, p2Hand: p2Rest, warPile: newPot, lastP1: p1Card, lastP2: p2Card, lastResult: "war", gameWinner: null };
}

// ── Card visuals ──────────────────────────────────────────────────────────────

function PlayingCard({ card }: { card: Card | null }) {
  if (!card) {
    return (
      <div className="flex h-36 w-24 items-center justify-center rounded-xl border-2 border-slate-600 bg-gradient-to-br from-slate-800 to-slate-700 shadow-lg">
        <span className="text-3xl text-slate-600 select-none">?</span>
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className="flex h-36 w-24 flex-col justify-between rounded-xl border-2 border-gray-200 bg-white p-2 shadow-lg select-none">
      <div className={cn("text-sm font-bold leading-tight", red ? "text-red-600" : "text-gray-900")}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      <div className={cn("self-center text-4xl leading-none", red ? "text-red-600" : "text-gray-900")}>
        {card.suit}
      </div>
      <div className={cn("self-end rotate-180 text-sm font-bold leading-tight", red ? "text-red-600" : "text-gray-900")}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
    </div>
  );
}

function DeckPile({ count }: { count: number }) {
  if (count === 0) return <div className="h-36 w-24 rounded-xl border-2 border-dashed border-slate-700 opacity-30" />;
  const layers = Math.min(4, Math.ceil(count / 7));
  return (
    <div className="relative h-36 w-24">
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0 rounded-xl border-2 border-slate-600 bg-gradient-to-br from-blue-900 to-blue-800"
          style={{ transform: `translate(${(layers - 1 - i) * -2}px, ${(layers - 1 - i) * -2}px)` }}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WarBoard({ room }: { room: GameRoom }) {
  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);

  // appliedRef tracks ONLY incoming opponent moves from the moves[] array.
  // myFlips tracks MY OWN flips separately.
  // This keeps them from interfering with each other.
  const appliedRef = useRef(0);
  const [myFlips, setMyFlips] = useState(0);
  const [gs, setGs] = useState<WarState>(() => initState(room.id));

  const isHost = room.hostId === myId;

  // Reset on rematch
  useEffect(() => {
    setGs(initState(room.id));
    setMyFlips(0);
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  // Apply incoming opponent moves (appliedRef tracks only this array)
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

  // Trigger game over overlay when either client detects a winner
  useEffect(() => {
    if (!gs.gameWinner || useGameStore.getState().result) return;
    const winnerId = gs.gameWinner === "p1" ? room.hostId : (room.playerIds[1] ?? null);
    useGameStore.getState().setResult({ winnerId, reason: "all cards captured" });
  }, [gs.gameWinner, room.hostId, room.playerIds]);

  // Turn order: host flips on even total rounds, guest on odd.
  // totalRounds = my flips + opponent's flips (= moves.length).
  const totalRounds = myFlips + moves.length;
  const isMyTurn = isHost ? totalRounds % 2 === 0 : totalRounds % 2 === 1;

  const handleFlip = useCallback(() => {
    if (room.status !== "playing" || !isMyTurn || gs.gameWinner) return;
    // Apply locally immediately, then tell the opponent
    setGs((prev) => playRound(prev));
    setMyFlips((n) => n + 1);
    getSocket().emit("game:move", room.id, {
      playerId: myId ?? "",
      timestamp: Date.now(),
      payload: {},
    });
  }, [room.status, room.id, isMyTurn, myId, gs.gameWinner]);

  const myLabel  = isHost ? "You (P1)" : "You (P2)";
  const oppLabel = isHost ? "Opponent (P2)" : "Opponent (P1)";
  const myCard   = isHost ? gs.lastP1 : gs.lastP2;
  const oppCard  = isHost ? gs.lastP2 : gs.lastP1;
  const myCount  = isHost ? gs.p1Hand.length : gs.p2Hand.length;
  const oppCount = isHost ? gs.p2Hand.length : gs.p1Hand.length;

  const myWonRound   = gs.lastResult === (isHost ? "p1" : "p2");
  const oppWonRound  = gs.lastResult === (isHost ? "p2" : "p1");

  const statusText = gs.gameWinner
    ? (gs.gameWinner === "p1") === isHost ? "You win! 🎉" : "Opponent wins!"
    : gs.lastResult === "war" ? "⚔️  WAR! Flip again to resolve"
    : myWonRound   ? "You win the round!"
    : oppWonRound  ? "Opponent wins the round"
    : "Flip to battle!";

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Status */}
      <p className={cn(
        "min-h-[1.5rem] text-sm font-semibold transition-all",
        gs.lastResult === "war"  && "text-yellow-400 text-base animate-pulse",
        myWonRound               && "text-green-400",
        oppWonRound              && "text-red-400",
        !gs.lastResult           && "text-arena-text-muted",
        gs.gameWinner            && "text-lg",
      )}>
        {statusText}
      </p>

      {/* Battle area */}
      <div className="flex items-end gap-6">
        {/* My side */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-arena-text-muted">{myLabel}</span>
          <div className="relative">
            <PlayingCard card={myCard} />
            {myWonRound && (
              <span className="absolute -top-2 -right-2 rounded-full bg-green-500 px-1.5 py-0.5 text-[10px] font-bold text-white">WIN</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <DeckPile count={myCount} />
          </div>
          <span className="text-xs text-arena-text-muted">{myCount} cards</span>
        </div>

        {/* Center */}
        <div className="flex flex-col items-center gap-2 pb-10">
          <span className="text-xl font-bold text-arena-text-muted">VS</span>
          {gs.warPile.length > 0 && (
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-center">
              <p className="text-xs font-bold text-yellow-400">⚔️ WAR</p>
              <p className="text-xs text-yellow-400/70">{gs.warPile.length} at stake</p>
            </div>
          )}
        </div>

        {/* Opponent side */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium text-arena-text-muted">{oppLabel}</span>
          <div className="relative">
            <PlayingCard card={oppCard} />
            {oppWonRound && (
              <span className="absolute -top-2 -right-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">WIN</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <DeckPile count={oppCount} />
          </div>
          <span className="text-xs text-arena-text-muted">{oppCount} cards</span>
        </div>
      </div>

      {/* Round counter */}
      <p className="text-xs text-arena-text-muted">Round {totalRounds + 1}</p>

      {/* Flip button */}
      {!gs.gameWinner && room.status === "playing" && (
        <button
          onClick={handleFlip}
          disabled={!isMyTurn}
          className={cn(
            "rounded-xl px-12 py-3 text-base font-bold transition-all",
            isMyTurn
              ? "bg-arena-accent text-white hover:bg-arena-accent-hover active:scale-95 cursor-pointer shadow-lg"
              : "bg-arena-surface text-arena-text-muted cursor-not-allowed opacity-60"
          )}
        >
          {isMyTurn ? "Flip!" : "Opponent's turn…"}
        </button>
      )}
    </div>
  );
}
