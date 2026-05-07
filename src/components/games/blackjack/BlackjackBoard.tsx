"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Card types ────────────────────────────────────────────────────────────────

const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"] as const;
const SUITS = ["♠","♥","♦","♣"] as const;
type Rank = typeof RANKS[number];
type Suit = typeof SUITS[number];
type Card = { rank: Rank; suit: Suit };

function buildDeck(): Card[] {
  return SUITS.flatMap(s => RANKS.map(r => ({ rank: r, suit: s })));
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

function handValue(cards: Card[]): number {
  let total = 0, aces = 0;
  for (const { rank } of cards) {
    if (rank === "A") { aces++; total += 11; }
    else if (rank === "J" || rank === "Q" || rank === "K") total += 10;
    else total += parseInt(rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards) === 21;
}

// ── Game state ────────────────────────────────────────────────────────────────

type PlayerStatus = "playing" | "standing" | "busted" | "doubled";
type RoundResult = "win" | "lose" | "push" | "blackjack";

interface BJState {
  seedBase: string;
  round: number;
  deck: Card[];
  dealerHand: Card[];
  dealerRevealed: boolean;
  playerHands: Record<string, Card[]>;
  playerStatus: Record<string, PlayerStatus>;
  currentPlayerIdx: number;
  phase: "waiting" | "playing" | "finished";
  results: Record<string, RoundResult>;
}

type BJPayload =
  | { type: "deal"; ts: number }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "double" };

function initState(roomId: string): BJState {
  return { seedBase: roomId, round: 0, deck: [], dealerHand: [], dealerRevealed: false, playerHands: {}, playerStatus: {}, currentPlayerIdx: 0, phase: "waiting", results: {} };
}

function computeResults(hands: Record<string, Card[]>, statuses: Record<string, PlayerStatus>, dealerHand: Card[], playerIds: string[]): Record<string, RoundResult> {
  const dv = handValue(dealerHand);
  const dBJ = isBlackjack(dealerHand);
  const out: Record<string, RoundResult> = {};
  for (const id of playerIds) {
    const pv = handValue(hands[id]);
    const pBJ = isBlackjack(hands[id]);
    if (statuses[id] === "busted") out[id] = "lose";
    else if (pBJ && dBJ)  out[id] = "push";
    else if (pBJ)          out[id] = "blackjack";
    else if (dBJ)          out[id] = "lose";
    else if (dv > 21)      out[id] = "win";
    else if (pv > dv)      out[id] = "win";
    else if (pv < dv)      out[id] = "lose";
    else                   out[id] = "push";
  }
  return out;
}

function runDealer(state: BJState, playerIds: string[]): BJState {
  const allBusted = playerIds.every(id => state.playerStatus[id] === "busted");
  let hand = [...state.dealerHand];
  let deck = [...state.deck];
  if (!allBusted) {
    while (handValue(hand) < 17 && deck.length > 0) hand.push(deck.shift()!);
  }
  return { ...state, deck, dealerHand: hand, dealerRevealed: true, phase: "finished", results: computeResults(state.playerHands, state.playerStatus, hand, playerIds) };
}

function advance(state: BJState, playerIds: string[]): BJState {
  if (state.phase === "playing" && state.currentPlayerIdx >= playerIds.length)
    return runDealer(state, playerIds);
  return state;
}

function applyMove(state: BJState, payload: BJPayload, playerIds: string[]): BJState {
  if (payload.type === "deal") {
    if (state.phase !== "waiting" && state.phase !== "finished") return state;
    const round = state.round + 1;
    const deck = seededShuffle(buildDeck(), `${state.seedBase}:${payload.ts}`);
    let di = 0;
    const hands: Record<string, Card[]> = {};
    const statuses: Record<string, PlayerStatus> = {};
    for (const id of playerIds) hands[id] = [];
    // deal round 1
    for (const id of playerIds) hands[id].push(deck[di++]);
    const d1 = deck[di++];
    // deal round 2
    for (const id of playerIds) hands[id].push(deck[di++]);
    const d2 = deck[di++];
    // mark statuses
    for (const id of playerIds) statuses[id] = handValue(hands[id]) === 21 ? "standing" : "playing";
    const firstActive = playerIds.findIndex(id => statuses[id] === "playing");
    const startIdx = firstActive === -1 ? playerIds.length : firstActive;
    const next: BJState = { ...state, round, deck: deck.slice(di), dealerHand: [d1, d2], dealerRevealed: false, playerHands: hands, playerStatus: statuses, currentPlayerIdx: startIdx, phase: "playing", results: {} };
    return advance(next, playerIds);
  }

  if (state.phase !== "playing") return state;
  const idx = state.currentPlayerIdx;
  const id = playerIds[idx];
  if (!id) return state;

  if (payload.type === "hit") {
    const card = state.deck[0];
    if (!card) return state;
    const hand = [...state.playerHands[id], card];
    const val = handValue(hand);
    const bust = val > 21;
    const next: BJState = { ...state, deck: state.deck.slice(1), playerHands: { ...state.playerHands, [id]: hand }, playerStatus: { ...state.playerStatus, [id]: bust ? "busted" : "playing" }, currentPlayerIdx: (bust || val === 21) ? idx + 1 : idx };
    return advance(next, playerIds);
  }

  if (payload.type === "stand") {
    const next: BJState = { ...state, playerStatus: { ...state.playerStatus, [id]: "standing" }, currentPlayerIdx: idx + 1 };
    return advance(next, playerIds);
  }

  if (payload.type === "double") {
    const card = state.deck[0];
    if (!card) return state;
    const hand = [...state.playerHands[id], card];
    const val = handValue(hand);
    const next: BJState = { ...state, deck: state.deck.slice(1), playerHands: { ...state.playerHands, [id]: hand }, playerStatus: { ...state.playerStatus, [id]: val > 21 ? "busted" : "doubled" }, currentPlayerIdx: idx + 1 };
    return advance(next, playerIds);
  }

  return state;
}

// ── Card visuals ──────────────────────────────────────────────────────────────

function Card({ card, small = false }: { card: Card; small?: boolean }) {
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className={cn("flex flex-col justify-between rounded-lg border-2 border-gray-200 bg-white shadow select-none", small ? "h-20 w-14 p-1" : "h-28 w-20 p-1.5")}>
      <div className={cn("font-bold leading-tight", red ? "text-red-600" : "text-gray-900", small ? "text-xs" : "text-sm")}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      <div className={cn("self-center leading-none", red ? "text-red-600" : "text-gray-900", small ? "text-2xl" : "text-3xl")}>{card.suit}</div>
      <div className={cn("self-end rotate-180 font-bold leading-tight", red ? "text-red-600" : "text-gray-900", small ? "text-xs" : "text-sm")}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
    </div>
  );
}

function CardBack({ small = false }: { small?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center rounded-lg border-2 border-blue-600 bg-gradient-to-br from-blue-900 to-blue-800 shadow", small ? "h-20 w-14" : "h-28 w-20")}>
      <div className={cn("rounded border border-blue-500 bg-[repeating-linear-gradient(45deg,#1e3a5f,#1e3a5f_2px,#1e40af_2px,#1e40af_6px)]", small ? "h-16 w-10" : "h-24 w-16")} />
    </div>
  );
}

function HandRow({ cards, hidden = false, small = false }: { cards: Card[]; hidden?: boolean; small?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      {cards.map((c, i) =>
        hidden && i === 1
          ? <CardBack key={i} small={small} />
          : <Card key={i} card={c} small={small} />
      )}
    </div>
  );
}

const RESULT_LABEL: Record<RoundResult, { text: string; cls: string }> = {
  blackjack: { text: "Blackjack! 🃏", cls: "text-yellow-400 font-bold" },
  win:        { text: "Win ✓",         cls: "text-green-400 font-semibold" },
  push:       { text: "Push",          cls: "text-arena-text-muted" },
  lose:       { text: "Lose ✗",        cls: "text-red-400 font-semibold" },
};

// ── Main component ────────────────────────────────────────────────────────────

export default function BlackjackBoard({ room }: { room: GameRoom }) {
  const myId  = useGameStore((s) => s.myPlayerId);
  const moves = useGameStore((s) => s.moves);
  const appliedRef = useRef(0);
  const [myActionCount, setMyActionCount] = useState(0);
  const [gs, setGs] = useState<BJState>(() => initState(room.id));
  const players = useGameStore((s) => s.players);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;
  const myIdx = playerIds.indexOf(myId ?? "");

  // Reset on rematch / room change
  useEffect(() => {
    setGs(initState(room.id));
    setMyActionCount(0);
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  // Apply incoming opponent moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyMove(s, m.payload as BJPayload, playerIds);
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  function emit(payload: BJPayload) {
    setGs(prev => applyMove(prev, payload, playerIds));
    setMyActionCount(n => n + 1);
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }

  const handleDeal   = useCallback(() => { if (room.status !== "playing" || !isHost) return; emit({ type: "deal", ts: Date.now() }); }, [room.status, isHost, gs.phase]);
  const handleHit    = useCallback(() => { if (!isMyTurn) return; emit({ type: "hit" }); },    [gs, myId, playerIds]);
  const handleStand  = useCallback(() => { if (!isMyTurn) return; emit({ type: "stand" }); },  [gs, myId, playerIds]);
  const handleDouble = useCallback(() => {
    if (!isMyTurn) return;
    const myHand = gs.playerHands[myId ?? ""];
    if (!myHand || myHand.length !== 2) return;
    emit({ type: "double" });
  }, [gs, myId, playerIds]);

  const isMyTurn = gs.phase === "playing" && playerIds[gs.currentPlayerIdx] === myId;
  const canDeal  = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");
  const currentPlayerId = playerIds[gs.currentPlayerIdx];
  const currentPlayerName = players.find(p => p.id === currentPlayerId)?.name ?? `Player ${gs.currentPlayerIdx + 1}`;

  const dealerVal = gs.dealerHand.length > 0
    ? (gs.dealerRevealed ? handValue(gs.dealerHand) : handValue([gs.dealerHand[0]]))
    : null;

  return (
    <div className="flex flex-col gap-5 rounded-xl bg-green-950/30 p-5">

      {/* Dealer */}
      <div className="flex items-start gap-4 rounded-lg bg-green-900/20 p-3">
        <div className="flex-1">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-green-400">Dealer</p>
          {gs.dealerHand.length > 0
            ? <HandRow cards={gs.dealerHand} hidden={!gs.dealerRevealed} />
            : <p className="text-sm text-arena-text-muted italic">Waiting for deal…</p>}
        </div>
        {dealerVal !== null && (
          <div className="text-right">
            <p className="text-xs text-arena-text-muted">{gs.dealerRevealed ? "Total" : "Showing"}</p>
            <p className={cn("text-xl font-bold", gs.dealerRevealed && handValue(gs.dealerHand) > 21 ? "text-red-400" : "text-arena-text")}>
              {dealerVal}
            </p>
          </div>
        )}
      </div>

      {/* Players */}
      <div className="flex flex-wrap gap-3">
        {playerIds.map((pid, i) => {
          const hand = gs.playerHands[pid] ?? [];
          const status = gs.playerStatus[pid];
          const result = gs.results[pid];
          const val = hand.length ? handValue(hand) : null;
          const isActive = gs.phase === "playing" && gs.currentPlayerIdx === i;
          const name = players.find(p => p.id === pid)?.name ?? `Player ${i + 1}`;
          const isMe = pid === myId;

          return (
            <div key={pid} className={cn("flex-1 min-w-[180px] rounded-lg p-3 transition-all", isActive ? "bg-yellow-500/10 ring-1 ring-yellow-500/40" : "bg-arena-surface/50")}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-arena-text-muted">
                  {name}{isMe ? " (you)" : ""}
                </p>
                {result && (
                  <span className={cn("text-xs", RESULT_LABEL[result].cls)}>
                    {RESULT_LABEL[result].text}
                  </span>
                )}
                {isActive && !result && (
                  <span className="text-xs text-yellow-400 animate-pulse">▸ Turn</span>
                )}
              </div>

              {hand.length > 0
                ? <HandRow cards={hand} small />
                : <p className="text-xs text-arena-text-muted italic">No cards</p>}

              {val !== null && (
                <p className={cn("mt-1 text-sm font-bold", val > 21 ? "text-red-400" : val === 21 ? "text-yellow-400" : "text-arena-text")}>
                  {val > 21 ? "Bust!" : val === 21 && hand.length === 2 ? "Blackjack!" : val}
                  {status === "doubled" && <span className="ml-1 text-xs text-arena-text-muted">(doubled)</span>}
                  {status === "standing" && val !== 21 && <span className="ml-1 text-xs text-arena-text-muted">(stand)</span>}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Status / Actions */}
      <div className="flex flex-col items-center gap-3">
        {gs.phase === "playing" && (
          <p className="text-sm text-arena-text-muted">
            {isMyTurn ? "Your turn" : `Waiting for ${currentPlayerName}…`}
          </p>
        )}

        {isMyTurn && (
          <div className="flex gap-2">
            <button onClick={handleHit} className="rounded-lg bg-green-600 px-5 py-2 text-sm font-bold text-white hover:bg-green-500 active:scale-95 transition-all">
              Hit
            </button>
            <button onClick={handleStand} className="rounded-lg bg-arena-surface px-5 py-2 text-sm font-bold text-arena-text hover:bg-arena-border active:scale-95 transition-all border border-arena-border">
              Stand
            </button>
            {(gs.playerHands[myId ?? ""]?.length === 2) && (
              <button onClick={handleDouble} className="rounded-lg bg-yellow-600 px-5 py-2 text-sm font-bold text-white hover:bg-yellow-500 active:scale-95 transition-all">
                Double
              </button>
            )}
          </div>
        )}

        {gs.phase === "finished" && (
          <div className="text-center space-y-1">
            {myIdx !== -1 && gs.results[myId ?? ""] && (
              <p className={cn("text-lg font-bold", RESULT_LABEL[gs.results[myId ?? ""]].cls)}>
                {RESULT_LABEL[gs.results[myId ?? ""]].text}
              </p>
            )}
            {isHost && (
              <button onClick={handleDeal} className="rounded-lg bg-arena-accent px-8 py-2 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all">
                New Round
              </button>
            )}
            {!isHost && <p className="text-sm text-arena-text-muted">Waiting for host to deal…</p>}
          </div>
        )}

        {canDeal && gs.phase === "waiting" && (
          <button onClick={handleDeal} className="rounded-lg bg-arena-accent px-10 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow-lg">
            Deal
          </button>
        )}

        {gs.phase === "waiting" && !isHost && (
          <p className="text-sm text-arena-text-muted">Waiting for host to deal…</p>
        )}
      </div>

      {/* Dealer result summary */}
      {gs.phase === "finished" && gs.dealerHand.length > 0 && (
        <p className="text-center text-xs text-arena-text-muted">
          Dealer: {handValue(gs.dealerHand)}{handValue(gs.dealerHand) > 21 ? " — Bust!" : isBlackjack(gs.dealerHand) ? " — Blackjack!" : ""}
        </p>
      )}
    </div>
  );
}
