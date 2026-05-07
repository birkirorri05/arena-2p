"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type PCard = { suit: Suit; rank: Rank };

interface PokerState {
  seedBase: string;
  round: number;
  deck: PCard[];
  hands: Record<string, PCard[]>;     // hole cards (2 per player)
  community: PCard[];                  // 0–5 community cards
  chips: Record<string, number>;
  bets: Record<string, number>;        // current-street bets
  pot: number;
  currentBet: number;
  dealerIdx: number;
  currentPlayerIdx: number;
  activePlayers: string[];
  allInPlayers: string[];
  actedThisRound: string[];
  phase: "waiting"|"preflop"|"flop"|"turn"|"river"|"showdown"|"finished";
  lastMsg: string;
  winner: string | null;              // null = tie, use handScores
  handScores: Record<string, number>;
}

type PokerPayload =
  | { type: "deal"; ts: number }
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "raise"; to: number }   // total bet amount after raise
  | { type: "allin" };

// ── Constants ──────────────────────────────────────────────────────────────

const STARTING_CHIPS = 500;
const SB = 5, BB = 10;

// ── Deck ───────────────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♠","♥","♦","♣"];
const RANKS: Rank[] = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VALUE: Record<Rank, number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14,
};

function buildDeck(): PCard[] {
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

// ── Hand evaluation ────────────────────────────────────────────────────────

function combos5(cards: PCard[]): PCard[][] {
  const out: PCard[][] = [];
  const n = cards.length;
  for (let a=0; a<n-4; a++)
  for (let b=a+1; b<n-3; b++)
  for (let c=b+1; c<n-2; c++)
  for (let d=c+1; d<n-1; d++)
  for (let e=d+1; e<n; e++)
    out.push([cards[a],cards[b],cards[c],cards[d],cards[e]]);
  return out;
}

function score5(hand: PCard[]): number {
  const rv = hand.map(c => RANK_VALUE[c.rank]).sort((a,b) => b-a);
  const flush = new Set(hand.map(c => c.suit)).size === 1;
  const cnt = new Map<number,number>();
  for (const v of rv) cnt.set(v, (cnt.get(v)??0)+1);
  const grps = [...cnt.entries()].sort((a,b) => b[1]-a[1] || b[0]-a[0]);
  const [c0,c1] = grps.map(g=>g[1]);
  const [r0,r1,r2,r3] = grps.map(g=>g[0]);

  // Straight detection (including wheel A-2-3-4-5)
  let straight = false, strHigh = rv[0];
  if (new Set(rv).size === 5) {
    if (rv[0]-rv[4] === 4) straight = true;
    if (rv[0]===14 && rv[1]===5 && rv[2]===4 && rv[3]===3 && rv[4]===2) {
      straight = true; strHigh = 5;
    }
  }

  const enc = (cat: number, ...tb: number[]) =>
    cat*1e12 + tb.reduce((s,v,i) => s + v*Math.pow(100,8-i), 0);

  if (flush && straight && strHigh === 14) return enc(9);           // Royal flush
  if (flush && straight)                   return enc(8, strHigh);  // Straight flush
  if (c0===4)                              return enc(7, r0, r1);   // Four of a kind
  if (c0===3 && c1===2)                    return enc(6, r0, r1);   // Full house
  if (flush)                               return enc(5, ...rv);    // Flush
  if (straight)                            return enc(4, strHigh);  // Straight
  if (c0===3)                              return enc(3, r0, r1, r2);          // Trips
  if (c0===2 && c1===2)                    return enc(2, r0, r1, r2);          // Two pair
  if (c0===2)                              return enc(1, r0, r1, r2, r3);      // One pair
  return enc(0, ...rv);                                                         // High card
}

function bestHand7(hole: PCard[], community: PCard[]): number {
  const all = [...hole, ...community];
  return Math.max(...combos5(all).map(score5));
}

const HAND_NAMES = [
  "High Card","One Pair","Two Pair","Trips","Straight",
  "Flush","Full House","Quads","Straight Flush","Royal Flush",
];
function handLabel(score: number): string {
  return HAND_NAMES[Math.floor(score / 1e12)] ?? "";
}

// ── Game helpers ───────────────────────────────────────────────────────────

function isRoundOver(state: PokerState): boolean {
  const { activePlayers, allInPlayers, actedThisRound, currentBet, bets } = state;
  if (activePlayers.length <= 1) return true;
  const canAct = activePlayers.filter(id => !allInPlayers.includes(id));
  if (canAct.length <= 1 && canAct.every(id => (bets[id]??0) >= currentBet)) return true;
  if (!canAct.every(id => actedThisRound.includes(id))) return false;
  return canAct.every(id => (bets[id]??0) === currentBet);
}

function firstPostFlop(state: PokerState, playerIds: string[]): number {
  const n = playerIds.length;
  for (let i = 1; i <= n; i++) {
    const idx = (state.dealerIdx + i) % n;
    if (state.activePlayers.includes(playerIds[idx])) return idx;
  }
  return state.currentPlayerIdx;
}

function nextActive(state: PokerState, playerIds: string[]): number {
  const n = playerIds.length;
  let idx = (state.currentPlayerIdx + 1) % n;
  for (let i = 0; i < n; i++) {
    if (state.activePlayers.includes(playerIds[idx]) && !state.allInPlayers.includes(playerIds[idx])) return idx;
    idx = (idx + 1) % n;
  }
  return state.currentPlayerIdx;
}

// ── State machine ──────────────────────────────────────────────────────────

function initState(roomId: string): PokerState {
  return {
    seedBase: roomId, round: 0, deck: [], hands: {}, community: [],
    chips: {}, bets: {}, pot: 0, currentBet: 0,
    dealerIdx: 0, currentPlayerIdx: 0,
    activePlayers: [], allInPlayers: [], actedThisRound: [],
    phase: "waiting", lastMsg: "", winner: null, handScores: {},
  };
}

function collectBets(state: PokerState, playerIds: string[]): PokerState {
  const betSum = Object.values(state.bets).reduce((s,v)=>s+v,0);
  const bets: Record<string,number> = {};
  for (const id of playerIds) bets[id] = 0;
  return { ...state, pot: state.pot + betSum, bets, currentBet: 0 };
}

function showdown(state: PokerState, playerIds: string[]): PokerState {
  const s = collectBets(state, playerIds);
  const scores: Record<string,number> = {};
  for (const id of s.activePlayers) {
    scores[id] = bestHand7(s.hands[id]??[], s.community);
  }
  const maxScore = Math.max(...Object.values(scores));
  const winners = s.activePlayers.filter(id => scores[id] === maxScore);
  const share = Math.floor(s.pot / winners.length);
  const chips = { ...s.chips };
  for (const w of winners) chips[w] = (chips[w]??0) + share;
  const winner = winners.length === 1 ? winners[0] : null;
  const label = handLabel(maxScore);
  return { ...s, chips, pot: 0, phase: "finished", winner, handScores: scores,
    lastMsg: `${winners.map(w=>playerIds.indexOf(w)+1).map(n=>`P${n}`).join(' & ')} win${winners.length>1?"":"s"} (${label})` };
}

function endStreet(state: PokerState, playerIds: string[]): PokerState {
  if (state.activePlayers.length <= 1) {
    const s = collectBets(state, playerIds);
    const winnerId = s.activePlayers[0];
    const chips = { ...s.chips, [winnerId]: (s.chips[winnerId]??0) + s.pot };
    return { ...s, chips, pot: 0, phase: "finished", winner: winnerId, handScores: {},
      lastMsg: `P${playerIds.indexOf(winnerId)+1} wins — everyone else folded` };
  }
  const s = collectBets(state, playerIds);
  const fp = firstPostFlop(s, playerIds);
  switch (s.phase) {
    case "preflop":
      return { ...s, community: s.deck.slice(0,3), deck: s.deck.slice(3), phase: "flop",
        currentPlayerIdx: fp, actedThisRound: [], lastMsg: "Flop" };
    case "flop":
      return { ...s, community: [...s.community, s.deck[0]], deck: s.deck.slice(1), phase: "turn",
        currentPlayerIdx: fp, actedThisRound: [], lastMsg: "Turn" };
    case "turn":
      return { ...s, community: [...s.community, s.deck[0]], deck: s.deck.slice(1), phase: "river",
        currentPlayerIdx: fp, actedThisRound: [], lastMsg: "River" };
    case "river":
      return showdown(s, playerIds);
    default: return s;
  }
}

function afterAction(state: PokerState, playerIds: string[]): PokerState {
  if (isRoundOver(state)) return endStreet(state, playerIds);
  return { ...state, currentPlayerIdx: nextActive(state, playerIds) };
}

function applyDeal(state: PokerState, playerIds: string[], ts: number): PokerState {
  const n = playerIds.length;
  let deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const hands: Record<string,PCard[]> = {};
  for (const id of playerIds) hands[id] = [];
  for (let p = 0; p < 2; p++) {
    for (const id of playerIds) { hands[id].push(deck[0]); deck = deck.slice(1); }
  }

  const dealerIdx = (state.dealerIdx + 1) % n;
  const sbIdx = n === 2 ? dealerIdx : (dealerIdx + 1) % n;
  const bbIdx = n === 2 ? (dealerIdx+1)%n : (dealerIdx + 2) % n;

  const chips = { ...state.chips };
  const bets: Record<string,number> = {};
  for (const id of playerIds) {
    chips[id] = chips[id] ?? STARTING_CHIPS;
    bets[id] = 0;
  }

  const sbId = playerIds[sbIdx], bbId = playerIds[bbIdx];
  const sbAmt = Math.min(chips[sbId], SB);
  const bbAmt = Math.min(chips[bbId], BB);
  chips[sbId] -= sbAmt; bets[sbId] = sbAmt;
  chips[bbId] -= bbAmt; bets[bbId] = bbAmt;

  const allIn: string[] = [];
  if (chips[sbId] === 0) allIn.push(sbId);
  if (chips[bbId] === 0) allIn.push(bbId);

  // Pre-flop first to act: UTG = after BB (2-player: dealer/SB goes first)
  const firstIdx = n === 2 ? dealerIdx : (bbIdx + 1) % n;

  return {
    ...state, round: state.round + 1, deck, hands, community: [],
    chips, bets, pot: 0, currentBet: bbAmt,
    dealerIdx, currentPlayerIdx: firstIdx,
    activePlayers: [...playerIds], allInPlayers: allIn,
    actedThisRound: [], phase: "preflop",
    lastMsg: `P${sbIdx+1}:SB(${sbAmt}) P${bbIdx+1}:BB(${bbAmt})`,
    winner: null, handScores: {},
  };
}

function applyPokerAction(state: PokerState, payload: PokerPayload, playerIds: string[]): PokerState {
  const playerId = playerIds[state.currentPlayerIdx];
  const chips = { ...state.chips };
  const bets = { ...state.bets };
  let { currentBet, allInPlayers, actedThisRound } = state;

  if (payload.type === "fold") {
    return afterAction({
      ...state, chips, bets,
      activePlayers: state.activePlayers.filter(id => id !== playerId),
      actedThisRound: [...actedThisRound, playerId],
      lastMsg: `P${state.currentPlayerIdx+1} folds`,
    }, playerIds);
  }

  if (payload.type === "check") {
    if ((bets[playerId]??0) < currentBet) return state;
    return afterAction({
      ...state, chips, bets,
      actedThisRound: [...actedThisRound, playerId],
      lastMsg: `P${state.currentPlayerIdx+1} checks`,
    }, playerIds);
  }

  if (payload.type === "call") {
    const need = currentBet - (bets[playerId]??0);
    const add  = Math.min(chips[playerId], need);
    chips[playerId] -= add; bets[playerId] = (bets[playerId]??0) + add;
    if (chips[playerId] === 0 && !allInPlayers.includes(playerId)) allInPlayers = [...allInPlayers, playerId];
    return afterAction({
      ...state, chips, bets, allInPlayers,
      actedThisRound: [...actedThisRound, playerId],
      lastMsg: `P${state.currentPlayerIdx+1} calls ${add}`,
    }, playerIds);
  }

  if (payload.type === "raise") {
    const target = Math.min(payload.to, (bets[playerId]??0) + chips[playerId]);
    const add = target - (bets[playerId]??0);
    chips[playerId] -= add; bets[playerId] = target; currentBet = target;
    if (chips[playerId] === 0 && !allInPlayers.includes(playerId)) allInPlayers = [...allInPlayers, playerId];
    return afterAction({
      ...state, chips, bets, currentBet, allInPlayers,
      actedThisRound: [playerId],   // everyone else must re-act
      lastMsg: `P${state.currentPlayerIdx+1} raises to ${target}`,
    }, playerIds);
  }

  if (payload.type === "allin") {
    const add = chips[playerId];
    chips[playerId] = 0;
    bets[playerId] = (bets[playerId]??0) + add;
    if (bets[playerId] > currentBet) currentBet = bets[playerId];
    if (!allInPlayers.includes(playerId)) allInPlayers = [...allInPlayers, playerId];
    const cleared = bets[playerId] > state.currentBet ? [playerId] : [...actedThisRound, playerId];
    return afterAction({
      ...state, chips, bets, currentBet, allInPlayers,
      actedThisRound: cleared,
      lastMsg: `P${state.currentPlayerIdx+1} goes all-in (${bets[playerId]})`,
    }, playerIds);
  }

  return state;
}

function applyPoker(state: PokerState, payload: PokerPayload, playerIds: string[]): PokerState {
  if (payload.type === "deal" && (state.phase === "waiting" || state.phase === "finished"))
    return applyDeal(state, playerIds, payload.ts);
  if (!["preflop","flop","turn","river"].includes(state.phase)) return state;
  return applyPokerAction(state, payload, playerIds);
}

// ── Card visuals ───────────────────────────────────────────────────────────

function isRed(suit: Suit) { return suit === "♥" || suit === "♦"; }

function PCardFace({ card, small = false }: { card: PCard; small?: boolean }) {
  const col = isRed(card.suit) ? "#dc2626" : "#111827";
  const w = small ? 40 : 56, h = small ? 58 : 80;
  return (
    <div className="relative flex-shrink-0 rounded-xl border-2 border-gray-200 bg-white shadow"
      style={{ width: w, height: h }}>
      <div className="absolute top-1 left-1.5 leading-tight font-bold" style={{ color: col, fontSize: small ? 8 : 11 }}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ color: col, fontSize: small ? 20 : 28 }} className="font-bold">{card.suit}</span>
      </div>
      <div className="absolute bottom-1 right-1.5 leading-tight font-bold rotate-180" style={{ color: col, fontSize: small ? 8 : 11 }}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
    </div>
  );
}

function PCardBack({ small = false }: { small?: boolean }) {
  const w = small ? 40 : 56, h = small ? 58 : 80;
  return (
    <div className="relative flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-white/20 overflow-hidden bg-[#1e3a8a] shadow"
      style={{ width: w, height: h }}>
      <div className="absolute inset-2 rounded-lg bg-[repeating-linear-gradient(45deg,#1e3a8a,#1e3a8a_3px,#3b5bdb_3px,#3b5bdb_6px)]"/>
      <span className="relative text-white font-black text-[10px]">♠</span>
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────

export default function PokerBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;
  const myIdx  = playerIds.indexOf(myId ?? "");

  const [gs, setGs] = useState<PokerState>(() => initState(room.id));

  useEffect(() => {
    setGs(initState(room.id));
    appliedRef.current = 0;
  }, [room.hostId, room.id]);

  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyPoker(s, m.payload as PokerPayload, playerIds);
      return s;
    });
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  useEffect(() => {
    if (gs.phase !== "finished" || useGameStore.getState().result) return;
    const winnerId = gs.winner;
    useGameStore.getState().setResult({ winnerId, reason: "poker" });
  }, [gs.phase, gs.winner]);

  const emit = useCallback((payload: PokerPayload) => {
    setGs(prev => applyPoker(prev, payload, playerIds));
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const isMyTurn = playerIds[gs.currentPlayerIdx] === myId && ["preflop","flop","turn","river"].includes(gs.phase);
  const myHand   = gs.hands[myId ?? ""] ?? [];
  const myChips  = gs.chips[myId ?? ""] ?? 0;
  const myBet    = gs.bets[myId ?? ""] ?? 0;
  const toCall   = Math.max(0, gs.currentBet - myBet);
  const canCheck = isMyTurn && toCall === 0 && !gs.allInPlayers.includes(myId ?? "");
  const canCall  = isMyTurn && toCall > 0 && myChips > 0;
  const canRaise = isMyTurn && myChips > toCall;
  const canDeal  = room.status === "playing" && isHost && (gs.phase === "waiting" || gs.phase === "finished");

  // Raise options (to total bet amounts)
  const minRaise = gs.currentBet + Math.max(BB, gs.currentBet - (gs.bets[playerIds.find(id=>id!==myId&&gs.activePlayers.includes(id))??""]??0));
  const potRaise = gs.pot + Object.values(gs.bets).reduce((s,v)=>s+v,0) + toCall;
  const raise2x  = gs.currentBet * 2;
  const raise3x  = gs.currentBet * 3;
  const maxBet   = myBet + myChips;

  const phases = ["preflop","flop","turn","river","showdown","finished"];
  const phaseLabel = gs.phase === "preflop" ? "Pre-Flop"
    : gs.phase === "flop" ? "Flop" : gs.phase === "turn" ? "Turn"
    : gs.phase === "river" ? "River" : gs.phase === "showdown" ? "Showdown"
    : gs.phase === "finished" ? "Hand Over" : "";

  const pName = (id: string) => storeP.find(p => p.id === id)?.name ?? `P${playerIds.indexOf(id)+1}`;

  return (
    <div className="flex flex-col items-center gap-4 select-none bg-green-950/20 rounded-xl p-4">
      {/* Phase + status */}
      <div className="flex items-center gap-3">
        {phaseLabel && (
          <span className="rounded-full bg-green-800/60 px-3 py-0.5 text-xs font-bold text-green-300 uppercase tracking-wide">
            {phaseLabel}
          </span>
        )}
        <span className="text-xs text-arena-text-muted">{gs.lastMsg}</span>
      </div>

      {/* Opponent panels */}
      <div className="flex flex-wrap gap-4 justify-center">
        {playerIds.filter(id => id !== myId).map(id => {
          const idx = playerIds.indexOf(id);
          const isDealer = idx === gs.dealerIdx;
          const isTurn   = playerIds[gs.currentPlayerIdx] === id && ["preflop","flop","turn","river"].includes(gs.phase);
          const folded   = !gs.activePlayers.includes(id);
          const hand     = gs.hands[id] ?? [];
          const chips    = gs.chips[id] ?? 0;
          const bet      = gs.bets[id] ?? 0;
          const score    = gs.handScores[id];
          return (
            <div key={id} className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all min-w-[120px]",
              isTurn ? "border-yellow-400/60 bg-yellow-400/5" : "border-arena-border bg-arena-surface/40",
              folded && "opacity-40",
            )}>
              <div className="flex items-center gap-1.5">
                {isDealer && <span className="rounded-full bg-white text-black text-[8px] font-black px-1.5 py-0.5">D</span>}
                <span className={cn("text-[11px] font-semibold", isTurn ? "text-yellow-400" : "text-arena-text-muted")}>
                  {isTurn ? "▸ " : ""}{pName(id)}
                </span>
              </div>
              <div className="flex gap-1">
                {hand.length === 0
                  ? <span className="text-[9px] text-arena-text-muted italic">no cards</span>
                  : gs.phase === "showdown" || gs.phase === "finished" && gs.handScores[id]
                    ? hand.map((c,i) => <PCardFace key={i} card={c} small/>)
                    : hand.map((_,i) => <PCardBack key={i} small/>)}
              </div>
              {score != null && (
                <span className="text-[9px] font-bold text-yellow-300">{handLabel(score)}</span>
              )}
              <div className="text-[9px] text-arena-text-muted">
                {folded ? "Folded" : `${chips} chips${bet ? ` | bet ${bet}` : ""}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Community + Pot */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2">
          {Array.from({length:5}, (_, i) => {
            const card = gs.community[i];
            return card
              ? <PCardFace key={i} card={card}/>
              : <div key={i} className="w-[56px] h-[80px] rounded-xl border-2 border-dashed border-green-800/40 opacity-40"/>;
          })}
        </div>
        <div className="text-sm font-bold text-arena-text">
          Pot: {gs.pot + Object.values(gs.bets).reduce((s,v)=>s+v,0)}
        </div>
      </div>

      {/* My panel */}
      <div className={cn(
        "flex flex-col items-center gap-2 rounded-xl border p-3 w-full max-w-sm",
        isMyTurn ? "border-yellow-400/60 bg-yellow-400/5" : "border-arena-border bg-arena-surface/40",
      )}>
        <div className="flex items-center gap-2">
          {myIdx === gs.dealerIdx && (
            <span className="rounded-full bg-white text-black text-[8px] font-black px-1.5 py-0.5">D</span>
          )}
          <span className="text-[11px] font-semibold text-arena-text-muted">
            {isMyTurn ? "▸ " : ""}You — {myChips} chips{myBet ? ` | bet ${myBet}` : ""}
          </span>
          {gs.handScores[myId ?? ""] != null && (
            <span className="text-[9px] font-bold text-yellow-300">{handLabel(gs.handScores[myId ?? ""]!)}</span>
          )}
        </div>

        {/* My hole cards */}
        <div className="flex gap-2">
          {myHand.length > 0
            ? myHand.map((c,i) => <PCardFace key={i} card={c}/>)
            : gs.phase !== "waiting" && gs.phase !== "finished"
              ? <span className="text-[10px] text-arena-text-muted italic">no cards</span>
              : null}
        </div>

        {/* Actions */}
        {isMyTurn && (
          <div className="flex flex-wrap gap-1.5 justify-center">
            <button onClick={() => emit({ type: "fold" })}
              className="rounded-lg bg-red-700 hover:bg-red-600 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-all">
              Fold
            </button>
            {canCheck && (
              <button onClick={() => emit({ type: "check" })}
                className="rounded-lg bg-arena-surface border border-arena-border hover:bg-arena-border px-4 py-1.5 text-xs font-bold text-arena-text active:scale-95 transition-all">
                Check
              </button>
            )}
            {canCall && (
              <button onClick={() => emit({ type: "call" })}
                className="rounded-lg bg-blue-700 hover:bg-blue-600 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-all">
                Call {Math.min(toCall, myChips)}
              </button>
            )}
            {canRaise && raise2x <= maxBet && raise2x > gs.currentBet && (
              <button onClick={() => emit({ type: "raise", to: raise2x })}
                className="rounded-lg bg-amber-600 hover:bg-amber-500 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-all">
                Raise {raise2x}
              </button>
            )}
            {canRaise && raise3x <= maxBet && raise3x > raise2x && (
              <button onClick={() => emit({ type: "raise", to: raise3x })}
                className="rounded-lg bg-orange-600 hover:bg-orange-500 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-all">
                Raise {raise3x}
              </button>
            )}
            {canRaise && (
              <button onClick={() => emit({ type: "allin" })}
                className="rounded-lg bg-purple-700 hover:bg-purple-600 px-4 py-1.5 text-xs font-bold text-white active:scale-95 transition-all">
                All-In {myBet + myChips}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Deal / New Hand */}
      {canDeal && (
        <button onClick={() => emit({ type: "deal", ts: Date.now() })}
          className="rounded-lg bg-arena-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow">
          {gs.phase === "finished" ? "New Hand" : "Deal"}
        </button>
      )}

      {/* Chip summary after hand */}
      {gs.phase === "finished" && (
        <div className="flex flex-wrap gap-3 justify-center text-[10px] text-arena-text-muted">
          {playerIds.map(id => (
            <span key={id} className={cn(id === gs.winner && "text-yellow-400 font-bold")}>
              {pName(id)}: {gs.chips[id]??0}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
