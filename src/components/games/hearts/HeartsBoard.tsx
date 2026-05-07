"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

// ── Types ──────────────────────────────────────────────────────────────────

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"J"|"Q"|"K";
type HCard = { suit: Suit; rank: Rank };

interface HeartsState {
  seedBase: string;
  round: number;
  hands: Record<string, HCard[]>;
  passedBy: Record<string, HCard[]>;   // cards each player committed to pass
  trickLeaderIdx: number;
  currentPlayerIdx: number;
  trick: { playerIdx: number; card: HCard }[];
  trickNum: number;                    // 0–12
  heartsBroken: boolean;
  wonCards: Record<string, HCard[]>;
  scores: Record<string, number>;      // cumulative
  phase: "waiting" | "passing" | "playing" | "roundEnd" | "finished";
  lastMsg: string;
  winner: string | null;
}

type HeartsPayload =
  | { type: "deal"; ts: number }
  | { type: "pass"; cards: HCard[] }   // exactly 3 cards
  | { type: "play"; cardIdx: number };

// ── Deck + helpers ─────────────────────────────────────────────────────────

const SUITS: Suit[] = ["♣","♦","♠","♥"];          // display sort order
const RANKS: Rank[] = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const RANK_VAL: Record<Rank,number> = {
  "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14,
};

function buildDeck(): HCard[] {
  return (["♠","♥","♦","♣"] as Suit[]).flatMap(suit => RANKS.map(rank => ({ suit, rank })));
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

const sortHand = (hand: HCard[]) =>
  [...hand].sort((a, b) => (SUITS.indexOf(a.suit)-SUITS.indexOf(b.suit)) || (RANK_VAL[a.rank]-RANK_VAL[b.rank]));

const isHeart  = (c: HCard) => c.suit === "♥";
const isQS     = (c: HCard) => c.suit === "♠" && c.rank === "Q";
const cardPts  = (c: HCard) => isHeart(c) ? 1 : isQS(c) ? 13 : 0;

function passDirection(round: number): "left"|"right"|"across"|"keep" {
  return (["left","right","across","keep"] as const)[(round-1)%4];
}

function passSourceFor(targetIdx: number, n: number, dir: string): number {
  if (dir === "left")   return (targetIdx+n-1)%n;
  if (dir === "right")  return (targetIdx+1)%n;
  if (dir === "across") return (targetIdx+2)%n;
  return targetIdx;
}

function trickWinner(trick: {playerIdx:number;card:HCard}[]): number {
  const ledSuit = trick[0].card.suit;
  let bestVal = -1, winnerIdx = trick[0].playerIdx;
  for (const t of trick) {
    if (t.card.suit === ledSuit) {
      const v = RANK_VAL[t.card.rank];
      if (v > bestVal) { bestVal = v; winnerIdx = t.playerIdx; }
    }
  }
  return winnerIdx;
}

function validIndices(hand: HCard[], trick: {playerIdx:number;card:HCard}[], heartsBroken: boolean, trickNum: number): Set<number> {
  const leading  = trick.length === 0;
  const firstTrick = trickNum === 0;

  if (leading) {
    if (firstTrick) {
      const i = hand.findIndex(c => c.rank === "2" && c.suit === "♣");
      return i >= 0 ? new Set([i]) : new Set();
    }
    if (!heartsBroken && hand.some(c => !isHeart(c)))
      return new Set(hand.flatMap((c,i) => isHeart(c) ? [] : [i]));
    return new Set(hand.map((_,i) => i));
  }

  const ledSuit = trick[0].card.suit;
  if (hand.some(c => c.suit === ledSuit))
    return new Set(hand.flatMap((c,i) => c.suit === ledSuit ? [i] : []));

  // Can't follow suit
  if (firstTrick && hand.some(c => !isHeart(c) && !isQS(c)))
    return new Set(hand.flatMap((c,i) => (!isHeart(c) && !isQS(c)) ? [i] : []));

  return new Set(hand.map((_,i) => i));
}

// ── State machine ──────────────────────────────────────────────────────────

function initState(roomId: string): HeartsState {
  return {
    seedBase: roomId, round: 0, hands: {}, passedBy: {},
    trickLeaderIdx: 0, currentPlayerIdx: 0, trick: [],
    trickNum: 0, heartsBroken: false, wonCards: {}, scores: {},
    phase: "waiting", lastMsg: "", winner: null,
  };
}

function applyDeal(state: HeartsState, playerIds: string[], ts: number): HeartsState {
  const n = playerIds.length;
  const deck = seededShuffle(buildDeck(), `${state.seedBase}:${ts}`);
  const hands: Record<string,HCard[]> = {};
  const wonCards: Record<string,HCard[]> = {};
  for (let i = 0; i < n; i++) {
    hands[playerIds[i]] = sortHand(deck.slice(i*13,(i+1)*13));
    wonCards[playerIds[i]] = [];
  }
  const round = state.round + 1;
  const dir = passDirection(round);
  const phase = dir === "keep" ? "playing" : "passing";

  let startIdx = 0;
  if (phase === "playing") {
    const tc = playerIds.findIndex(id => hands[id].some(c => c.rank==="2"&&c.suit==="♣"));
    startIdx = tc >= 0 ? tc : 0;
  }

  return {
    ...state, round, hands, passedBy: {}, wonCards,
    currentPlayerIdx: startIdx, trickLeaderIdx: startIdx,
    trick: [], trickNum: 0, heartsBroken: false, scores: state.scores,
    phase, winner: null,
    lastMsg: `Round ${round} — ${dir==="keep"?"no pass":`pass ${dir}`}`,
  };
}

function applyPass(state: HeartsState, cards: HCard[], playerId: string, playerIds: string[]): HeartsState {
  if (cards.length !== 3) return state;
  const newPassedBy = { ...state.passedBy, [playerId]: cards };

  if (Object.keys(newPassedBy).length < playerIds.length)
    return { ...state, passedBy: newPassedBy, lastMsg: `${Object.keys(newPassedBy).length}/${playerIds.length} players ready` };

  // Execute pass
  const n = playerIds.length;
  const dir = passDirection(state.round);
  const newHands: Record<string,HCard[]> = {};
  for (let i = 0; i < n; i++) {
    const id = playerIds[i];
    const srcIdx = passSourceFor(i, n, dir);
    const srcId  = playerIds[srcIdx];
    const received = newPassedBy[srcId] ?? [];
    const kept = (state.hands[id]??[]).filter(c => !(newPassedBy[id]??[]).some(p=>p.rank===c.rank&&p.suit===c.suit));
    newHands[id] = sortHand([...kept, ...received]);
  }

  const startIdx = playerIds.findIndex(id => newHands[id].some(c => c.rank==="2"&&c.suit==="♣"));
  const si = startIdx >= 0 ? startIdx : 0;
  return {
    ...state, hands: newHands, passedBy: newPassedBy,
    currentPlayerIdx: si, trickLeaderIdx: si, phase: "playing",
    lastMsg: "Cards passed — P" + (si+1) + " leads with 2♣",
  };
}

function endRound(state: HeartsState, playerIds: string[]): HeartsState {
  const roundPts: Record<string,number> = {};
  for (const id of playerIds) {
    roundPts[id] = (state.wonCards[id]??[]).reduce((s,c)=>s+cardPts(c),0);
  }

  // Shoot the moon: someone got all 26 pts
  const shooter = playerIds.find(id => roundPts[id] === 26);
  if (shooter) {
    for (const id of playerIds) roundPts[id] = id===shooter ? 0 : 26;
  }

  const newScores: Record<string,number> = {};
  for (const id of playerIds) newScores[id] = (state.scores[id]??0) + roundPts[id];

  const gameOver = Object.values(newScores).some(s => s >= 100);
  if (gameOver) {
    const min = Math.min(...Object.values(newScores));
    const winners = playerIds.filter(id => newScores[id] === min);
    return {
      ...state, scores: newScores, phase: "finished",
      winner: winners.length===1 ? winners[0] : null,
      lastMsg: `Game over! ${winners.map(id=>`P${playerIds.indexOf(id)+1}`).join(" & ")} win${winners.length>1?"":"s"} with ${min} pts`,
    };
  }

  const moonMsg = shooter ? ` 🌙 P${playerIds.indexOf(shooter)+1} shoots the moon!` : "";
  return { ...state, scores: newScores, phase: "roundEnd",
    lastMsg: `Round ${state.round} done.${moonMsg} Scores: ${playerIds.map(id=>`P${playerIds.indexOf(id)+1}:${newScores[id]}`).join(" ")}`,
  };
}

function applyPlay(state: HeartsState, cardIdx: number, playerId: string, playerIds: string[]): HeartsState {
  if (playerIds[state.currentPlayerIdx] !== playerId) return state;
  const hand = state.hands[playerId] ?? [];
  const card = hand[cardIdx];
  if (!card) return state;

  const valid = validIndices(hand, state.trick, state.heartsBroken, state.trickNum);
  if (!valid.has(cardIdx)) return state;

  const newHand = hand.filter((_,i) => i !== cardIdx);
  const newTrick = [...state.trick, { playerIdx: state.currentPlayerIdx, card }];
  const heartsBroken = state.heartsBroken || isHeart(card);

  if (newTrick.length < playerIds.length) {
    const next = (state.currentPlayerIdx+1) % playerIds.length;
    return {
      ...state,
      hands: { ...state.hands, [playerId]: newHand },
      trick: newTrick, heartsBroken, currentPlayerIdx: next,
      lastMsg: `P${state.currentPlayerIdx+1} played ${card.rank}${card.suit}`,
    };
  }

  // Trick complete
  const winnerIdx = trickWinner(newTrick);
  const winnerId  = playerIds[winnerIdx];
  const newWon = { ...state.wonCards, [winnerId]: [...(state.wonCards[winnerId]??[]), ...newTrick.map(t=>t.card)] };
  const newHands = { ...state.hands, [playerId]: newHand };
  const newTrickNum = state.trickNum + 1;

  if (newTrickNum === 13) {
    return endRound({ ...state, hands: newHands, wonCards: newWon, heartsBroken, trick: [] }, playerIds);
  }

  return {
    ...state, hands: newHands, wonCards: newWon, heartsBroken,
    trick: [], trickLeaderIdx: winnerIdx, currentPlayerIdx: winnerIdx,
    trickNum: newTrickNum,
    lastMsg: `P${winnerIdx+1} wins the trick (${newTrick.map(t=>t.card.rank+t.card.suit).join(" ")})`,
  };
}

function applyHearts(state: HeartsState, payload: HeartsPayload, playerId: string, playerIds: string[]): HeartsState {
  if (payload.type === "deal" && ["waiting","roundEnd","finished"].includes(state.phase))
    return applyDeal(state, playerIds, payload.ts);
  if (payload.type === "pass" && state.phase === "passing")
    return applyPass(state, payload.cards, playerId, playerIds);
  if (payload.type === "play" && state.phase === "playing")
    return applyPlay(state, payload.cardIdx, playerId, playerIds);
  return state;
}

// ── Card visuals ───────────────────────────────────────────────────────────

function isRed(suit: Suit) { return suit === "♥" || suit === "♦"; }

function HCardFace({ card, selected, playable, lifted, small, onClick }: {
  card: HCard; selected?: boolean; playable?: boolean; lifted?: boolean; small?: boolean; onClick?: () => void;
}) {
  const col = isRed(card.suit) ? "#dc2626" : "#111827";
  const pts = cardPts(card);
  const w = small ? 36 : 50, h = small ? 52 : 72;
  return (
    <button onClick={onClick} disabled={!onClick || (!playable && !selected)}
      style={{ width: w, height: h }}
      className={cn(
        "relative flex-shrink-0 rounded-lg border-2 bg-white select-none transition-all duration-150",
        selected  ? "border-arena-accent ring-2 ring-arena-accent/50 -translate-y-3 shadow-lg" :
        playable && onClick ? "border-gray-200 hover:-translate-y-3 hover:shadow-lg cursor-pointer" :
        "border-gray-200 cursor-default",
        lifted    && "opacity-50",
        !playable && !selected && onClick && "opacity-50",
        pts > 0 && !selected && "border-red-200",
      )}>
      <div className="absolute top-0.5 left-1 leading-none font-bold" style={{color:col, fontSize: small?7:9}}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{color:col, fontSize: small?16:22}} className="font-bold">{card.suit}</span>
      </div>
      <div className="absolute bottom-0.5 right-1 leading-none font-bold rotate-180" style={{color:col, fontSize:small?7:9}}>
        <div>{card.rank}</div><div>{card.suit}</div>
      </div>
      {isQS(card) && <div className="absolute -top-1 -right-1 text-[8px]">13</div>}
    </button>
  );
}

function HCardBack({ small = false }: { small?: boolean }) {
  const w = small ? 36 : 50, h = small ? 52 : 72;
  return (
    <div className="relative flex-shrink-0 flex items-center justify-center rounded-lg border-2 border-white/20 overflow-hidden bg-[#7c1d1d]"
      style={{width:w, height:h}}>
      <div className="absolute inset-2 rounded bg-[repeating-linear-gradient(45deg,#7c1d1d,#7c1d1d_2px,#991b1b_2px,#991b1b_5px)]"/>
      <span className="relative text-white font-black text-[8px]">♥</span>
    </div>
  );
}

// ── Main board ─────────────────────────────────────────────────────────────

export default function HeartsBoard({ room }: { room: GameRoom }) {
  const myId   = useGameStore((s) => s.myPlayerId);
  const moves  = useGameStore((s) => s.moves);
  const storeP = useGameStore((s) => s.players);
  const appliedRef = useRef(0);

  const playerIds = room.playerIds;
  const isHost = room.hostId === myId;
  const myIdx  = playerIds.indexOf(myId ?? "");

  const [gs, setGs]           = useState<HeartsState>(() => initState(room.id));
  const [passSelected, setPassSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    setGs(initState(room.id)); setPassSelected(new Set()); appliedRef.current = 0;
  }, [room.hostId, room.id]);

  useEffect(() => {
    const pending = moves.slice(appliedRef.current);
    if (!pending.length) return;
    setGs(prev => {
      let s = prev;
      for (const m of pending) s = applyHearts(s, m.payload as HeartsPayload, m.playerId, playerIds);
      return s;
    });
    setPassSelected(new Set());
    appliedRef.current = moves.length;
  }, [moves, playerIds]);

  useEffect(() => {
    if (!gs.winner || useGameStore.getState().result) return;
    useGameStore.getState().setResult({ winnerId: gs.winner, reason: "lowest score" });
  }, [gs.winner]);

  const emit = useCallback((payload: HeartsPayload) => {
    setGs(prev => applyHearts(prev, payload, myId ?? "", playerIds));
    setPassSelected(new Set());
    getSocket().emit("game:move", room.id, { playerId: myId ?? "", timestamp: Date.now(), payload });
  }, [playerIds, room.id, myId]);

  const myHand   = gs.hands[myId ?? ""] ?? [];
  const myWon    = gs.wonCards[myId ?? ""] ?? [];
  const isMyTurn = playerIds[gs.currentPlayerIdx] === myId && gs.phase === "playing";
  const validIdx = isMyTurn ? validIndices(myHand, gs.trick, gs.heartsBroken, gs.trickNum) : new Set<number>();
  const canDeal  = isHost && ["waiting","roundEnd","finished"].includes(gs.phase);
  const dir = passDirection(gs.round);

  const pName = (id: string) => storeP.find(p=>p.id===id)?.name ?? `P${playerIds.indexOf(id)+1}`;

  // Player order: me at bottom, others clockwise
  const oppOrder = [
    playerIds[(myIdx+1)%4],  // right
    playerIds[(myIdx+2)%4],  // top (across)
    playerIds[(myIdx+3)%4],  // left
  ].filter(Boolean);

  // Already passed?
  const myPassCommitted = !!gs.passedBy[myId ?? ""];
  const passDir = dir !== "keep" ? dir : null;
  const passTargetName = passDir && myIdx >= 0
    ? pName(playerIds[(passDir==="left" ? myIdx+1 : passDir==="right" ? myIdx+3 : myIdx+2)%4])
    : null;

  function togglePassCard(idx: number) {
    if (myPassCommitted) return;
    const s = new Set(passSelected);
    if (s.has(idx)) s.delete(idx); else if (s.size < 3) s.add(idx);
    setPassSelected(s);
  }

  function commitPass() {
    if (passSelected.size !== 3 || myPassCommitted) return;
    const cards = [...passSelected].map(i => myHand[i]);
    emit({ type: "pass", cards });
  }

  return (
    <div className="flex flex-col items-center gap-4 select-none">

      {/* Status */}
      <div className="text-center">
        <p className="text-xs text-arena-text-muted">{gs.lastMsg}</p>
        {gs.heartsBroken && gs.phase === "playing" && (
          <p className="text-[10px] text-red-400 font-semibold">♥ Hearts broken</p>
        )}
      </div>

      {/* Scores */}
      <div className="flex flex-wrap gap-2 justify-center">
        {playerIds.map(id => (
          <div key={id} className={cn("rounded-lg border px-3 py-1 text-center text-[10px]",
            id===myId ? "border-arena-accent bg-arena-accent/10" : "border-arena-border bg-arena-surface/50")}>
            <div className="font-semibold text-arena-text">{pName(id)}</div>
            <div className="text-arena-text-muted">{gs.scores[id]??0} pts</div>
            {gs.phase!=="waiting" && (
              <div className="text-red-400">{(gs.wonCards[id]??[]).reduce((s,c)=>s+cardPts(c),0)} this round</div>
            )}
          </div>
        ))}
      </div>

      {/* Opponents */}
      <div className="flex gap-3 flex-wrap justify-center">
        {oppOrder.map(id => {
          if (!id) return null;
          const hand = gs.hands[id] ?? [];
          const isTurn = playerIds[gs.currentPlayerIdx] === id && gs.phase==="playing";
          const hasPassed = !!gs.passedBy[id];
          const trickCard = gs.trick.find(t => t.playerIdx === playerIds.indexOf(id));
          return (
            <div key={id} className={cn("flex flex-col items-center gap-1 rounded-xl border p-2 min-w-[90px]",
              isTurn ? "border-yellow-400/50 bg-yellow-400/5" : "border-arena-border bg-arena-surface/40")}>
              <span className={cn("text-[10px] font-semibold", isTurn?"text-yellow-400":"text-arena-text-muted")}>
                {isTurn?"▸ ":""}{pName(id)}{hasPassed&&gs.phase==="passing"?" ✓":""}
              </span>
              {trickCard
                ? <HCardFace card={trickCard.card} small/>
                : <div className="flex">{Array.from({length:Math.min(hand.length,8)},(_,i)=>(
                    <div key={i} style={{marginLeft:i>0?-10:0}}><HCardBack small/></div>
                  ))}
                  {hand.length>8&&<span className="text-[8px] text-arena-text-muted ml-1 self-center">+{hand.length-8}</span>}
                </div>}
              <span className="text-[8px] text-arena-text-muted">{hand.length} cards</span>
            </div>
          );
        })}
      </div>

      {/* Current trick */}
      {gs.phase === "playing" && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-arena-text-muted font-semibold uppercase tracking-wide">
            Trick {gs.trickNum+1}/13{gs.trick.length>0?` — led ${gs.trick[0].card.suit}`:""}</span>
          <div className="flex gap-2 min-h-[76px] items-center">
            {gs.trick.length === 0
              ? <span className="text-[10px] text-arena-text-muted italic">Waiting for lead…</span>
              : gs.trick.map((t, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5">
                    <HCardFace card={t.card}/>
                    <span className="text-[8px] text-arena-text-muted">{pName(playerIds[t.playerIdx])}</span>
                  </div>
                ))}
          </div>
        </div>
      )}

      {/* My hand */}
      {gs.phase !== "waiting" && (
        <div className="flex flex-col items-center gap-2 w-full">
          <span className="text-[10px] text-arena-text-muted">
            {gs.phase==="passing" ? `Your hand — select 3 to pass ${passDir ? passDir : ""} to ${passTargetName}` : `Your hand (${myHand.length})`}
            {myPassCommitted && gs.phase==="passing" && " ✓ Passed"}
          </span>
          <div className="flex flex-wrap gap-1 justify-center max-w-[480px]">
            {myHand.map((card, idx) => {
              const inPass = passSelected.has(idx);
              const isPlayable = validIdx.has(idx);
              return (
                <HCardFace key={idx} card={card}
                  selected={inPass}
                  playable={gs.phase==="playing" ? isPlayable : !myPassCommitted}
                  onClick={
                    gs.phase==="passing" && !myPassCommitted ? () => togglePassCard(idx) :
                    gs.phase==="playing" && isMyTurn ? () => emit({type:"play",cardIdx:idx}) :
                    undefined
                  }
                />
              );
            })}
          </div>

          {/* Pass commit button */}
          {gs.phase === "passing" && !myPassCommitted && (
            <button onClick={commitPass} disabled={passSelected.size !== 3}
              className={cn("rounded-lg px-6 py-2 text-sm font-bold transition-all active:scale-95",
                passSelected.size===3
                  ? "bg-arena-accent text-white hover:bg-arena-accent-hover shadow"
                  : "bg-arena-surface border border-arena-border text-arena-text-muted cursor-not-allowed")}>
              Pass {passSelected.size}/3 selected
            </button>
          )}
          {gs.phase === "passing" && myPassCommitted && (
            <p className="text-[10px] text-arena-text-muted animate-pulse">
              Waiting for other players ({Object.keys(gs.passedBy).length}/{playerIds.length})…
            </p>
          )}
          {gs.phase === "playing" && isMyTurn && gs.trick.length === 0 && (
            <p className="text-[10px] text-arena-text-muted">Lead a card</p>
          )}
          {gs.phase === "playing" && isMyTurn && gs.trick.length > 0 && (
            <p className="text-[10px] text-arena-text-muted">
              {validIdx.size < myHand.length ? `Must follow ${gs.trick[0].card.suit}` : "Play any card"}
            </p>
          )}
          {gs.phase === "playing" && !isMyTurn && (
            <p className="text-[10px] text-arena-text-muted">
              Waiting for {pName(playerIds[gs.currentPlayerIdx])}…
            </p>
          )}
        </div>
      )}

      {/* Deal / Next Round */}
      {canDeal && (
        <button onClick={() => emit({type:"deal", ts:Date.now()})}
          className="rounded-lg bg-arena-accent px-8 py-2.5 text-sm font-bold text-white hover:bg-arena-accent-hover active:scale-95 transition-all shadow">
          {gs.phase==="waiting" ? "Deal" : gs.phase==="finished" ? "Game Over — Deal Again" : "Next Round"}
        </button>
      )}
    </div>
  );
}
