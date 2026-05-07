"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type CECard = { suit: Suit; rank: Rank };

interface CEState {
  seedBase: string;
  round: number;
  deck: CECard[];
  discardPile: CECard[];
  hands: Record<string, CECard[]>;
  currentPlayerIdx: number;
  currentSuit: Suit;       // active suit (may differ from top card after an 8)
  drawPhase: boolean;      // just drew a playable card — decide to play or pass
  drawCount: number;       // for reshuffle seed
  phase: "waiting" | "playing" | "finished";
  winner: string | null;
}

type CEPayload =
  | { type: "deal"; ts: number }
  | { type: "play"; cardIdx: number; chosenSuit?: Suit }
  | { type: "draw" }
  | { type: "pass" };

// ── Deck ───────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): CECard[] {
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

// ── Game rules ─────────────────────────────────────────────────────────────

function canPlay(card: CECard, currentSuit: Suit, topCard: CECard): boolean {
  return card.rank === "8" || card.suit === currentSuit || card.rank === topCard.rank;
}

function nextIdx(state: CEState, n: number): number {
  return (state.currentPlayerIdx + 1) % n;
}

function drawOne(state: CEState, playerId: string): CEState {
  let s = state;
  if (s.deck.length === 0 && s.discardPile.length > 1) {
    const top = s.discardPile[s.discardPile.length - 1];
    const newDeck = seededShuffle(s.discardPile.slice(0, -1), `${s.seedBase}:rs:${s.drawCount}`);
    s = { ...s, deck: newDeck, discardPile: [top] };
  }
  if (!s.deck.length) return s;
  const card = s.deck[0];
  return {
    ...s,
    deck: s.deck.slice(1),
    drawCount: s.drawCount + 1,
    hands: { ...s.hands, [playerId]: [...(s.hands[playerId] ?? []), card] },
  };
}

// ── State machine ──────────────────────────────────────────────────────────

function initState(roomId: string): CEState {
  return {
    seedBase: roomId, round: 0, deck: [], discardPile: [], hands: {},
    currentPlayerIdx: 0, currentSuit: "♠",
    drawPhase: false, drawCount: 0,
    phase: "waiting", winner: null,
  };
}

function applyDeal(state: CEState, playerIds: string[], ts: number): CEState {
  const n = playerIds.length;
  const cardsEach = n === 2 ? 7 : 5;
  let deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const hands: Record<string, CECard[]> = {};
  for (const id of playerIds) hands[id] = [];

  for (let pass = 0; pass < cardsEach; pass++) {
    for (const id of playerIds) {
      hands[id].push(deck[0]);
      deck = deck.slice(1);
    }
  }

  // Flip first non-8 for discard pile
  let startCard: CECard | undefined;
  let tries = 0;
  while (deck.length && tries++ < deck.length) {
    if (deck[0].rank !== "8") { startCard = deck[0]; deck = deck.slice(1); break; }
    deck = [...deck.slice(1), deck[0]];
  }

  return {
    ...state, round: state.round + 1, deck, hands,
    discardPile: startCard ? [startCard] : [],
    currentSuit: (startCard?.suit ?? "♠") as Suit,
    currentPlayerIdx: 0, drawPhase: false, drawCount: 0,
    phase: "playing", winner: null,
  };
}

function applyPlay(state: CEState, payload: Extract<CEPayload, { type: "play" }>, playerIds: string[]): CEState {
  const n = playerIds.length;
  const playerId = playerIds[state.currentPlayerIdx];
  const hand = state.hands[playerId] ?? [];
  const card = hand[payload.cardIdx];
  if (!card) return state;

  const newHand = hand.filter((_, i) => i !== payload.cardIdx);
  if (newHand.length === 0) {
    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      discardPile: [...state.discardPile, card],
      phase: "finished", winner: playerId, drawPhase: false,
    };
  }

  const currentSuit: Suit = card.rank === "8"
    ? (payload.chosenSuit ?? state.currentSuit)
    : card.suit;

  return {
    ...state,
    hands: { ...state.hands, [playerId]: newHand },
    discardPile: [...state.discardPile, card],
    currentSuit,
    currentPlayerIdx: nextIdx(state, n),
    drawPhase: false,
  };
}

function applyDraw(state: CEState, playerIds: string[]): CEState {
  const n = playerIds.length;
  const playerId = playerIds[state.currentPlayerIdx];
  const top = state.discardPile[state.discardPile.length - 1];

  const s = drawOne(state, playerId);
  const newHand = s.hands[playerId] ?? [];
  const drawnCard = newHand[newHand.length - 1];

  // If deck was empty and nothing drawn, end turn
  if (!drawnCard || s.deck.length === state.deck.length) {
    return { ...s, drawPhase: false, currentPlayerIdx: nextIdx(state, n) };
  }

  const playable = canPlay(drawnCard, s.currentSuit, top);
  return playable
    ? { ...s, drawPhase: true }
    : { ...s, drawPhase: false, currentPlayerIdx: nextIdx(state, n) };
}

function applyCE(state: CEState, payload: CEPayload, playerIds: string[]): CEState {
  if (payload.type === "deal" && (state.phase === "waiting" || state.phase === "finished"))
    return applyDeal(state, playerIds, payload.ts);
  if (state.phase !== "playing") return state;
  if (payload.type === "play")  return applyPlay(state, payload, playerIds);
  if (payload.type === "draw")  return applyDraw(state, playerIds);
  if (payload.type === "pass")  return { ...state, drawPhase: false, currentPlayerIdx: nextIdx(state, playerIds.length) };
  return state;
}

// ── Card visuals ───────────────────────────────────────────────────────────

const RED_SUITS: Suit[] = ["♥", "♦"];
function isRed(suit: Suit) { return RED_SUITS.includes(suit); }

function CECardFace({ card, playable = true, lifted = false, small = false, isCrazy = false, onClick }: {
  card: CECard; playable?: boolean; lifted?: boolean; small?: boolean; isCrazy?: boolean; onClick?: () => void;
}) {
  const red  = isRed(card.suit);
  const col  = red ? "#dc2626" : "#111827";
  const w = small ? 38 : 54, h = small ? 54 : 78;

  return (
    <button
      onClick={onClick}
      disabled={!playable || !onClick}
      style={{ width: w, height: h }}
      className={cn(
        "relative flex-shrink-0 rounded-xl border-2 bg-white select-none transition-all duration-150",
        isCrazy
          ? "border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]"
          : "border-gray-200",
        playable && onClick && "hover:-translate-y-4 hover:shadow-xl hover:border-gray-400 cursor-pointer",
        lifted && "-translate-y-5 ring-2 ring-white shadow-2xl",
        !playable && onClick && "opacity-40 cursor-not-allowed",
        !onClick && "cursor-default",
      )}
    >
      {/* Top-left corner */}
      <div className="absolute top-1 left-1.5 leading-tight" style={{ color: col }}>
        <div className={cn("font-bold", small ? "text-[8px]" : "text-[10px]")}>{card.rank}</div>
        <div className={small ? "text-[8px]" : "text-[9px]"}>{card.suit}</div>
      </div>

      {/* Centre suit */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn("font-bold select-none", small ? "text-xl" : "text-3xl")} style={{ color: col }}>
          {isCrazy ? "8" : card.suit}
        </span>
      </div>

      {/* Bottom-right corner (rotated) */}
      <div className="absolute bottom-1 right-1.5 leading-tight rotate-180" style={{ color: col }}>
        <div className={cn("font-bold", small ? "text-[8px]" : "text-[10px]")}>{card.rank}</div>
        <div className={small ? "text-[8px]" : "text-[9px]"}>{card.suit}</div>
      </div>

      {/* "8" badge when crazy */}
      {isCrazy && !small && (
        <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
          <span className="text-white text-[9px] font-black">8</span>
        </div>
      )}
    </button>
  );
}

function CECardBack({ small = false }: { small?: boolean }) {
  const w = small ? 38 : 54, h = small ? 54 : 78;
  return (
    <div className="relative flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden bg-[#1e3a8a]"
      style={{ width: w, height: h }}>
      <div className="absolute inset-2 rounded-lg bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_3px,#3b5bdb_3px,#3b5bdb_6px)]"/>
      <span className="relative text-white font-black text-[10px] drop-shadow">8</span>
    </div>
  );
}

// ── Suit chooser ───────────────────────────────────────────────────────────

function SuitChooser({ onChoose }: { onChoose: (s: Suit) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="rounded-2xl bg-arena-surface border border-arena-border p-6 shadow-2xl text-center space-y-4">
        <p className="text-sm font-semibold text-arena-text">Crazy Eight — choose a suit</p>
        <div className="grid grid-cols-2 gap-3">
          {(["♠","♥","♦","♣"] as Suit[]).map(s => (
            <button key={s} onClick={() => onChoose(s)}
              className={cn(
                "w-20 h-16 rounded-xl text-4xl font-bold transition-all hover:scale-110 active:scale-95 border-2",
                isRed(s)
                  ? "text-red-600 bg-red-50 border-red-200 hover:bg-red-100"
                  : "text-gray-900 bg-gray-50 border-gray-200 hover:bg-gray-100",
              )}>
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Suit indicator ─────────────────────────────────────────────────────────

const SUIT_COLOR: Record<Suit, string> = {
  "♠": "text-gray-900", "♣": "text-gray-900",
  "♥": "text-red-600",  "♦": "text-red-600",
};

// ── Main board ─────────────────────────────────────────────────────────────

export default function CrazyEightsBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;

  const [gs, setGs] = useState<CEState>(() => initState(room.id));
  const [pendingEight, setPendingEight] = useState<number | null>(null);

  useEffect(() => {
    setGs(initState(room.id));
    setPendingEight(null);
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyCE(s, m.payload as CEPayload, playerIds);
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  useEffect(() => {
    if (!gs.winner || useGameStore.getState().result) return;
    useGameStore.getState().setResult({ winnerId: gs.winner, reason: "empty hand" });
  }, [gs.winner]);

  const emit = useCallback((payload: CEPayload) => {
    setGs(prev => applyCE(prev, payload, playerIds));
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const isMyTurn = playerIds[gs.currentPlayerIdx] === myId;
  const myHand   = gs.hands[myId ?? ""] ?? [];
  const topCard  = gs.discardPile[gs.discardPile.length - 1];

  const canDeal  = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");
  const canDraw  = isMyTurn && !gs.drawPhase;
  const canPass  = isMyTurn && gs.drawPhase;

  function handleCardClick(idx: number) {
    if (!isMyTurn || gs.phase !== "playing") return;
    if (gs.drawPhase && idx !== myHand.length - 1) return;
    const card = myHand[idx];
    if (!card || !topCard) return;
    if (!canPlay(card, gs.currentSuit, topCard)) return;
    if (card.rank === "8") {
      setPendingEight(idx);
    } else {
      emit({ type: "play", cardIdx: idx });
    }
  }

  function handleSuitChosen(suit: Suit) {
    if (pendingEight === null) return;
    emit({ type: "play", cardIdx: pendingEight, chosenSuit: suit });
    setPendingEight(null);
  }

  const curName = storeP.find(p => p.id === playerIds[gs.currentPlayerIdx])?.name ?? "Opponent";
  const statusText =
    gs.phase === "waiting"  ? (isHost ? "Deal to start" : "Waiting for host to deal…") :
    gs.phase === "finished" ? (gs.winner === myId ? "You win! 🎉" : `${storeP.find(p=>p.id===gs.winner)?.name??"Opponent"} wins!`) :
    canPass                 ? "Play the drawn card, or pass" :
    isMyTurn                ? "Your turn" :
    `${curName}'s turn`;

  const others = playerIds.filter(id => id !== myId);

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {pendingEight !== null && <SuitChooser onChoose={handleSuitChosen}/>}

      <p className="text-sm font-medium text-arena-text-muted">{statusText}</p>

      {/* Opponent hands */}
      {gs.phase === "playing" && (
        <div className="flex flex-wrap gap-6 justify-center">
          {others.map(id => {
            const hand = gs.hands[id] ?? [];
            const name = storeP.find(p => p.id === id)?.name ?? "Opponent";
            const isTurn = playerIds[gs.currentPlayerIdx] === id;
            return (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <span className={cn("text-[11px] font-semibold", isTurn ? "text-yellow-400" : "text-arena-text-muted")}>
                  {isTurn ? "▸ " : ""}{name} — {hand.length} card{hand.length !== 1 ? "s" : ""}
                  {hand.length === 1 && <span className="ml-1 text-yellow-400 font-bold animate-pulse"> — last card!</span>}
                </span>
                <div className="flex">
                  {Array.from({ length: Math.min(hand.length, 12) }, (_, i) => (
                    <div key={i} style={{ marginLeft: i > 0 ? -14 : 0 }}>
                      <CECardBack small/>
                    </div>
                  ))}
                  {hand.length > 12 && (
                    <span className="self-center ml-2 text-xs text-arena-text-muted">+{hand.length - 12}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Centre */}
      <div className="flex items-center gap-6">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => { if (canDraw) emit({ type: "draw" }); }}
            disabled={!canDraw}
            className={cn("transition-all duration-150", canDraw && "hover:scale-105 hover:-translate-y-1 cursor-pointer")}
          >
            <CECardBack/>
          </button>
          <span className="text-[9px] text-arena-text-muted">{gs.deck.length} left</span>
          {canDraw && !myHand.some(c => canPlay(c, gs.currentSuit, topCard ?? { suit: "♠", rank: "A" })) && (
            <span className="text-[10px] font-semibold text-arena-accent animate-pulse">Draw</span>
          )}
        </div>

        {/* Current suit + discard */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("text-3xl font-bold drop-shadow", SUIT_COLOR[gs.currentSuit])}>
              {gs.currentSuit}
            </span>
            <span className="text-[10px] text-arena-text-muted">active suit</span>
          </div>
          {topCard
            ? <CECardFace card={topCard} playable={false}/>
            : <div className="w-[54px] h-[78px] rounded-xl border-2 border-dashed border-arena-border opacity-30"/>}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-2">
        {canDeal && (
          <button onClick={() => emit({ type: "deal", ts: Date.now() })}
            className="rounded-lg bg-arena-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow">
            Deal
          </button>
        )}
        {canPass && (
          <button onClick={() => emit({ type: "pass" })}
            className="rounded-lg bg-arena-surface border border-arena-border px-6 py-2 text-sm font-semibold text-arena-text hover:bg-arena-border active:scale-95 transition-all">
            Pass
          </button>
        )}
      </div>

      {/* My hand */}
      {gs.phase === "playing" && (
        <div className="flex flex-col items-center gap-2 w-full">
          <span className="text-[10px] text-arena-text-muted">
            Your hand ({myHand.length})
            {myHand.length === 1 && <span className="ml-2 text-yellow-400 font-bold animate-pulse">Last card!</span>}
          </span>
          <div className="flex gap-1.5 flex-wrap justify-center pb-6 pt-6 px-4 max-w-[520px]">
            {myHand.map((card, idx) => {
              const isDrawn = gs.drawPhase && idx === myHand.length - 1;
              const isPlayable = isMyTurn
                && canPlay(card, gs.currentSuit, topCard ?? { suit: "♠", rank: "A" })
                && (!gs.drawPhase || isDrawn);
              return (
                <CECardFace
                  key={idx}
                  card={card}
                  playable={isPlayable}
                  lifted={isDrawn && gs.drawPhase}
                  isCrazy={card.rank === "8"}
                  onClick={isMyTurn ? () => handleCardClick(idx) : undefined}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
