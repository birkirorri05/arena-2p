// SVG illustrations for each game card.
// viewBox="0 0 80 56", preserveAspectRatio="slice" so they fill the square card.

import type { ReactElement } from "react";

export function GameLogo({ id }: { id: string }) {
  const map: Record<string, ReactElement> = {
    chess:      <ChessLogo />,
    scrabble:   <ScrabbleLogo />,
    backgammon: <BackgammonLogo />,
    go:         <GoLogo />,
    checkers:   <CheckersLogo />,
    connect4:   <Connect4Logo />,
    tictactoe:  <TicTacToeLogo />,
    reversi:    <ReversiLogo />,
    mancala:    <MancalaLogo />,
  };
  return map[id] ?? null;
}

const W = "rgba(255,255,255,0.90)";
const D = "rgba(255,255,255,0.18)";
const SVG = "w-full h-full";
const PAR = "xMidYMid slice";

function ChessLogo() {
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      {[0,1,2,3].flatMap(r => [0,1,2,3].map(c =>
        (r+c)%2===0
          ? <rect key={`b${r}${c}`} x={4+c*10} y={4+r*10} width={10} height={10} fill={D}/>
          : null
      ))}
      <rect x={52} y={44} width={22} height={5} rx={2.5} fill={W}/>
      <path d="M54 44 L56 26 L63 34 L66 20 L69 34 L74 26 L74 44 Z" fill={W}/>
      <circle cx={60} cy={19} r={2.5} fill={W}/>
      <circle cx={66} cy={17} r={2.5} fill={W}/>
      <circle cx={72} cy={19} r={2.5} fill={W}/>
    </svg>
  );
}

function ScrabbleLogo() {
  const tiles = [
    { x: 6,  letter: "S", pts: 1 },
    { x: 24, letter: "C", pts: 3 },
    { x: 42, letter: "R", pts: 1 },
    { x: 60, letter: "A", pts: 1 },
  ];
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      {tiles.map(({ x, letter, pts }) => (
        <g key={letter}>
          <rect x={x} y={12} width={17} height={17} rx={2} fill={W}/>
          <text x={x+8.5} y={25} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#78350f" fontFamily="serif">{letter}</text>
          <text x={x+14} y={27} textAnchor="middle" fontSize={5} fill="#a16207">{pts}</text>
        </g>
      ))}
      {[{ x:15, letter:"B", pts:3 }, { x:33, letter:"L", pts:1 }, { x:51, letter:"E", pts:1 }].map(({ x, letter }) => (
        <g key={`b${letter}`}>
          <rect x={x} y={32} width={17} height={17} rx={2} fill={W} opacity={0.6}/>
          <text x={x+8.5} y={45} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#78350f" fontFamily="serif" opacity={0.6}>{letter}</text>
        </g>
      ))}
    </svg>
  );
}

function BackgammonLogo() {
  const pts = [4,14,24,34,44,54];
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      <rect x={2} y={2} width={76} height={52} rx={2} fill="none" stroke={W} strokeWidth={1.5} opacity={0.4}/>
      {pts.map((x, i) => (
        <polygon key={`t${i}`} points={`${x+1},3 ${x+9},3 ${x+5},24`} fill={i%2===0 ? W : D} opacity={i%2===0 ? 0.85 : 0.5}/>
      ))}
      {pts.map((x, i) => (
        <polygon key={`b${i}`} points={`${x+1},53 ${x+9},53 ${x+5},32`} fill={i%2===0 ? D : W} opacity={i%2===0 ? 0.5 : 0.85}/>
      ))}
      <circle cx={8}  cy={27} r={4} fill={W}/>
      <circle cx={18} cy={27} r={4} fill={W}/>
      <circle cx={62} cy={27} r={4} fill={D} stroke={W} strokeWidth={1}/>
      <circle cx={72} cy={27} r={4} fill={D} stroke={W} strokeWidth={1}/>
    </svg>
  );
}

function GoLogo() {
  const spacing = 13, offset = 10;
  const stones = [
    [1,1,"b"],[2,0,"w"],[3,2,"b"],[1,3,"w"],[3,3,"b"],
    [0,2,"w"],[2,2,"b"],[4,1,"w"],[2,4,"b"],[4,4,"w"],
  ] as const;
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      {Array.from({length:5}, (_,i) => (
        <g key={i}>
          <line x1={offset} y1={offset+i*spacing} x2={offset+4*spacing} y2={offset+i*spacing} stroke={W} strokeWidth={0.8} opacity={0.4}/>
          <line x1={offset+i*spacing} y1={offset} x2={offset+i*spacing} y2={offset+4*spacing} stroke={W} strokeWidth={0.8} opacity={0.4}/>
        </g>
      ))}
      {stones.map(([c,r,color], i) => (
        <circle key={i} cx={offset+c*spacing} cy={offset+r*spacing} r={5}
          fill={color==="b" ? "rgba(0,0,0,0.85)" : W} stroke={W} strokeWidth={0.8}/>
      ))}
    </svg>
  );
}

function CheckersLogo() {
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      {[0,1,2,3].flatMap(r => [0,1,2,3,4].map(c =>
        (r+c)%2===1
          ? <rect key={`${r}${c}`} x={8+c*13} y={6+r*13} width={13} height={13} fill={D}/>
          : null
      ))}
      <circle cx={21}   cy={12.5} r={5} fill="rgba(239,68,68,0.9)"  stroke={W} strokeWidth={1}/>
      <circle cx={47}   cy={12.5} r={5} fill="rgba(239,68,68,0.9)"  stroke={W} strokeWidth={1}/>
      <circle cx={34}   cy={25.5} r={5} fill="rgba(239,68,68,0.9)"  stroke={W} strokeWidth={1}/>
      <circle cx={27.5} cy={38.5} r={5} fill="rgba(30,30,30,0.85)"  stroke={W} strokeWidth={1}/>
      <circle cx={53.5} cy={38.5} r={5} fill="rgba(30,30,30,0.85)"  stroke={W} strokeWidth={1}/>
      <circle cx={40.5} cy={51.5} r={5} fill="rgba(30,30,30,0.85)"  stroke={W} strokeWidth={1}/>
    </svg>
  );
}

function Connect4Logo() {
  const colors = [
    [0,0,0,0,0,0,0],
    [0,0,1,0,2,0,0],
    [0,1,2,1,2,0,0],
    [1,2,1,2,1,2,0],
  ];
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      <rect x={2} y={4} width={76} height={50} rx={4} fill="rgba(30,64,175,0.5)" stroke={W} strokeWidth={1.5} opacity={0.6}/>
      {Array.from({length:4}, (_,r) =>
        Array.from({length:7}, (_,c) => {
          const v = colors[r]?.[c] ?? 0;
          return (
            <circle key={`${r}${c}`} cx={13+c*10} cy={14+r*10} r={4}
              fill={v===1 ? "rgba(239,68,68,0.95)" : v===2 ? "rgba(250,204,21,0.95)" : "rgba(0,0,80,0.6)"}
              stroke="rgba(255,255,255,0.2)" strokeWidth={0.5}/>
          );
        })
      )}
    </svg>
  );
}

function TicTacToeLogo() {
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      <line x1={26} y1={4}  x2={26} y2={52} stroke={W} strokeWidth={2.5} opacity={0.7}/>
      <line x1={54} y1={4}  x2={54} y2={52} stroke={W} strokeWidth={2.5} opacity={0.7}/>
      <line x1={4}  y1={22} x2={76} y2={22} stroke={W} strokeWidth={2.5} opacity={0.7}/>
      <line x1={4}  y1={40} x2={76} y2={40} stroke={W} strokeWidth={2.5} opacity={0.7}/>
      <line x1={9}  y1={9}  x2={21} y2={18} stroke={W} strokeWidth={3} strokeLinecap="round"/>
      <line x1={21} y1={9}  x2={9}  y2={18} stroke={W} strokeWidth={3} strokeLinecap="round"/>
      <circle cx={40} cy={31} r={7} stroke={W} strokeWidth={3} fill="none"/>
      <line x1={59} y1={43} x2={71} y2={51} stroke={W} strokeWidth={3} strokeLinecap="round" opacity={0.7}/>
      <line x1={71} y1={43} x2={59} y2={51} stroke={W} strokeWidth={3} strokeLinecap="round" opacity={0.7}/>
    </svg>
  );
}

function ReversiLogo() {
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      <rect x={8} y={4} width={64} height={48} rx={2} fill="rgba(21,128,61,0.5)" stroke={W} strokeWidth={1} opacity={0.7}/>
      {[24,40,56].map(x => <line key={x} x1={x} y1={4}  x2={x} y2={52} stroke={W} strokeWidth={0.8} opacity={0.3}/>)}
      {[20,36,52].map(y => <line key={y} x1={8} y1={y}  x2={72} y2={y} stroke={W} strokeWidth={0.8} opacity={0.3}/>)}
      <circle cx={32} cy={24} r={9} fill="rgba(240,240,240,0.95)" stroke={W} strokeWidth={0.5}/>
      <circle cx={48} cy={24} r={9} fill="rgba(10,10,10,0.85)"    stroke={W} strokeWidth={0.5}/>
      <circle cx={32} cy={40} r={9} fill="rgba(10,10,10,0.85)"    stroke={W} strokeWidth={0.5}/>
      <circle cx={48} cy={40} r={9} fill="rgba(240,240,240,0.95)" stroke={W} strokeWidth={0.5}/>
      <circle cx={16} cy={24} r={7} fill="rgba(240,240,240,0.3)"  stroke={W} strokeWidth={0.5}/>
      <circle cx={64} cy={40} r={7} fill="rgba(10,10,10,0.3)"     stroke={W} strokeWidth={0.5}/>
    </svg>
  );
}

function MancalaLogo() {
  const pits = [14, 26, 38, 50, 62, 74];
  return (
    <svg viewBox="0 0 80 56" className={SVG} preserveAspectRatio={PAR}>
      <rect x={2}  y={10} width={12} height={36} rx={6} fill={W} opacity={0.75}/>
      <rect x={66} y={10} width={12} height={36} rx={6} fill={W} opacity={0.75}/>
      <rect x={14} y={14} width={52} height={28} rx={3} fill={W} opacity={0.15}/>
      {pits.map((x, i) => <ellipse key={`t${i}`} cx={x-6} cy={22} rx={5} ry={5} fill={W} opacity={0.8}/>)}
      {pits.map((x, i) => <ellipse key={`b${i}`} cx={x-6} cy={38} rx={5} ry={5} fill={W} opacity={0.8}/>)}
      {[8, 20, 32].map(x => <circle key={x} cx={x} cy={22} r={1.5} fill="rgba(0,0,0,0.4)"/>)}
      {[44, 56, 68].map(x => <circle key={x} cx={x} cy={38} r={1.5} fill="rgba(0,0,0,0.4)"/>)}
    </svg>
  );
}
