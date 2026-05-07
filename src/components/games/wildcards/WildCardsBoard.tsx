"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Color = "red" | "blue" | "green" | "yellow";
type CardValue =
  | "0"|"1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"
  | "skip" | "reverse" | "draw2" | "wild" | "draw4";
type WCard = { color: Color | "wild"; value: CardValue };

interface WCState {
  seedBase: string;
  round: number;
  deck: WCard[];
  discardPile: WCard[];
  hands: Record<string, WCard[]>;
  currentPlayerIdx: number;
  direction: 1 | -1;
  currentColor: Color;
  drawCount: number;
  drawPhase: boolean;   // just drew — decide to play or pass
  pendingDraw: number;  // forced draw for current player (draw2 / draw4)
  phase: "waiting" | "playing" | "finished";
  winner: string | null;
}

type WCPayload =
  | { type: "deal"; ts: number }
  | { type: "play"; cardIdx: number; chosenColor?: Color }
  | { type: "draw" }
  | { type: "pass" };

// ── Deck ───────────────────────────────────────────────────────────────────

const COLORS: Color[] = ["red", "blue", "green", "yellow"];

function buildDeck(): WCard[] {
  const cards: WCard[] = [];
  for (const color of COLORS) {
    cards.push({ color, value: "0" });
    for (const n of ["1","2","3","4","5","6","7","8","9"] as CardValue[]) {
      cards.push({ color, value: n }, { color, value: n });
    }
    for (const a of ["skip","reverse","draw2"] as CardValue[]) {
      cards.push({ color, value: a }, { color, value: a });
    }
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ color: "wild", value: "wild" });
    cards.push({ color: "wild", value: "draw4" });
  }
  return cards; // 108 cards
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

function canPlay(card: WCard, currentColor: Color, topCard: WCard): boolean {
  if (card.color === "wild") return true;
  if (card.color === currentColor) return true;
  if (card.value === topCard.value) return true;
  return false;
}

function advance(state: WCState, n: number, skip = false): number {
  const steps = skip ? 2 : 1;
  return ((state.currentPlayerIdx + state.direction * steps) % n + n) % n;
}

function drawN(state: WCState, playerId: string, count: number): WCState {
  let s = state;
  const drawn: WCard[] = [];
  for (let i = 0; i < count; i++) {
    // Reshuffle discard into deck when empty
    if (s.deck.length === 0 && s.discardPile.length > 1) {
      const top = s.discardPile[s.discardPile.length - 1];
      const newDeck = seededShuffle(s.discardPile.slice(0, -1), `${s.seedBase}:rs:${s.drawCount}`);
      s = { ...s, deck: newDeck, discardPile: [top] };
    }
    if (!s.deck.length) break;
    drawn.push(s.deck[0]);
    s = { ...s, deck: s.deck.slice(1), drawCount: s.drawCount + 1 };
  }
  return { ...s, hands: { ...s.hands, [playerId]: [...(s.hands[playerId] ?? []), ...drawn] } };
}

// ── State machine ──────────────────────────────────────────────────────────

function initState(roomId: string): WCState {
  return {
    seedBase: roomId, round: 0, deck: [], discardPile: [], hands: {},
    currentPlayerIdx: 0, direction: 1, currentColor: "red",
    drawCount: 0, drawPhase: false, pendingDraw: 0,
    phase: "waiting", winner: null,
  };
}

function applyDeal(state: WCState, playerIds: string[], ts: number): WCState {
  const round = state.round + 1;
  let deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const hands: Record<string, WCard[]> = {};
  for (const id of playerIds) hands[id] = [];

  // Deal 7 cards each (alternating like real deal)
  for (let pass = 0; pass < 7; pass++) {
    for (const id of playerIds) {
      hands[id].push(deck[0]);
      deck = deck.slice(1);
    }
  }

  // Flip first non-wild card to start discard pile
  let startCard: WCard | undefined;
  let attempts = 0;
  while (deck.length && attempts++ < deck.length) {
    if (deck[0].color !== "wild") { startCard = deck[0]; deck = deck.slice(1); break; }
    deck = [...deck.slice(1), deck[0]]; // rotate wild to back
  }

  const startColor: Color = (startCard?.color ?? "red") as Color;
  const discardPile: WCard[] = startCard ? [startCard] : [];

  let currentPlayerIdx = 0;
  let direction: 1 | -1 = 1;
  let pendingDraw = 0;

  if (startCard?.value === "reverse") direction = -1;
  if (startCard?.value === "skip")
    currentPlayerIdx = advance({ ...state, currentPlayerIdx: 0, direction: 1 }, playerIds.length);
  if (startCard?.value === "draw2") pendingDraw = 2;

  return {
    ...state, round, deck, discardPile, hands,
    currentPlayerIdx, direction, currentColor: startColor,
    drawCount: 0, drawPhase: false, pendingDraw,
    phase: "playing", winner: null,
  };
}

function applyPlay(state: WCState, payload: Extract<WCPayload, { type: "play" }>, playerIds: string[]): WCState {
  const n = playerIds.length;
  const playerId = playerIds[state.currentPlayerIdx];
  const hand = state.hands[playerId] ?? [];
  const card = hand[payload.cardIdx];
  if (!card) return state;

  const newHand = hand.filter((_, i) => i !== payload.cardIdx);
  const discardPile = [...state.discardPile, card];
  const newHands = { ...state.hands, [playerId]: newHand };

  if (newHand.length === 0) {
    return { ...state, hands: newHands, discardPile, phase: "finished", winner: playerId, drawPhase: false };
  }

  const currentColor: Color = card.color === "wild" ? (payload.chosenColor ?? "red") : card.color as Color;
  let direction = state.direction;
  let pendingDraw = 0;
  let nextIdx: number;

  switch (card.value) {
    case "skip":
      nextIdx = advance({ ...state, direction }, n, true);
      break;
    case "reverse":
      direction = (direction * -1) as 1 | -1;
      nextIdx = n === 2
        ? state.currentPlayerIdx   // 2-player: reverse = extra turn
        : advance({ ...state, direction }, n);
      break;
    case "draw2":
      pendingDraw = 2;
      nextIdx = advance({ ...state, direction }, n);
      break;
    case "draw4":
      pendingDraw = 4;
      nextIdx = advance({ ...state, direction }, n);
      break;
    default:
      nextIdx = advance({ ...state, direction }, n);
  }

  return {
    ...state, hands: newHands, discardPile, currentColor, direction,
    currentPlayerIdx: nextIdx, drawPhase: false, pendingDraw,
  };
}

function applyDraw(state: WCState, playerIds: string[]): WCState {
  const n = playerIds.length;
  const playerId = playerIds[state.currentPlayerIdx];

  // Forced draw (draw2 / draw4 penalty)
  if (state.pendingDraw > 0) {
    const s = drawN(state, playerId, state.pendingDraw);
    return { ...s, pendingDraw: 0, currentPlayerIdx: advance(state, n), drawPhase: false };
  }

  // Voluntary draw
  const s = drawN(state, playerId, 1);
  const newHand = s.hands[playerId] ?? [];
  const drawn = newHand[newHand.length - 1];
  const top = state.discardPile[state.discardPile.length - 1];
  const playable = drawn && canPlay(drawn, state.currentColor, top);

  return playable
    ? { ...s, drawPhase: true }
    : { ...s, drawPhase: false, currentPlayerIdx: advance(state, n) };
}

function applyWC(state: WCState, payload: WCPayload, playerIds: string[]): WCState {
  if (payload.type === "deal" && (state.phase === "waiting" || state.phase === "finished"))
    return applyDeal(state, playerIds, payload.ts);
  if (state.phase !== "playing") return state;
  if (payload.type === "play") return applyPlay(state, payload, playerIds);
  if (payload.type === "draw") return applyDraw(state, playerIds);
  if (payload.type === "pass") return { ...state, drawPhase: false, currentPlayerIdx: advance(state, playerIds.length) };
  return state;
}

// ── Card visuals ───────────────────────────────────────────────────────────

const CARD_BG: Record<string, string> = {
  red: "#dc2626", blue: "#2563eb", green: "#16a34a", yellow: "#ca8a04",
};

const SYM: Record<CardValue, string> = {
  "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",
  skip:"⊘", reverse:"↺", draw2:"+2", wild:"★", draw4:"+4",
};

function CardFace({ card, playable = true, lifted = false, small = false, onClick }: {
  card: WCard; playable?: boolean; lifted?: boolean; small?: boolean; onClick?: () => void;
}) {
  const isWild = card.color === "wild";
  const sym = SYM[card.value];
  const w = small ? 38 : 54, h = small ? 54 : 78;

  return (
    <button
      onClick={onClick}
      disabled={!playable || !onClick}
      style={{ width: w, height: h, background: isWild ? undefined : CARD_BG[card.color] }}
      className={cn(
        "relative flex-shrink-0 rounded-xl border-2 font-bold select-none transition-all duration-150",
        isWild ? "overflow-hidden border-white/20" : "border-white/30",
        playable && onClick && "hover:-translate-y-4 hover:shadow-xl hover:border-white/70 cursor-pointer",
        lifted && "-translate-y-5 ring-2 ring-white shadow-2xl",
        !playable && onClick && "opacity-40 cursor-not-allowed",
        !onClick && "cursor-default",
      )}
    >
      {isWild ? (
        <>
          <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-red-600"/>
          <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-600"/>
          <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-green-600"/>
          <div className="absolute bottom-0 right-0 w-1/2 h-1/2 bg-yellow-500"/>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={cn("font-black text-white drop-shadow-md", small ? "text-sm" : "text-xl")}>{sym}</span>
          </div>
          {card.value === "draw4" && (
            <span className="absolute top-1 left-1 text-[8px] font-bold text-white/90">+4</span>
          )}
        </>
      ) : (
        <>
          <span className={cn("absolute top-1 left-1.5 text-white/90 font-bold leading-none", small ? "text-[8px]" : "text-[11px]")}>{sym}</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex items-center justify-center rounded-full bg-white/15 w-3/5 h-3/5">
              <span className={cn("text-white font-black drop-shadow", small ? "text-lg" : "text-2xl")}>{sym}</span>
            </div>
          </div>
          <span className={cn("absolute bottom-1 right-1.5 text-white/90 font-bold leading-none rotate-180", small ? "text-[8px]" : "text-[11px]")}>{sym}</span>
        </>
      )}
    </button>
  );
}

function CardBack({ small = false }: { small?: boolean }) {
  const w = small ? 38 : 54, h = small ? 54 : 78;
  return (
    <div className="relative flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden bg-[#1e3a8a]"
      style={{ width: w, height: h }}>
      <div className="absolute inset-2 rounded-lg bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_3px,#3b5bdb_3px,#3b5bdb_6px)]"/>
      <span className="relative text-white font-black text-[10px] drop-shadow">WC</span>
    </div>
  );
}

// ── Color chooser ──────────────────────────────────────────────────────────

const COLOR_BTN: Record<Color, string> = {
  red:    "bg-red-600    hover:bg-red-500    ring-red-400",
  blue:   "bg-blue-600   hover:bg-blue-500   ring-blue-400",
  green:  "bg-green-600  hover:bg-green-500  ring-green-400",
  yellow: "bg-yellow-500 hover:bg-yellow-400 ring-yellow-300",
};

function ColorChooser({ onChoose }: { onChoose: (c: Color) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm">
      <div className="rounded-2xl bg-arena-surface border border-arena-border p-6 shadow-2xl text-center space-y-4">
        <p className="text-sm font-semibold text-arena-text">Choose a color</p>
        <div className="grid grid-cols-2 gap-3">
          {(["red","blue","green","yellow"] as Color[]).map(c => (
            <button key={c} onClick={() => onChoose(c)}
              className={cn("w-20 h-16 rounded-xl capitalize text-white font-bold text-sm transition-all hover:scale-105 active:scale-95 ring-0 hover:ring-2", COLOR_BTN[c])}>
              {c}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Direction indicator ────────────────────────────────────────────────────

const COLOR_DOT: Record<Color, string> = {
  red: "bg-red-500", blue: "bg-blue-500", green: "bg-green-500", yellow: "bg-yellow-400",
};

// ── Main board ─────────────────────────────────────────────────────────────

export default function WildCardsBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;

  const [gs, setGs] = useState<WCState>(() => initState(room.id));
  const [pendingWild, setPendingWild] = useState<number | null>(null);

  // Reset on rematch
  useEffect(() => {
    setGs(initState(room.id));
    setPendingWild(null);
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  // Apply incoming moves
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyWC(s, m.payload as WCPayload, playerIds);
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  // Game over
  useEffect(() => {
    if (!gs.winner || useGameStore.getState().result) return;
    useGameStore.getState().setResult({ winnerId: gs.winner, reason: "empty hand" });
  }, [gs.winner]);

  const emit = useCallback((payload: WCPayload) => {
    setGs(prev => applyWC(prev, payload, playerIds));
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const isMyTurn = playerIds[gs.currentPlayerIdx] === myId;
  const myHand   = gs.hands[myId ?? ""] ?? [];
  const topCard  = gs.discardPile[gs.discardPile.length - 1];

  const canDeal   = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");
  const mustDraw  = isMyTurn && gs.pendingDraw > 0 && !gs.drawPhase;
  const canDraw   = isMyTurn && !gs.drawPhase && gs.pendingDraw === 0;
  const canPass   = isMyTurn && gs.drawPhase;

  function handleCardClick(cardIdx: number) {
    if (!isMyTurn || gs.phase !== "playing") return;
    if (gs.pendingDraw > 0) return; // must draw first
    if (gs.drawPhase && cardIdx !== myHand.length - 1) return; // only drawn card playable
    const card = myHand[cardIdx];
    if (!card || !topCard) return;
    if (!canPlay(card, gs.currentColor, topCard)) return;
    if (card.color === "wild") {
      setPendingWild(cardIdx);
    } else {
      emit({ type: "play", cardIdx });
    }
  }

  function handleColorChosen(chosenColor: Color) {
    if (pendingWild === null) return;
    emit({ type: "play", cardIdx: pendingWild, chosenColor });
    setPendingWild(null);
  }

  // Status text
  const curName = storeP.find(p => p.id === playerIds[gs.currentPlayerIdx])?.name ?? "Opponent";
  let statusText =
    gs.phase === "waiting"   ? (isHost ? "Deal to start" : "Waiting for host to deal…") :
    gs.phase === "finished"  ? (gs.winner === myId ? "You win! 🎉" : `${storeP.find(p=>p.id===gs.winner)?.name??"Opponent"} wins!`) :
    mustDraw                 ? `Draw ${gs.pendingDraw} — penalty from last card` :
    canPass                  ? "Play drawn card or pass" :
    isMyTurn                 ? "Your turn" :
    `${curName}'s turn`;

  const others = playerIds.filter(id => id !== myId);

  return (
    <div className="flex flex-col items-center gap-5 select-none">
      {pendingWild !== null && <ColorChooser onChoose={handleColorChosen}/>}

      {/* Status */}
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
                  {hand.length === 1 && <span className="ml-1 text-yellow-400 font-bold animate-pulse">UNO!</span>}
                </span>
                <div className="flex" style={{gap: -10}}>
                  {Array.from({length: Math.min(hand.length, 12)}, (_, i) => (
                    <div key={i} style={{marginLeft: i > 0 ? -14 : 0}}>
                      <CardBack small/>
                    </div>
                  ))}
                  {hand.length > 12 && (
                    <span className="self-center ml-2 text-xs text-arena-text-muted">+{hand.length-12}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Centre: draw pile | current colour + discard */}
      <div className="flex items-center gap-5">
        {/* Draw pile */}
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => { if (mustDraw || canDraw) emit({ type: "draw" }); }}
            disabled={!mustDraw && !canDraw}
            className={cn(
              "transition-all duration-150",
              (mustDraw || canDraw) && "hover:scale-105 hover:-translate-y-1 cursor-pointer",
            )}
          >
            <CardBack/>
          </button>
          <span className="text-[9px] text-arena-text-muted">{gs.deck.length} left</span>
          {(mustDraw || canDraw) && (
            <span className="text-[10px] font-semibold text-arena-accent animate-pulse">
              {mustDraw ? `Draw ${gs.pendingDraw}` : "Draw"}
            </span>
          )}
        </div>

        {/* Discard + colour indicator */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-full border border-white/20 shadow", COLOR_DOT[gs.currentColor])}/>
            <span className="text-[10px] capitalize text-arena-text-muted font-medium">{gs.currentColor}</span>
            <span className="text-[10px] text-arena-text-muted">
              {gs.direction === 1 ? "↻" : "↺"}
            </span>
          </div>
          {topCard
            ? <CardFace card={topCard} playable={false}/>
            : <div className="w-[54px] h-[78px] rounded-xl border-2 border-dashed border-arena-border opacity-30"/>}
        </div>
      </div>

      {/* Action buttons */}
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
            {myHand.length === 1 && <span className="ml-2 font-bold text-yellow-400 animate-pulse">UNO!</span>}
          </span>
          <div className="flex gap-1.5 overflow-x-auto pb-6 pt-6 px-4 justify-center flex-wrap max-w-[520px]">
            {myHand.map((card, idx) => {
              const isDrawnCard = gs.drawPhase && idx === myHand.length - 1;
              const isPlayable  = isMyTurn && !gs.pendingDraw
                && canPlay(card, gs.currentColor, topCard ?? { color: "red", value: "0" })
                && (!gs.drawPhase || isDrawnCard);
              return (
                <CardFace
                  key={idx}
                  card={card}
                  playable={isPlayable}
                  lifted={isDrawnCard && gs.drawPhase}
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
