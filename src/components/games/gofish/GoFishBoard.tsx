"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type GFCard = { suit: Suit; rank: Rank };

interface GFState {
  seedBase: string;
  round: number;
  deck: GFCard[];
  hands: Record<string, GFCard[]>;
  books: Record<string, Rank[]>;    // completed books per player
  currentPlayerIdx: number;
  pendingRank: Rank | null;         // rank being resolved (fishing phase)
  phase: "waiting" | "playing" | "fishing" | "finished";
  lastMsg: string;
  winner: string | null;
  drawCount: number;
}

type GFPayload =
  | { type: "deal"; ts: number }
  | { type: "ask";  targetIdx: number; rank: Rank }
  | { type: "fish" };

// ── Deck ───────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): GFCard[] {
  return SUITS.flatMap(suit => RANKS.map(rank => ({ suit, rank })));
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

// ── Rules ──────────────────────────────────────────────────────────────────

function drawOne(state: GFState, playerId: string): GFState {
  if (!state.deck.length) return state;
  const [card, ...deck] = state.deck;
  return {
    ...state, deck,
    drawCount: state.drawCount + 1,
    hands: { ...state.hands, [playerId]: [...(state.hands[playerId] ?? []), card] },
  };
}

// Extract completed books (sets of 4) from a hand, return remaining cards + new book ranks
function extractBooks(hand: GFCard[], existing: Rank[]): { hand: GFCard[]; newBooks: Rank[] } {
  const counts = new Map<Rank, number>();
  for (const c of hand) counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
  const newBooks: Rank[] = [];
  for (const [rank, n] of counts) {
    if (n >= 4 && !existing.includes(rank)) newBooks.push(rank);
  }
  return {
    hand: newBooks.length ? hand.filter(c => !newBooks.includes(c.rank)) : hand,
    newBooks,
  };
}

function applyBooks(state: GFState, playerId: string): GFState {
  const existing = state.books[playerId] ?? [];
  const { hand, newBooks } = extractBooks(state.hands[playerId] ?? [], existing);
  if (!newBooks.length) return state;
  return {
    ...state,
    hands: { ...state.hands, [playerId]: hand },
    books: { ...state.books, [playerId]: [...existing, ...newBooks] },
  };
}

// Replenish empty hand from deck (draw 1)
function replenish(state: GFState, playerId: string): GFState {
  return (state.hands[playerId]?.length ?? 0) === 0 && state.deck.length > 0
    ? drawOne(state, playerId)
    : state;
}

function totalBooks(state: GFState): number {
  return Object.values(state.books).reduce((sum, b) => sum + b.length, 0);
}

function checkFinished(state: GFState, playerIds: string[]): GFState {
  const allHandsEmpty = playerIds.every(id => (state.hands[id]?.length ?? 0) === 0);
  if (totalBooks(state) < 13 && !(state.deck.length === 0 && allHandsEmpty)) return state;

  // Most books wins; tie → null (draw)
  let max = -1, winner: string | null = null;
  for (const id of playerIds) {
    const n = (state.books[id] ?? []).length;
    if (n > max) { max = n; winner = id; }
    else if (n === max) winner = null;
  }
  return { ...state, phase: "finished", winner };
}

// ── State machine ──────────────────────────────────────────────────────────

function initState(roomId: string): GFState {
  return {
    seedBase: roomId, round: 0, deck: [], hands: {}, books: {},
    currentPlayerIdx: 0, pendingRank: null,
    phase: "waiting", lastMsg: "", winner: null, drawCount: 0,
  };
}

function applyDeal(state: GFState, playerIds: string[], ts: number): GFState {
  const n = playerIds.length;
  const each = n === 2 ? 7 : 5;
  let deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const hands: Record<string, GFCard[]> = {};
  const books: Record<string, Rank[]> = {};
  for (const id of playerIds) { hands[id] = []; books[id] = []; }
  for (let pass = 0; pass < each; pass++) {
    for (const id of playerIds) { hands[id].push(deck[0]); deck = deck.slice(1); }
  }
  return {
    ...state, round: state.round + 1, deck, hands, books,
    currentPlayerIdx: 0, pendingRank: null, drawCount: 0,
    phase: "playing", lastMsg: "Game started!", winner: null,
  };
}

function applyAsk(state: GFState, payload: Extract<GFPayload, { type: "ask" }>, playerIds: string[]): GFState {
  const askerId   = playerIds[state.currentPlayerIdx];
  const targetId  = playerIds[payload.targetIdx];
  const { rank }  = payload;

  const targetHas = (state.hands[targetId] ?? []).filter(c => c.rank === rank);

  if (targetHas.length > 0) {
    // Transfer cards to asker
    const targetName = playerIds.indexOf(targetId) === state.currentPlayerIdx ? "yourself" : targetId;
    let s: GFState = {
      ...state,
      hands: {
        ...state.hands,
        [targetId]: (state.hands[targetId] ?? []).filter(c => c.rank !== rank),
        [askerId]:  [...(state.hands[askerId] ?? []), ...targetHas],
      },
      lastMsg: `Got ${targetHas.length} ${rank}${targetHas.length > 1 ? "s" : ""}! Go again.`,
    };
    s = applyBooks(s, askerId);
    s = replenish(s, targetId);
    return checkFinished(s, playerIds);  // asker keeps their turn (phase stays "playing")
  } else {
    // Go Fish!
    return {
      ...state,
      pendingRank: rank,
      phase: "fishing",
      lastMsg: "Go Fish! Draw a card.",
    };
  }
}

function applyFish(state: GFState, playerIds: string[]): GFState {
  const askerId = playerIds[state.currentPlayerIdx];
  const { pendingRank } = state;

  let s = drawOne(state, askerId);

  if (!s.deck.length && s.deck.length === state.deck.length) {
    // Nothing to draw
    const next = (state.currentPlayerIdx + 1) % playerIds.length;
    return checkFinished({ ...s, currentPlayerIdx: next, pendingRank: null, phase: "playing", lastMsg: "Deck empty, passing turn." }, playerIds);
  }

  const drawnCard = (s.hands[askerId] ?? []).at(-1);
  s = applyBooks(s, askerId);

  if (drawnCard && drawnCard.rank === pendingRank) {
    return checkFinished({
      ...s, pendingRank: null, phase: "playing",
      lastMsg: `Fished a ${pendingRank}! Go again.`,
    }, playerIds);
  } else {
    const next = (state.currentPlayerIdx + 1) % playerIds.length;
    const ns: GFState = { ...s, currentPlayerIdx: next, pendingRank: null, phase: "playing", lastMsg: `No ${pendingRank}. Drew a ${drawnCard?.rank ?? "card"}.` };
    return checkFinished(ns, playerIds);
  }
}

function applyGF(state: GFState, payload: GFPayload, playerIds: string[]): GFState {
  if (payload.type === "deal" && (state.phase === "waiting" || state.phase === "finished"))
    return applyDeal(state, playerIds, payload.ts);
  if (state.phase !== "playing" && state.phase !== "fishing") return state;
  if (payload.type === "ask"  && state.phase === "playing")  return applyAsk(state, payload, playerIds);
  if (payload.type === "fish" && state.phase === "fishing")  return applyFish(state, playerIds);
  return state;
}

// ── Visuals ────────────────────────────────────────────────────────────────

function isRed(suit: Suit) { return suit === "♥" || suit === "♦"; }

function MiniCard({ rank, suit }: { rank: Rank; suit: Suit }) {
  return (
    <div className={cn("flex items-center justify-center rounded border bg-white font-bold text-[9px] leading-tight w-5 h-7 flex-shrink-0",
      isRed(suit) ? "text-red-600 border-red-200" : "text-gray-900 border-gray-200")}>
      <span>{rank}</span>
    </div>
  );
}

function CardBack({ small = false }: { small?: boolean }) {
  const w = small ? 30 : 44, h = small ? 42 : 62;
  return (
    <div className="relative flex items-center justify-center rounded-lg border-2 border-white/20 overflow-hidden bg-[#1e3a8a] flex-shrink-0"
      style={{ width: w, height: h }}>
      <div className="absolute inset-1.5 rounded bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_2px,#3b5bdb_2px,#3b5bdb_5px)]"/>
      <span className="relative text-white font-black text-[8px]">GF</span>
    </div>
  );
}

// Rank selection button for asking
function RankBtn({ rank, selected, onClick }: { rank: Rank; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border-2 bg-white font-bold transition-all",
        "w-10 h-14 text-base hover:scale-105 active:scale-95",
        selected
          ? "border-arena-accent ring-2 ring-arena-accent/50 -translate-y-1 shadow-lg shadow-arena-accent/20"
          : "border-gray-300 hover:border-gray-400",
      )}>
      <span>{rank}</span>
    </button>
  );
}

// Book display: shows a set of 4 suit icons for a completed rank
function Book({ rank }: { rank: Rank }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-lg border border-arena-border bg-arena-surface/60 px-1.5 py-1">
      <span className="text-[9px] font-bold text-arena-text">{rank}</span>
      <div className="flex gap-0.5">
        {SUITS.map(s => (
          <span key={s} className={cn("text-[8px]", isRed(s) ? "text-red-500" : "text-gray-700")}>{s}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────

export default function GoFishBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;
  const myIdx  = playerIds.indexOf(myId ?? "");

  const [gs, setGs] = useState<GFState>(() => initState(room.id));
  const [selRank,   setSelRank]   = useState<Rank | null>(null);
  const [selTarget, setSelTarget] = useState<number | null>(null);

  useEffect(() => {
    setGs(initState(room.id));
    setSelRank(null); setSelTarget(null);
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyGF(s, m.payload as GFPayload, playerIds);
      return s;
    });
    setSelRank(null); setSelTarget(null);
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  useEffect(() => {
    if (!gs.winner || useGameStore.getState().result) return;
    useGameStore.getState().setResult({ winnerId: gs.winner, reason: "most books" });
  }, [gs.winner]);

  const emit = useCallback((payload: GFPayload) => {
    setGs(prev => applyGF(prev, payload, playerIds));
    setSelRank(null); setSelTarget(null);
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const isMyTurn  = playerIds[gs.currentPlayerIdx] === myId;
  const myHand    = gs.hands[myId ?? ""] ?? [];
  const myBooks   = gs.books[myId ?? ""] ?? [];
  const myRanks   = [...new Set(myHand.map(c => c.rank))].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));

  // In 2-player, auto-select the only opponent
  const otherIdxs = playerIds.map((_, i) => i).filter(i => playerIds[i] !== myId);
  const autoTarget = otherIdxs.length === 1 ? otherIdxs[0] : null;
  const effectiveTarget = selTarget ?? autoTarget;

  const canAsk  = isMyTurn && gs.phase === "playing" && selRank !== null && effectiveTarget !== null;
  const canFish = isMyTurn && gs.phase === "fishing";
  const canDeal = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");

  const curName = storeP.find(p => p.id === playerIds[gs.currentPlayerIdx])?.name ?? "Opponent";
  const statusText =
    gs.phase === "waiting"  ? (isHost ? "Deal to start" : "Waiting for host to deal…") :
    gs.phase === "finished" ? (gs.winner === myId ? "You win! 🎉" : gs.winner ? `${storeP.find(p=>p.id===gs.winner)?.name??"Opponent"} wins!` : "Draw!") :
    canFish                 ? "Go Fish! Draw from the deck." :
    isMyTurn                ? "Your turn — pick a rank to ask for" :
    `${curName}'s turn`;

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {/* Status + last action */}
      <div className="text-center space-y-0.5">
        <p className="text-sm font-medium text-arena-text-muted">{statusText}</p>
        {gs.lastMsg && gs.phase !== "waiting" && (
          <p className={cn("text-xs font-semibold", gs.lastMsg.includes("Fish") ? "text-blue-400" : gs.lastMsg.includes("again") ? "text-green-400" : "text-arena-text-muted")}>
            {gs.lastMsg}
          </p>
        )}
      </div>

      {/* Books area — all players */}
      <div className="flex flex-wrap gap-4 justify-center">
        {playerIds.map(id => {
          const b = gs.books[id] ?? [];
          const name = storeP.find(p => p.id === id)?.name ?? (id === myId ? "You" : "Opp");
          const isMe = id === myId;
          return (
            <div key={id} className="flex flex-col items-center gap-1.5">
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide",
                isMe ? "text-arena-accent" : "text-arena-text-muted")}>
                {isMe ? "You" : name} — {b.length} book{b.length !== 1 ? "s" : ""}
              </span>
              <div className="flex flex-wrap gap-1 max-w-[200px]">
                {b.length > 0
                  ? b.map(r => <Book key={r} rank={r}/>)
                  : <span className="text-[9px] text-arena-text-muted italic">none yet</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Opponent hands (face-down) */}
      {gs.phase !== "waiting" && (
        <div className="flex flex-wrap gap-5 justify-center">
          {playerIds.filter(id => id !== myId).map(id => {
            const hand = gs.hands[id] ?? [];
            const name = storeP.find(p => p.id === id)?.name ?? "Opponent";
            const isTurn = playerIds[gs.currentPlayerIdx] === id;
            const idx = playerIds.indexOf(id);
            const isTarget = effectiveTarget === idx && isMyTurn && gs.phase === "playing";
            return (
              <div key={id} className={cn("flex flex-col items-center gap-1.5 rounded-xl p-2 transition-all",
                isTarget && "ring-2 ring-arena-accent bg-arena-accent/5")}>
                <span className={cn("text-[11px] font-semibold",
                  isTurn ? "text-yellow-400" : isTarget ? "text-arena-accent" : "text-arena-text-muted")}>
                  {isTurn ? "▸ " : ""}{name} — {hand.length} card{hand.length !== 1 ? "s" : ""}
                </span>
                {/* Target selector button (3+ players) */}
                {otherIdxs.length > 1 && isMyTurn && gs.phase === "playing" && (
                  <button onClick={() => setSelTarget(idx)}
                    className={cn("text-[9px] px-2 py-0.5 rounded border transition-all",
                      selTarget === idx
                        ? "border-arena-accent bg-arena-accent text-white"
                        : "border-arena-border text-arena-text-muted hover:border-arena-accent")}>
                    Ask {name}
                  </button>
                )}
                <div className="flex">
                  {Array.from({ length: Math.min(hand.length, 10) }, (_, i) => (
                    <div key={i} style={{ marginLeft: i > 0 ? -10 : 0 }}><CardBack small/></div>
                  ))}
                  {hand.length > 10 && (
                    <span className="self-center ml-1 text-[9px] text-arena-text-muted">+{hand.length - 10}</span>
                  )}
                  {hand.length === 0 && <span className="text-[9px] text-arena-text-muted italic">empty hand</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deck + Fish button */}
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => { if (canFish) emit({ type: "fish" }); }}
            disabled={!canFish}
            className={cn("transition-all", canFish && "hover:scale-105 hover:-translate-y-1 cursor-pointer")}
          >
            <CardBack/>
          </button>
          <span className="text-[9px] text-arena-text-muted">{gs.deck.length} in deck</span>
          {canFish && (
            <span className="text-[10px] font-semibold text-blue-400 animate-pulse">Go Fish!</span>
          )}
        </div>
      </div>

      {/* Deal button */}
      {canDeal && (
        <button onClick={() => emit({ type: "deal", ts: Date.now() })}
          className="rounded-lg bg-arena-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow">
          Deal
        </button>
      )}

      {/* Ask UI — rank picker */}
      {isMyTurn && gs.phase === "playing" && myRanks.length > 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-arena-border bg-arena-surface/50 p-4 w-full max-w-sm">
          <p className="text-[11px] text-arena-text-muted font-semibold uppercase tracking-wide">
            {otherIdxs.length > 1 && effectiveTarget === null ? "1. Pick a rank  2. Pick who to ask" : "Pick a rank to ask for"}
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {myRanks.map(rank => (
              <RankBtn key={rank} rank={rank}
                selected={selRank === rank}
                onClick={() => setSelRank(r => r === rank ? null : rank)}/>
            ))}
          </div>
          {canAsk && (
            <button
              onClick={() => emit({ type: "ask", targetIdx: effectiveTarget!, rank: selRank! })}
              className="rounded-lg bg-arena-accent px-6 py-2 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow-sm w-full">
              Ask for {selRank}s
              {effectiveTarget !== null && otherIdxs.length > 1 && ` → ${storeP.find(p=>p.id===playerIds[effectiveTarget])?.name}`}
            </button>
          )}
        </div>
      )}

      {/* My hand (all cards shown individually) */}
      {gs.phase !== "waiting" && (
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-arena-text-muted">
            Your hand ({myHand.length} card{myHand.length !== 1 ? "s" : ""})
          </span>
          <div className="flex flex-wrap gap-1 justify-center max-w-[400px]">
            {myHand
              .slice()
              .sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit))
              .map((card, i) => (
                <MiniCard key={i} rank={card.rank} suit={card.suit}/>
              ))}
            {myHand.length === 0 && <span className="text-[10px] text-arena-text-muted italic">No cards</span>}
          </div>
        </div>
      )}
    </div>
  );
}
