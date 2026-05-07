"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type SCard = { suit: Suit; rank: Rank };

interface SnapState {
  seedBase: string;
  round: number;
  piles: Record<string, SCard[]>;  // each player's draw pile (face-down)
  central: SCard[];                 // face-up pile in the middle
  currentFlipper: number;           // index into playerIds — whose turn to flip
  phase: "waiting" | "playing" | "finished";
  lastMsg: string;
  winner: string | null;
}

type SnapPayload =
  | { type: "deal"; ts: number }
  | { type: "flip" }
  | { type: "snap" };

// ── Deck ───────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠","♥","♦","♣"];
const RANKS: Rank[] = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

function buildDeck(): SCard[] {
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

function isMatch(central: SCard[]): boolean {
  return central.length >= 2
    && central[central.length - 1].rank === central[central.length - 2].rank;
}

function checkWin(state: SnapState, playerIds: string[]): SnapState {
  // A player wins when the opponent has no cards left
  for (const id of playerIds) {
    const opp = playerIds.find(p => p !== id);
    if (opp && (state.piles[opp]?.length ?? 0) === 0 && state.central.length === 0) {
      return { ...state, phase: "finished", winner: id };
    }
  }
  return state;
}

function applyDeal(state: SnapState, playerIds: string[], ts: number): SnapState {
  const deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const n = playerIds.length;
  const perPlayer = Math.floor(deck.length / n);
  const piles: Record<string, SCard[]> = {};
  for (let i = 0; i < n; i++) {
    piles[playerIds[i]] = deck.slice(i * perPlayer, (i + 1) * perPlayer);
  }
  return {
    ...state, round: state.round + 1, piles, central: [],
    currentFlipper: 0, phase: "playing",
    lastMsg: `${perPlayer} cards each — ${playerIds[0] === state.seedBase ? "P1" : "P1"} flips first`,
    winner: null,
  };
}

function applyFlip(state: SnapState, playerId: string, playerIds: string[]): SnapState {
  // Only the current flipper can flip
  if (playerIds[state.currentFlipper] !== playerId) return state;

  const pile = state.piles[playerId] ?? [];
  if (pile.length === 0) {
    // Out of cards — opponent wins
    const winner = playerIds.find(id => id !== playerId) ?? null;
    return { ...state, phase: "finished", winner, lastMsg: `${pLabel(playerId, playerIds)} ran out of cards!` };
  }

  const [top, ...remaining] = pile;
  const central = [...state.central, top];
  const nextFlipper = (state.currentFlipper + 1) % playerIds.length;
  const match = isMatch(central);

  let s: SnapState = {
    ...state,
    piles: { ...state.piles, [playerId]: remaining },
    central, currentFlipper: nextFlipper,
    lastMsg: match
      ? `⚡ ${pLabel(playerId, playerIds)} flipped ${top.rank} — MATCH! SNAP!`
      : `${pLabel(playerId, playerIds)} flipped ${top.rank}`,
  };

  // If central has grown very large with no snapping, auto-end is not needed —
  // players just need to snap or keep flipping
  return checkWin(s, playerIds);
}

function applySnap(state: SnapState, playerId: string, playerIds: string[]): SnapState {
  if (isMatch(state.central)) {
    // Correct snap — win the central pile
    const myPile = [...(state.piles[playerId] ?? []), ...state.central];
    const s: SnapState = {
      ...state,
      piles: { ...state.piles, [playerId]: myPile },
      central: [],
      // After winning the snap, it's the other player's turn to flip first
      currentFlipper: playerIds.indexOf(playerIds.find(id => id !== playerId) ?? playerId),
      lastMsg: `⚡ SNAP! ${pLabel(playerId, playerIds)} wins ${state.central.length} cards!`,
    };
    return checkWin(s, playerIds);
  } else {
    // False snap — penalty: give 3 cards to the central pile
    const myPile = state.piles[playerId] ?? [];
    const penalty = Math.min(3, myPile.length);
    if (penalty === 0) return { ...state, lastMsg: `${pLabel(playerId, playerIds)} false-snapped (no cards to give)` };

    const s: SnapState = {
      ...state,
      piles: { ...state.piles, [playerId]: myPile.slice(penalty) },
      central: [...state.central, ...myPile.slice(0, penalty)],
      lastMsg: `False snap! ${pLabel(playerId, playerIds)} gives ${penalty} card${penalty !== 1 ? "s" : ""} to the pile`,
    };
    return checkWin(s, playerIds);
  }
}

function pLabel(id: string, playerIds: string[]): string {
  return `P${playerIds.indexOf(id) + 1}`;
}

function applyMove(state: SnapState, payload: SnapPayload, playerId: string, playerIds: string[]): SnapState {
  if (payload.type === "deal" && (state.phase === "waiting" || state.phase === "finished"))
    return applyDeal(state, playerIds, payload.ts);
  if (state.phase !== "playing") return state;
  if (payload.type === "flip") return applyFlip(state, playerId, playerIds);
  if (payload.type === "snap") return applySnap(state, playerId, playerIds);
  return state;
}

// ── Card visuals ───────────────────────────────────────────────────────────

function isRed(suit: Suit) { return suit === "♥" || suit === "♦"; }

function CardFace({ card, large = false }: { card: SCard; large?: boolean }) {
  const col = isRed(card.suit) ? "#dc2626" : "#111827";
  const w = large ? 80 : 54, h = large ? 112 : 78;
  return (
    <div className="relative flex-shrink-0 rounded-xl border-2 border-gray-200 bg-white shadow-md"
      style={{ width: w, height: h }}>
      <div className="absolute top-1.5 left-2 leading-tight font-bold" style={{ color: col, fontSize: large ? 14 : 10 }}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ color: col, fontSize: large ? 36 : 26 }} className="font-bold select-none">{card.suit}</span>
      </div>
      <div className="absolute bottom-1.5 right-2 leading-tight font-bold rotate-180" style={{ color: col, fontSize: large ? 14 : 10 }}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
    </div>
  );
}

function CardBack({ count = 1, large = false }: { count?: number; large?: boolean }) {
  const w = large ? 80 : 54, h = large ? 112 : 78;
  const layers = Math.min(5, count);
  return (
    <div className="relative" style={{ width: w + layers * 2, height: h + layers * 2 }}>
      {Array.from({ length: layers }, (_, i) => (
        <div key={i}
          className="absolute flex items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden bg-[#1e3a8a] shadow"
          style={{ width: w, height: h, left: (layers - 1 - i) * 2, top: (layers - 1 - i) * 2 }}>
          <div className="absolute inset-2 rounded-lg bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_3px,#3b5bdb_3px,#3b5bdb_6px)]"/>
          {i === layers - 1 && (
            <span className="relative text-white font-black text-[9px] drop-shadow">♠</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────

export default function SnapBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;

  const [gs, setGs] = useState<SnapState>(() => ({
    seedBase: room.id, round: 0, piles: {}, central: [],
    currentFlipper: 0, phase: "waiting", lastMsg: "", winner: null,
  }));

  useEffect(() => {
    setGs({ seedBase: room.id, round: 0, piles: {}, central: [], currentFlipper: 0, phase: "waiting", lastMsg: "", winner: null });
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  // Apply moves from the store (opponent's moves)
  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) {
        s = applyMove(s, m.payload as SnapPayload, m.playerId, playerIds);
      }
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  useEffect(() => {
    if (!gs.winner || useGameStore.getState().result) return;
    useGameStore.getState().setResult({ winnerId: gs.winner, reason: "all cards collected" });
  }, [gs.winner]);

  const emit = useCallback((payload: SnapPayload) => {
    setGs(prev => applyMove(prev, payload, myId ?? "", playerIds));
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const isMyTurnToFlip = gs.phase === "playing" && playerIds[gs.currentFlipper] === myId;
  const myPile         = gs.piles[myId ?? ""] ?? [];
  const match          = isMatch(gs.central);
  const topCard        = gs.central.length > 0 ? gs.central[gs.central.length - 1] : null;
  const secondCard     = gs.central.length > 1 ? gs.central[gs.central.length - 2] : null;
  const canDeal        = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");
  const canFlip        = room.status === "playing" && isMyTurnToFlip;
  const canSnap        = room.status === "playing" && gs.phase === "playing";

  const others = playerIds.filter(id => id !== myId);
  const pName  = (id: string) => storeP.find(p => p.id === id)?.name ?? `P${playerIds.indexOf(id)+1}`;

  return (
    <div className="flex flex-col items-center gap-5 select-none">

      {/* Match banner */}
      {match && gs.phase === "playing" && (
        <div className="flex items-center gap-2 rounded-xl bg-red-600/20 border border-red-500/40 px-5 py-2 animate-pulse">
          <span className="text-2xl">⚡</span>
          <span className="text-red-400 font-black text-lg tracking-wider">SNAP!</span>
          <span className="text-2xl">⚡</span>
        </div>
      )}

      {/* Status */}
      {!match && (
        <p className="text-sm font-medium text-arena-text-muted text-center">{
          gs.phase === "waiting"  ? (isHost ? "Deal to start" : "Waiting for host…") :
          gs.phase === "finished" ? (gs.winner === myId ? "You win! 🎉" : `${pName(gs.winner!)} wins!`) :
          isMyTurnToFlip ? "Your turn — Flip!" :
          `${pName(playerIds[gs.currentFlipper])}'s turn to flip`
        }</p>
      )}

      {/* Last action */}
      {gs.lastMsg && gs.phase === "playing" && (
        <p className="text-[10px] text-arena-text-muted">{gs.lastMsg}</p>
      )}

      {/* Opponents */}
      <div className="flex flex-wrap gap-6 justify-center">
        {others.map(id => {
          const pile = gs.piles[id] ?? [];
          const isFlipper = playerIds[gs.currentFlipper] === id && gs.phase === "playing";
          return (
            <div key={id} className="flex flex-col items-center gap-2">
              <span className={cn("text-[11px] font-semibold", isFlipper ? "text-yellow-400" : "text-arena-text-muted")}>
                {isFlipper ? "▸ " : ""}{pName(id)} — {pile.length} card{pile.length !== 1 ? "s" : ""}
              </span>
              {pile.length > 0
                ? <CardBack count={pile.length}/>
                : <div className="w-14 h-20 rounded-xl border-2 border-dashed border-arena-border opacity-30"/>}
            </div>
          );
        })}
      </div>

      {/* Central pile */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] text-arena-text-muted uppercase tracking-wide font-semibold">
          Central pile — {gs.central.length} card{gs.central.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-3">
          {secondCard && (
            <div className="opacity-60 -mr-8 mt-2">
              <CardFace card={secondCard} large/>
            </div>
          )}
          {topCard
            ? <div className={cn("transition-all", match && "drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]")}>
                <CardFace card={topCard} large/>
              </div>
            : <div className="w-20 h-28 rounded-xl border-2 border-dashed border-arena-border opacity-30 flex items-center justify-center">
                <span className="text-[9px] text-arena-text-muted">empty</span>
              </div>}
        </div>
      </div>

      {/* My pile + actions */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-arena-text-muted">Your pile — {myPile.length}</span>
            {myPile.length > 0
              ? <CardBack count={myPile.length}/>
              : <div className="w-14 h-20 rounded-xl border-2 border-dashed border-arena-border opacity-30"/>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          {canFlip && (
            <button onClick={() => emit({ type: "flip" })}
              className="rounded-xl bg-arena-accent hover:bg-arena-accent-hover px-8 py-3 font-bold text-white text-sm active:scale-95 transition-all shadow-lg">
              Flip ▶
            </button>
          )}

          {canSnap && (
            <button
              onClick={() => emit({ type: "snap" })}
              className={cn(
                "rounded-xl px-8 py-3 font-black text-lg transition-all active:scale-90 shadow-lg",
                match
                  ? "bg-red-600 hover:bg-red-500 text-white animate-pulse cursor-pointer scale-110 shadow-red-500/50"
                  : "bg-arena-surface border border-arena-border text-arena-text-muted hover:border-red-500/50 cursor-pointer",
              )}
            >
              ⚡ SNAP!
            </button>
          )}
        </div>

        {!canFlip && gs.phase === "playing" && (
          <p className="text-[10px] text-arena-text-muted">
            Waiting for {pName(playerIds[gs.currentFlipper])} to flip…
          </p>
        )}
      </div>

      {canDeal && (
        <button onClick={() => emit({ type: "deal", ts: Date.now() })}
          className="rounded-lg bg-arena-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow">
          {gs.phase === "finished" ? "Play Again" : "Deal"}
        </button>
      )}
    </div>
  );
}
