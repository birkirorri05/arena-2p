// Detailed SVG game card illustrations — 80×80 viewBox, full-bleed.
import type { ReactElement } from "react";

export function GameLogo({ id }: { id: string }) {
  const map: Record<string, ReactElement> = {
    chess:       <ChessLogo />,
    wordgrid:    <WordGridLogo />,
    backgammon:  <BackgammonLogo />,
    go:          <GoLogo />,
    checkers:    <CheckersLogo />,
    fourinarow:  <FourInARowLogo />,
    tictactoe:   <TicTacToeLogo />,
    reversi:     <ReversiLogo />,
    mancala:     <MancalaLogo />,
    seabattle:   <SeaBattleLogo />,
    war:         <WarLogo />,
    blackjack:   <BlackjackLogo />,
    wildcards:   <WildCardsLogo />,
    crazyeights: <CrazyEightsLogo />,
    gofish:      <GoFishLogo />,
    poker:       <PokerLogo />,
    snap:        <SnapLogo />,
    hearts:      <HeartsLogo />,
    rummy:       <RummyLogo />,
    fivedice:    <FiveDiceLogo />,
    liarsdice:   <LiarsDiceLogo />,
    dominoes:    <DominoesLogo />,
  };
  return map[id] ?? null;
}

// ── Shared defs helpers ──────────────────────────────────────────────────────

function Defs({ children }: { children: React.ReactNode }) {
  return <defs>{children}</defs>;
}

const VB = "0 0 80 80";
const CLS = "w-full h-full";

// 3-D sphere gradient — light source top-left
function SphereGrad({ id, light, dark }: { id: string; light: string; dark: string }) {
  return (
    <radialGradient id={id} cx="35%" cy="28%" r="65%">
      <stop offset="0%"   stopColor={light}/>
      <stop offset="100%" stopColor={dark}/>
    </radialGradient>
  );
}

// Playing card shape helper
function PlayingCard({ x, y, w, h, rot, fill, stroke, label, suit, suitColor }:
  { x:number; y:number; w:number; h:number; rot?:string; fill?:string; stroke?:string; label:string; suit:string; suitColor:string }) {
  const g = rot ? `rotate(${rot})` : undefined;
  return (
    <g transform={g}>
      <rect x={x} y={y} width={w} height={h} rx={2} fill={fill??"white"} stroke={stroke??"#ccc"} strokeWidth={0.6}/>
      <text x={x+3}   y={y+8}  fontSize={6} fontWeight="bold" fill={suitColor} fontFamily="serif">{label}</text>
      <text x={x+3}   y={y+14} fontSize={7} fill={suitColor}>{suit}</text>
      <text x={x+w/2} y={y+h/2+5} fontSize={16} textAnchor="middle" fill={suitColor} fontFamily="serif">{suit}</text>
      <text x={x+w-3} y={y+h-3} fontSize={6} fontWeight="bold" fill={suitColor} textAnchor="end" fontFamily="serif"
        transform={`rotate(180,${x+w/2},${y+h/2})`}>{label}</text>
    </g>
  );
}

// Isometric die face
function DieFace({ pts, fill, pips, pipFill }: { pts:string; fill:string; pips:[number,number][]; pipFill:string }) {
  return (
    <>
      <polygon points={pts} fill={fill} stroke="rgba(0,0,0,0.25)" strokeWidth={0.5}/>
      {pips.map(([px,py],i) => <circle key={i} cx={px} cy={py} r={1.8} fill={pipFill}/>)}
    </>
  );
}

// ── Chess ────────────────────────────────────────────────────────────────────
function ChessLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="wp" light="#ffffff" dark="#b0b0b0"/>
        <SphereGrad id="bp" light="#555555" dark="#111111"/>
        <linearGradient id="brd" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.15)"/>
          <stop offset="100%" stopColor="rgba(255,255,255,0.03)"/>
        </linearGradient>
      </Defs>
      {/* Board corner */}
      {[0,1,2,3].flatMap(r=>[0,1,2,3].map(c=>(r+c)%2===0?
        <rect key={`${r}${c}`} x={c*10} y={r*10} width={10} height={10} fill="url(#brd)"/> : null))}
      <rect x={0} y={0} width={40} height={40} fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={0.5}/>
      {/* White king — right side, large */}
      <g opacity={0.97}>
        {/* Cross */}
        <rect x={54} y={8}  width={5} height={16} rx={2} fill="url(#wp)"/>
        <rect x={48} y={12} width={17} height={5} rx={2} fill="url(#wp)"/>
        {/* Collar */}
        <rect x={46} y={24} width={21} height={6} rx={2} fill="url(#wp)"/>
        {/* Body */}
        <path d="M49,30 Q43,42 44,54 L69,54 Q70,42 64,30Z" fill="url(#wp)"/>
        {/* Base */}
        <rect x={40} y={54} width={33} height={7} rx={2.5} fill="url(#wp)"/>
        <rect x={37} y={61} width={39} height={8} rx={3.5} fill="url(#wp)"/>
      </g>
      {/* Black pawn — left side */}
      <g opacity={0.85}>
        <circle cx={16} cy={52} r={8} fill="url(#bp)"/>
        <path d="M11,60 Q8,70 10,73 L22,73 Q24,70 21,60Z" fill="url(#bp)"/>
        <rect x={8} y={73} width={24} height={4.5} rx={2} fill="url(#bp)"/>
      </g>
    </svg>
  );
}

// ── Word Grid ────────────────────────────────────────────────────────────────
function WordGridLogo() {
  const tiles = [
    { x:4,  y:4,  l:"W", p:4, rot:"-5" },
    { x:42, y:2,  l:"O", p:1, rot:"4"  },
    { x:5,  y:42, l:"R", p:1, rot:"3"  },
    { x:43, y:41, l:"D", p:2, rot:"-3" },
  ];
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#fef3c7"/>
          <stop offset="100%" stopColor="#fde68a"/>
        </linearGradient>
        <linearGradient id="tileSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#d97706"/>
          <stop offset="100%" stopColor="#92400e"/>
        </linearGradient>
        <filter id="ts"><feDropShadow dx="1.5" dy="2" stdDeviation="1.5" floodOpacity="0.45"/></filter>
      </Defs>
      {tiles.map(({x,y,l,p,rot})=>(
        <g key={l} transform={`rotate(${rot},${x+16},${y+16})`} filter="url(#ts)">
          {/* Side */}
          <rect x={x+2} y={y+30} width={30} height={4} rx={1} fill="url(#tileSide)"/>
          {/* Face */}
          <rect x={x} y={y} width={30} height={30} rx={3} fill="url(#tile)"/>
          {/* Letter */}
          <text x={x+15} y={y+22} textAnchor="middle" fontSize={18} fontWeight="bold"
            fill="#78350f" fontFamily="Georgia,serif">{l}</text>
          {/* Points */}
          <text x={x+25} y={y+28} fontSize={7} fill="#a16207">{p}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Backgammon ───────────────────────────────────────────────────────────────
function BackgammonLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="wChk" light="#ffffff" dark="#c0c0c0"/>
        <SphereGrad id="bChk" light="#666"    dark="#111"/>
      </Defs>
      {/* Board */}
      <rect x={3} y={3} width={74} height={74} rx={5} fill="rgba(120,60,20,0.35)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}/>
      {/* Bar */}
      <rect x={37} y={3} width={6} height={74} fill="rgba(80,40,10,0.5)"/>
      {/* Triangles */}
      {[5,20,50,65].map((x,i)=>(
        <polygon key={`t${i}`} points={`${x},5 ${x+13},5 ${x+6.5},38`}
          fill={i%2===0?"rgba(220,80,50,0.85)":"rgba(240,220,180,0.55)"}/>
      ))}
      {[5,20,50,65].map((x,i)=>(
        <polygon key={`b${i}`} points={`${x},75 ${x+13},75 ${x+6.5},42`}
          fill={i%2===0?"rgba(240,220,180,0.55)":"rgba(220,80,50,0.85)"}/>
      ))}
      {/* Pieces */}
      {[11.5,27].map((cx,i)=>(
        <circle key={`w${i}`} cx={cx} cy={i===0?28:32} r={5.5} fill="url(#wChk)"/>
      ))}
      {[57.5,71].map((cx,i)=>(
        <circle key={`b${i}`} cx={cx} cy={i===0?52:48} r={5.5} fill="url(#bChk)"/>
      ))}
    </svg>
  );
}

// ── Go ───────────────────────────────────────────────────────────────────────
function GoLogo() {
  const S=15, O=8;
  const black:number[][] = [[1,0],[3,1],[0,2],[2,1],[4,3],[1,4]];
  const white:number[][] = [[0,0],[2,3],[3,2],[4,1],[0,4],[3,4]];
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="wS" light="#ffffff" dark="#c8c8c8"/>
        <SphereGrad id="bS" light="#666"    dark="#090909"/>
      </Defs>
      {/* Grid */}
      {Array.from({length:5},(_,i)=>(
        <g key={i}>
          <line x1={O} y1={O+i*S} x2={O+4*S} y2={O+i*S} stroke="rgba(255,255,255,0.4)" strokeWidth={1}/>
          <line x1={O+i*S} y1={O} x2={O+i*S} y2={O+4*S} stroke="rgba(255,255,255,0.4)" strokeWidth={1}/>
        </g>
      ))}
      {[[1,1],[3,1],[1,3],[3,3]].map(([c,r])=>
        <circle key={`h${c}${r}`} cx={O+c*S} cy={O+r*S} r={2} fill="rgba(255,255,255,0.45)"/>
      )}
      {black.map(([c,r],i)=>
        <circle key={`b${i}`} cx={O+c*S} cy={O+r*S} r={7} fill="url(#bS)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.8}/>
      )}
      {white.map(([c,r],i)=>
        <circle key={`w${i}`} cx={O+c*S} cy={O+r*S} r={7} fill="url(#wS)" stroke="rgba(0,0,0,0.2)" strokeWidth={0.8}/>
      )}
    </svg>
  );
}

// ── Checkers ─────────────────────────────────────────────────────────────────
function CheckersLogo() {
  const SQ=18, OFF=4;
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="rP" light="#ff6060" dark="#991b1b"/>
        <SphereGrad id="dP" light="#444"    dark="#111"/>
      </Defs>
      {Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>
        (r+c)%2===1?<rect key={`${r}${c}`} x={OFF+c*SQ} y={OFF+r*SQ} width={SQ} height={SQ}
          fill="rgba(255,255,255,0.12)"/>:null))}
      <rect x={OFF} y={OFF} width={4*SQ} height={4*SQ} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.2}/>
      {[0,1].flatMap(r=>[0,1,2,3].filter(c=>(r+c)%2===1).map(c=>(
        <g key={`r${r}${c}`}>
          <circle cx={OFF+c*SQ+9} cy={OFF+r*SQ+9} r={7.5} fill="url(#rP)"/>
          <circle cx={OFF+c*SQ+9} cy={OFF+r*SQ+9} r={3.5} fill="none" stroke="rgba(255,200,200,0.5)" strokeWidth={1}/>
        </g>
      )))}
      {[2,3].flatMap(r=>[0,1,2,3].filter(c=>(r+c)%2===1).map(c=>(
        <g key={`d${r}${c}`}>
          <circle cx={OFF+c*SQ+9} cy={OFF+r*SQ+9} r={7.5} fill="url(#dP)"/>
          <circle cx={OFF+c*SQ+9} cy={OFF+r*SQ+9} r={3.5} fill="none" stroke="rgba(120,120,120,0.4)" strokeWidth={1}/>
        </g>
      )))}
    </svg>
  );
}

// ── Four in a Row ─────────────────────────────────────────────────────────────
function FourInARowLogo() {
  const board=[
    [0,0,0,0,0],
    [0,0,2,0,0],
    [0,1,2,0,0],
    [1,2,1,2,0],
    [1,2,1,2,1],
  ];
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="rD" light="#ff7070" dark="#dc2626"/>
        <SphereGrad id="yD" light="#fde047" dark="#ca8a04"/>
      </Defs>
      <rect x={5} y={8} width={70} height={65} rx={6}
        fill="rgba(30,60,180,0.55)" stroke="rgba(255,255,255,0.3)" strokeWidth={1.5}/>
      {board.map((row,r)=>row.map((v,c)=>(
        <circle key={`${r}${c}`} cx={12+c*13} cy={17+r*12} r={5.2}
          fill={v===1?"url(#rD)":v===2?"url(#yD)":"rgba(0,20,80,0.6)"}
          stroke="rgba(255,255,255,0.1)" strokeWidth={0.5}/>
      )))}
    </svg>
  );
}

// ── Tic Tac Toe ───────────────────────────────────────────────────────────────
function TicTacToeLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <line x1={28} y1={6}  x2={28} y2={74} stroke="rgba(255,255,255,0.8)" strokeWidth={4.5} strokeLinecap="round"/>
      <line x1={52} y1={6}  x2={52} y2={74} stroke="rgba(255,255,255,0.8)" strokeWidth={4.5} strokeLinecap="round"/>
      <line x1={6}  y1={28} x2={74} y2={28} stroke="rgba(255,255,255,0.8)" strokeWidth={4.5} strokeLinecap="round"/>
      <line x1={6}  y1={52} x2={74} y2={52} stroke="rgba(255,255,255,0.8)" strokeWidth={4.5} strokeLinecap="round"/>
      {/* X top-left */}
      <line x1={8}  y1={8}  x2={22} y2={22} stroke="rgba(255,255,255,0.95)" strokeWidth={4} strokeLinecap="round"/>
      <line x1={22} y1={8}  x2={8}  y2={22} stroke="rgba(255,255,255,0.95)" strokeWidth={4} strokeLinecap="round"/>
      {/* O center */}
      <circle cx={40} cy={40} r={9} stroke="rgba(255,220,50,0.95)" strokeWidth={4} fill="none"/>
      {/* X bottom-right */}
      <line x1={58} y1={58} x2={72} y2={72} stroke="rgba(255,255,255,0.7)" strokeWidth={4} strokeLinecap="round"/>
      <line x1={72} y1={58} x2={58} y2={72} stroke="rgba(255,255,255,0.7)" strokeWidth={4} strokeLinecap="round"/>
      {/* O top-right */}
      <circle cx={63} cy={15} r={7} stroke="rgba(255,220,50,0.7)" strokeWidth={3.5} fill="none"/>
    </svg>
  );
}

// ── Reversi ───────────────────────────────────────────────────────────────────
function ReversiLogo() {
  const SQ=18, OFF=4;
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <SphereGrad id="wR" light="#ffffff" dark="#c0c0c0"/>
        <SphereGrad id="bR" light="#555"    dark="#0a0a0a"/>
      </Defs>
      <rect x={OFF} y={OFF} width={4*SQ} height={4*SQ} rx={2}
        fill="rgba(22,101,52,0.5)" stroke="rgba(255,255,255,0.2)" strokeWidth={0.8}/>
      {[1,2,3].map(i=>(
        <g key={i}>
          <line x1={OFF+i*SQ} y1={OFF} x2={OFF+i*SQ} y2={OFF+4*SQ} stroke="rgba(255,255,255,0.2)" strokeWidth={0.7}/>
          <line x1={OFF} y1={OFF+i*SQ} x2={OFF+4*SQ} y2={OFF+i*SQ} stroke="rgba(255,255,255,0.2)" strokeWidth={0.7}/>
        </g>
      ))}
      {Array.from({length:4},(_,r)=>Array.from({length:4},(_,c)=>(
        <circle key={`${r}${c}`} cx={OFF+c*SQ+9} cy={OFF+r*SQ+9} r={7.5}
          fill={(r+c)%2===0?"url(#wR)":"url(#bR)"}
          stroke="rgba(255,255,255,0.1)" strokeWidth={0.5}/>
      )))}
    </svg>
  );
}

// ── Mancala ───────────────────────────────────────────────────────────────────
function MancalaLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <Defs>
        <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(180,100,30,0.6)"/>
          <stop offset="100%" stopColor="rgba(100,50,10,0.6)"/>
        </linearGradient>
        <SphereGrad id="seed1" light="#c0a060" dark="#6b3a0f"/>
        <SphereGrad id="seed2" light="#d4c090" dark="#7c5520"/>
      </Defs>
      <rect x={3} y={12} width={74} height={56} rx={15} fill="url(#wood)" stroke="rgba(255,220,150,0.3)" strokeWidth={1.5}/>
      <ellipse cx={11} cy={40} rx={6} ry={22} fill="rgba(255,255,255,0.7)"/>
      <ellipse cx={69} cy={40} rx={6} ry={22} fill="rgba(255,255,255,0.7)"/>
      {[22,37,52].map((cx,i)=>(
        <g key={i}>
          <circle cx={cx} cy={26} r={9} fill="rgba(255,255,255,0.5)"/>
          <circle cx={cx} cy={54} r={9} fill="rgba(255,255,255,0.5)"/>
        </g>
      ))}
      {/* Seeds */}
      {[[22,26],[52,54],[37,26]].map(([cx,cy],i)=>(
        <g key={i}>
          <circle cx={cx-3} cy={cy-2} r={2.5} fill={`url(#seed${(i%2)+1})`}/>
          <circle cx={cx+3} cy={cy-2} r={2.5} fill={`url(#seed${((i+1)%2)+1})`}/>
          <circle cx={cx}   cy={cy+3} r={2.5} fill={`url(#seed${(i%2)+1})`}/>
        </g>
      ))}
    </svg>
  );
}

// ── Sea Battle ────────────────────────────────────────────────────────────────
function SeaBattleLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Ocean grid */}
      {Array.from({length:5},(_,i)=>(
        <g key={i}>
          <line x1={4} y1={12+i*14} x2={76} y2={12+i*14} stroke="rgba(255,255,255,0.2)" strokeWidth={0.7}/>
          <line x1={4+i*14} y1={12} x2={4+i*14} y2={68} stroke="rgba(255,255,255,0.2)" strokeWidth={0.7}/>
        </g>
      ))}
      <rect x={4} y={12} width={72} height={56} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1}/>
      {/* Hit marker */}
      <circle cx={32} cy={40} r={4} fill="rgba(239,68,68,0.9)"/>
      <line x1={28} y1={36} x2={36} y2={44} stroke="rgba(239,68,68,0.8)" strokeWidth={2}/>
      <line x1={36} y1={36} x2={28} y2={44} stroke="rgba(239,68,68,0.8)" strokeWidth={2}/>
      {/* Miss */}
      <circle cx={60} cy={26} r={3.5} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5}/>
      {/* Battleship */}
      <path d="M10,55 L10,48 L14,44 L58,44 L62,48 L62,55 Z"
        fill="rgba(255,255,255,0.85)" stroke="rgba(200,200,200,0.3)" strokeWidth={0.5}/>
      <rect x={22} y={40} width={20} height={4} rx={1} fill="rgba(255,255,255,0.7)"/>
      <rect x={28} y={36} width={8}  height={4} rx={1} fill="rgba(255,255,255,0.7)"/>
      {/* Smoke */}
      <circle cx={32} cy={32} r={3}   fill="rgba(255,255,255,0.25)"/>
      <circle cx={35} cy={28} r={4}   fill="rgba(255,255,255,0.2)"/>
      <circle cx={30} cy={25} r={2.5} fill="rgba(255,255,255,0.15)"/>
    </svg>
  );
}

// ── Shared card helper ─────────────────────────────────────────────────────────
function CardStack({ cards }: { cards: Array<{x:number;y:number;r?:number;rank:string;suit:string;color:string}> }) {
  return (
    <>
      {cards.map(({x,y,r,rank,suit,color},i)=>(
        <g key={i} transform={r?`rotate(${r},${x+13},${y+18})`:"rotate(0)"}>
          <rect x={x} y={y} width={26} height={36} rx={2.5}
            fill="white" stroke="#d1d5db" strokeWidth={0.7}
            style={{filter:"drop-shadow(1px 2px 3px rgba(0,0,0,0.4))"}}/>
          <text x={x+4}   y={y+10} fontSize={7}  fontWeight="bold" fill={color}>{rank}</text>
          <text x={x+4}   y={y+17} fontSize={8}  fill={color}>{suit}</text>
          <text x={x+13}  y={y+27} textAnchor="middle" fontSize={15} fill={color}>{suit}</text>
          <text x={x+22}  y={y+35} fontSize={7}  fontWeight="bold" fill={color}
            transform={`rotate(180,${x+13},${y+18})`}>{rank}</text>
        </g>
      ))}
    </>
  );
}

// ── War ───────────────────────────────────────────────────────────────────────
function WarLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[
        {x:6,  y:12, r:-14, rank:"K", suit:"♠", color:"#111"},
        {x:48, y:12, r:14,  rank:"Q", suit:"♥", color:"#dc2626"},
      ]}/>
      {/* Crossed swords */}
      <line x1={25} y1={65} x2={55} y2={35} stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round"/>
      <line x1={55} y1={65} x2={25} y2={35} stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round"/>
    </svg>
  );
}

// ── Blackjack ─────────────────────────────────────────────────────────────────
function BlackjackLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[
        {x:8,  y:8,  r:-8, rank:"A", suit:"♠", color:"#111"},
        {x:38, y:14, r:6,  rank:"K", suit:"♥", color:"#dc2626"},
      ]}/>
      {/* 21 badge */}
      <rect x={26} y={56} width={28} height={16} rx={8}
        fill="rgba(250,204,21,0.9)" stroke="rgba(180,130,0,0.4)" strokeWidth={1}/>
      <text x={40} y={68} textAnchor="middle" fontSize={10} fontWeight="bold" fill="#78350f">21</text>
    </svg>
  );
}

// ── Wild Cards ────────────────────────────────────────────────────────────────
function WildCardsLogo() {
  const cards=[
    {x:5,  y:18, r:-16, rank:"R", suit:"", color:"#dc2626", bg:"#fca5a5"},
    {x:20, y:12, r:-6,  rank:"7", suit:"", color:"#2563eb", bg:"#93c5fd"},
    {x:35, y:10, r:2,   rank:"+2",suit:"", color:"#16a34a", bg:"#86efac"},
    {x:48, y:13, r:10,  rank:"W", suit:"", color:"#7c3aed", bg:"#c4b5fd"},
  ];
  return (
    <svg viewBox={VB} className={CLS}>
      {cards.map(({x,y,r,rank,color,bg},i)=>(
        <g key={i} transform={`rotate(${r},${x+13},${y+18})`}>
          <rect x={x} y={y} width={26} height={36} rx={3}
            fill={bg} stroke="rgba(0,0,0,0.15)" strokeWidth={0.5}
            style={{filter:"drop-shadow(1px 2px 3px rgba(0,0,0,0.4))"}}/>
          <circle cx={x+13} cy={y+18} r={9} fill={color} opacity={0.85}/>
          <text x={x+13} y={y+22} textAnchor="middle" fontSize={8} fontWeight="bold" fill="white">{rank}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Crazy Eights ──────────────────────────────────────────────────────────────
function CrazyEightsLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[{x:8, y:6, r:-10, rank:"8", suit:"♠", color:"#111"}]}/>
      <CardStack cards={[{x:34, y:10, r:5, rank:"8", suit:"♦", color:"#dc2626"}]}/>
      {/* Big 8 */}
      <text x={40} y={68} textAnchor="middle" fontSize={28} fontWeight="bold"
        fill="rgba(255,255,255,0.5)" fontFamily="serif">8</text>
    </svg>
  );
}

// ── Go Fish ───────────────────────────────────────────────────────────────────
function GoFishLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[
        {x:6,  y:8, r:-12, rank:"7", suit:"♣", color:"#166534"},
        {x:46, y:8, r:12,  rank:"7", suit:"♦", color:"#dc2626"},
      ]}/>
      {/* Fish */}
      <path d="M20,58 Q28,48 40,52 Q52,56 60,50 Q56,60 60,68 Q48,64 40,66 Q28,70 20,58Z"
        fill="rgba(255,255,255,0.7)"/>
      <circle cx={56} cy={54} r={2} fill="rgba(0,0,0,0.5)"/>
      <path d="M56,54 Q62,50 66,48 Q62,55 66,62 Q60,58 56,54Z" fill="rgba(255,255,255,0.7)"/>
    </svg>
  );
}

// ── Poker ─────────────────────────────────────────────────────────────────────
function PokerLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Chips */}
      {[{cx:22,cy:58,col:"#dc2626"},{cx:36,cy:62,col:"#f59e0b"},{cx:50,cy:58,col:"#2563eb"}].map(({cx,cy,col},i)=>(
        <g key={i}>
          <ellipse cx={cx} cy={cy+3} rx={11} ry={4} fill="rgba(0,0,0,0.4)"/>
          <circle  cx={cx} cy={cy}   r={11}   fill={col}/>
          <circle  cx={cx} cy={cy}   r={8}    fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth={1.5} strokeDasharray="3,3"/>
          <circle  cx={cx} cy={cy}   r={3}    fill="rgba(255,255,255,0.6)"/>
        </g>
      ))}
      <CardStack cards={[
        {x:10, y:10, r:-10, rank:"A", suit:"♠", color:"#111"},
        {x:44, y:10, r:8,   rank:"A", suit:"♥", color:"#dc2626"},
      ]}/>
    </svg>
  );
}

// ── Snap ──────────────────────────────────────────────────────────────────────
function SnapLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[
        {x:8,  y:14, r:-5, rank:"J", suit:"♦", color:"#dc2626"},
        {x:46, y:14, r:5,  rank:"J", suit:"♦", color:"#dc2626"},
      ]}/>
      {/* SNAP burst */}
      <path d="M40,8 L43,18 L53,14 L47,22 L57,24 L48,28 L52,38 L40,32 L28,38 L32,28 L23,24 L33,22 L27,14 L37,18Z"
        fill="rgba(250,204,21,0.85)" stroke="rgba(180,130,0,0.3)" strokeWidth={0.5}/>
      <text x={40} y={70} textAnchor="middle" fontSize={11} fontWeight="bold"
        fill="rgba(255,255,255,0.9)" letterSpacing={1}>SNAP</text>
    </svg>
  );
}

// ── Hearts ────────────────────────────────────────────────────────────────────
function HeartsLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <CardStack cards={[
        {x:8,  y:10, r:-12, rank:"Q", suit:"♥", color:"#dc2626"},
        {x:38, y:8,  r:5,   rank:"A", suit:"♥", color:"#dc2626"},
      ]}/>
      {/* Big heart */}
      <path d="M40,72 C20,58 14,46 20,38 C24,32 30,32 35,36 C37,38 40,42 40,42 C40,42 43,38 45,36 C50,32 56,32 60,38 C66,46 60,58 40,72Z"
        fill="rgba(220,38,38,0.4)" stroke="rgba(255,100,100,0.3)" strokeWidth={1}/>
    </svg>
  );
}

// ── Rummy ─────────────────────────────────────────────────────────────────────
function RummyLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Fan of 5 cards */}
      {[
        {x:4,  y:14, r:-24, rank:"5", suit:"♣", color:"#166534"},
        {x:15, y:8,  r:-12, rank:"6", suit:"♣", color:"#166534"},
        {x:27, y:6,  r:0,   rank:"7", suit:"♣", color:"#166534"},
        {x:39, y:8,  r:12,  rank:"8", suit:"♦", color:"#dc2626"},
        {x:50, y:14, r:24,  rank:"9", suit:"♦", color:"#dc2626"},
      ].map(({x,y,r,rank,suit,color},i)=>(
        <g key={i} transform={`rotate(${r},${x+13},${y+18})`}
          style={{filter:"drop-shadow(1px 2px 3px rgba(0,0,0,0.4))"}}>
          <rect x={x} y={y} width={26} height={36} rx={2.5} fill="white" stroke="#d1d5db" strokeWidth={0.7}/>
          <text x={x+4} y={y+11} fontSize={7}  fontWeight="bold" fill={color}>{rank}</text>
          <text x={x+4} y={y+18} fontSize={8}  fill={color}>{suit}</text>
          <text x={x+13} y={y+27} textAnchor="middle" fontSize={13} fill={color}>{suit}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Five Dice ─────────────────────────────────────────────────────────────────
// Isometric die — top/right/left faces
function IsoDie({ ox, oy, sc, top, right, left, v }:
  { ox:number; oy:number; sc:number; top:string; right:string; left:string; v:number }) {
  const pips1:number[][]  = [[0.5,0.5]];
  const pips2:number[][]  = [[0.25,0.3],[0.75,0.7]];
  const pips3:number[][]  = [[0.25,0.25],[0.5,0.5],[0.75,0.75]];
  const pips5:number[][]  = [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]];
  const pips6:number[][]  = [[0.25,0.2],[0.75,0.2],[0.25,0.5],[0.75,0.5],[0.25,0.8],[0.75,0.8]];
  const allPips = [pips1,pips2,pips3,pips2,pips5,pips6];
  const pts = allPips[Math.min(v-1,5)];
  const h=sc*0.6, w=sc;
  // Top face
  const T=`${ox},${oy} ${ox+w/2},${oy-h/2} ${ox+w},${oy} ${ox+w/2},${oy+h/2}`;
  // Right face
  const R=`${ox+w/2},${oy+h/2} ${ox+w},${oy} ${ox+w},${oy+h} ${ox+w/2},${oy+h+h/2}`;
  // Left face
  const L=`${ox},${oy} ${ox+w/2},${oy+h/2} ${ox+w/2},${oy+h+h/2} ${ox},${oy+h}`;
  return (
    <>
      <polygon points={T} fill={top} stroke="rgba(0,0,0,0.2)" strokeWidth={0.5}/>
      <polygon points={R} fill={right} stroke="rgba(0,0,0,0.2)" strokeWidth={0.5}/>
      <polygon points={L} fill={left} stroke="rgba(0,0,0,0.2)" strokeWidth={0.5}/>
      {/* Pips on top face — project into rhombus */}
      {pts.map(([px,py],i)=>{
        const cx=ox+(px*w/2)+(py*w/2);
        const cy=oy-(px*h/2)+(py*h/2);
        return <circle key={i} cx={cx} cy={cy} r={sc*0.065} fill="rgba(30,30,80,0.8)"/>;
      })}
    </>
  );
}

function FiveDiceLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      <IsoDie ox={2}  oy={22} sc={22} top="#fff" right="#bbb" left="#ddd" v={5}/>
      <IsoDie ox={25} oy={14} sc={22} top="#fff" right="#bbb" left="#ddd" v={1}/>
      <IsoDie ox={48} oy={20} sc={22} top="#fff" right="#bbb" left="#ddd" v={6}/>
      <IsoDie ox={13} oy={44} sc={22} top="#fff" right="#bbb" left="#ddd" v={3}/>
      <IsoDie ox={36} oy={44} sc={22} top="#fff" right="#bbb" left="#ddd" v={4}/>
    </svg>
  );
}

// ── Liar's Dice ────────────────────────────────────────────────────────────────
function LiarsDiceLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Cup */}
      <path d="M22,10 L16,65 Q18,72 40,72 Q62,72 64,65 L58,10 Z"
        fill="rgba(180,60,20,0.7)" stroke="rgba(255,200,150,0.3)" strokeWidth={1}/>
      <ellipse cx={40} cy={10} rx={18} ry={5} fill="rgba(200,80,30,0.8)"/>
      <ellipse cx={40} cy={10} rx={15} ry={3.5} fill="rgba(80,20,5,0.7)"/>
      {/* Visible dice peeking out */}
      <IsoDie ox={24} oy={20} sc={16} top="rgba(255,255,255,0.95)" right="rgba(200,200,200,0.9)" left="rgba(230,230,230,0.9)" v={2}/>
      <IsoDie ox={40} oy={16} sc={16} top="rgba(255,255,255,0.95)" right="rgba(200,200,200,0.9)" left="rgba(230,230,230,0.9)" v={5}/>
      {/* Question marks — "hidden" dice */}
      <text x={26} y={55} fontSize={18} fill="rgba(255,200,150,0.7)" textAnchor="middle">?</text>
      <text x={50} y={60} fontSize={14} fill="rgba(255,200,150,0.5)" textAnchor="middle">?</text>
    </svg>
  );
}

// ── Dominoes ──────────────────────────────────────────────────────────────────
function DominoesLogo() {
  function Domino({ x, y, rot, a, b }: { x:number; y:number; rot:number; a:number; b:number }) {
    const pipsAt = (v:number): [number,number][] => {
      if (v===0) return [];
      if (v===1) return [[0.5,0.5]];
      if (v===2) return [[0.25,0.3],[0.75,0.7]];
      if (v===3) return [[0.25,0.25],[0.5,0.5],[0.75,0.75]];
      if (v===4) return [[0.25,0.25],[0.75,0.25],[0.25,0.75],[0.75,0.75]];
      if (v===5) return [[0.25,0.25],[0.75,0.25],[0.5,0.5],[0.25,0.75],[0.75,0.75]];
      return [[0.25,0.2],[0.75,0.2],[0.25,0.5],[0.75,0.5],[0.25,0.8],[0.75,0.8]];
    };
    const W=30, H=14;
    return (
      <g transform={`rotate(${rot},${x+W},${y+H/2})`}
        style={{filter:"drop-shadow(1px 2px 3px rgba(0,0,0,0.5))"}}>
        <rect x={x} y={y} width={W*2} height={H} rx={2} fill="white" stroke="#ccc" strokeWidth={0.5}/>
        <line x1={x+W} y1={y+2} x2={x+W} y2={y+H-2} stroke="#ccc" strokeWidth={0.8}/>
        {pipsAt(a).map(([px,py],i)=>(
          <circle key={`a${i}`} cx={x+px*W} cy={y+py*H} r={1.6} fill="#1a1a1a"/>
        ))}
        {pipsAt(b).map(([px,py],i)=>(
          <circle key={`b${i}`} cx={x+W+px*W} cy={y+py*H} r={1.6} fill="#1a1a1a"/>
        ))}
      </g>
    );
  }
  return (
    <svg viewBox={VB} className={CLS}>
      <Domino x={4}  y={12} rot={-8} a={6} b={3}/>
      <Domino x={8}  y={32} rot={3}  a={4} b={5}/>
      <Domino x={6}  y={52} rot={-5} a={2} b={6}/>
    </svg>
  );
}
