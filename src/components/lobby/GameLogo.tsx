// SVG game card illustrations — all native 80×80, content fills ~85% of the square.

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

const W  = "rgba(255,255,255,0.92)";
const D  = "rgba(255,255,255,0.18)";
const CLS = "w-full h-full";
const VB  = "0 0 80 80";

// ── Chess: king piece centered ─────────────────────────────────────────────
function ChessLogo() {
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Diagonal board squares */}
      <rect x={0}  y={0}  width={40} height={40} fill={D}/>
      <rect x={40} y={40} width={40} height={40} fill={D}/>
      {/* Cross */}
      <rect x={37} y={5}  width={6} height={18} rx={2.5} fill={W}/>
      <rect x={29} y={10} width={22} height={7} rx={2.5} fill={W}/>
      {/* Crown collar */}
      <rect x={26} y={23} width={28} height={7}  rx={2} fill={W}/>
      {/* Body — shoulders widen toward base */}
      <path d="M29,30 Q22,43 23,55 L57,55 Q58,43 51,30 Z" fill={W}/>
      {/* Base plates */}
      <rect x={17} y={55} width={46} height={8}  rx={3} fill={W}/>
      <rect x={12} y={63} width={56} height={9}  rx={4} fill={W}/>
    </svg>
  );
}

// ── Scrabble: 2×2 tile grid spelling "WORD" ────────────────────────────────
function ScrabbleLogo() {
  const tiles = [
    { x: 7,  y: 7,  letter: "W", pts: 4 },
    { x: 43, y: 7,  letter: "O", pts: 1 },
    { x: 7,  y: 43, letter: "R", pts: 1 },
    { x: 43, y: 43, letter: "D", pts: 2 },
  ];
  return (
    <svg viewBox={VB} className={CLS}>
      {tiles.map(({ x, y, letter, pts }) => (
        <g key={letter}>
          <rect x={x} y={y} width={32} height={32} rx={3} fill={W}/>
          <text x={x+16} y={y+23} textAnchor="middle" fontSize={17} fontWeight="bold"
            fill="#78350f" fontFamily="serif">{letter}</text>
          <text x={x+27} y={y+30} textAnchor="middle" fontSize={8}
            fill="#a16207">{pts}</text>
        </g>
      ))}
    </svg>
  );
}

// ── Backgammon: 4 triangles top + 4 bottom with pieces ────────────────────
function BackgammonLogo() {
  // 4 triangles symmetrically placed. Each 14px wide, gap 6px, margins 3px.
  // xs = left edge of each triangle: 3, 23, 43, 63
  const xs = [3, 23, 43, 63];
  const tw = 14;
  return (
    <svg viewBox={VB} className={CLS}>
      <rect x={2} y={2} width={76} height={76} rx={4} fill="none" stroke={W} strokeWidth={1.5} opacity={0.35}/>
      {/* Top triangles pointing down to y=42 */}
      {xs.map((x, i) => (
        <polygon key={`t${i}`}
          points={`${x},4 ${x+tw},4 ${x+tw/2},42`}
          fill={i%2===0 ? W : D}
        />
      ))}
      {/* Bottom triangles pointing up to y=38 */}
      {xs.map((x, i) => (
        <polygon key={`b${i}`}
          points={`${x},76 ${x+tw},76 ${x+tw/2},38`}
          fill={i%2===0 ? D : W}
        />
      ))}
      {/* Checker pieces in center */}
      {[10, 30, 50, 70].map((cx, i) => (
        <circle key={i} cx={cx} cy={40} r={6}
          fill={i%2===0 ? W : "rgba(20,20,20,0.85)"}
          stroke={W} strokeWidth={1}/>
      ))}
    </svg>
  );
}

// ── Go: 5×5 grid with black and white stones ──────────────────────────────
function GoLogo() {
  const step = 16, start = 8;  // grid: x/y 8..72, 5 lines
  const black: [number,number][] = [[1,0],[2,1],[0,2],[3,2],[1,4],[4,3]];
  const white: [number,number][] = [[0,0],[3,1],[2,3],[4,1],[0,4],[2,4]];
  // Placed so neither color dominates visually and stones are spread evenly
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Grid */}
      {Array.from({length:5}, (_,i) => (
        <g key={i}>
          <line x1={start} y1={start+i*step} x2={start+4*step} y2={start+i*step}
            stroke={W} strokeWidth={1} opacity={0.55}/>
          <line x1={start+i*step} y1={start} x2={start+i*step} y2={start+4*step}
            stroke={W} strokeWidth={1} opacity={0.55}/>
        </g>
      ))}
      {/* Star points */}
      {[[1,1],[3,1],[1,3],[3,3]].map(([c,r]) => (
        <circle key={`h${c}${r}`} cx={start+c*step} cy={start+r*step} r={2.5}
          fill={W} opacity={0.55}/>
      ))}
      {/* Black stones */}
      {black.map(([c,r],i) => (
        <circle key={`b${i}`} cx={start+c*step} cy={start+r*step} r={7}
          fill="rgba(10,10,10,0.90)" stroke={W} strokeWidth={1.2}/>
      ))}
      {/* White stones */}
      {white.map(([c,r],i) => (
        <circle key={`w${i}`} cx={start+c*step} cy={start+r*step} r={7}
          fill={W} stroke="rgba(255,255,255,0.5)" strokeWidth={1}/>
      ))}
    </svg>
  );
}

// ── Checkers: 4×4 board with red and dark pieces ──────────────────────────
function CheckersLogo() {
  const sq = 18, start = 4;   // board: 4..76 × 4..76 (72×72)
  const half = sq / 2;
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Board squares */}
      {Array.from({length:4}, (_,r) =>
        Array.from({length:4}, (_,c) =>
          (r+c)%2===1
            ? <rect key={`${r}${c}`} x={start+c*sq} y={start+r*sq} width={sq} height={sq} fill={D}/>
            : null
        )
      )}
      <rect x={start} y={start} width={4*sq} height={4*sq} fill="none" stroke={W} strokeWidth={1.5} opacity={0.4}/>
      {/* Red pieces — rows 0-1, dark squares */}
      {[0,1].flatMap(r => [0,1,2,3].filter(c=>(r+c)%2===1).map(c => (
        <g key={`r${r}${c}`}>
          <circle cx={start+c*sq+half} cy={start+r*sq+half} r={7}
            fill="rgba(220,38,38,0.90)" stroke={W} strokeWidth={1.5}/>
          <circle cx={start+c*sq+half} cy={start+r*sq+half} r={3.5}
            fill="none" stroke={W} strokeWidth={1} opacity={0.5}/>
        </g>
      )))}
      {/* Dark pieces — rows 2-3, dark squares */}
      {[2,3].flatMap(r => [0,1,2,3].filter(c=>(r+c)%2===1).map(c => (
        <g key={`d${r}${c}`}>
          <circle cx={start+c*sq+half} cy={start+r*sq+half} r={7}
            fill="rgba(15,15,15,0.88)" stroke={W} strokeWidth={1.5}/>
          <circle cx={start+c*sq+half} cy={start+r*sq+half} r={3.5}
            fill="none" stroke={W} strokeWidth={1} opacity={0.4}/>
        </g>
      )))}
    </svg>
  );
}

// ── Connect 4: 6×5 grid centered ─────────────────────────────────────────
function Connect4Logo() {
  const cols = 6, rows = 5, cs = 12;
  const sx = 4, sy = 10;   // grid: x 4..76, y 10..70 → centred at (40,40)
  const state = [
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [0,0,1,0,2,0],
    [0,1,2,1,2,0],
    [1,2,1,2,1,2],
  ];
  return (
    <svg viewBox={VB} className={CLS}>
      <rect x={sx-2} y={sy-2} width={cols*cs+4} height={rows*cs+4} rx={5}
        fill="rgba(30,64,175,0.55)" stroke={W} strokeWidth={1.5} opacity={0.7}/>
      {state.map((row,r) =>
        row.map((v,c) => (
          <circle key={`${r}${c}`}
            cx={sx+c*cs+cs/2} cy={sy+r*cs+cs/2} r={4.5}
            fill={v===1 ? "rgba(239,68,68,0.95)" : v===2 ? "rgba(250,204,21,0.95)" : "rgba(0,0,50,0.5)"}
            stroke="rgba(255,255,255,0.15)" strokeWidth={0.5}/>
        ))
      )}
    </svg>
  );
}

// ── Tic Tac Toe: large grid filling the square ────────────────────────────
function TicTacToeLogo() {
  const lw = 4;
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Grid — lines at 1/3 and 2/3 of 80 */}
      <line x1={27} y1={5}  x2={27} y2={75} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.85}/>
      <line x1={53} y1={5}  x2={53} y2={75} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.85}/>
      <line x1={5}  y1={27} x2={75} y2={27} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.85}/>
      <line x1={5}  y1={53} x2={75} y2={53} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.85}/>
      {/* X — top-left cell (centre 14,14) */}
      <line x1={6}  y1={6}  x2={22} y2={22} stroke={W} strokeWidth={lw} strokeLinecap="round"/>
      <line x1={22} y1={6}  x2={6}  y2={22} stroke={W} strokeWidth={lw} strokeLinecap="round"/>
      {/* O — centre cell (centre 40,40) */}
      <circle cx={40} cy={40} r={10} stroke={W} strokeWidth={lw} fill="none"/>
      {/* X — bottom-right cell (centre 66,66) */}
      <line x1={58} y1={58} x2={74} y2={74} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.7}/>
      <line x1={74} y1={58} x2={58} y2={74} stroke={W} strokeWidth={lw} strokeLinecap="round" opacity={0.7}/>
      {/* O — top-right cell (centre 66,14) */}
      <circle cx={66} cy={14} r={8}  stroke={W} strokeWidth={lw} fill="none" opacity={0.6}/>
    </svg>
  );
}

// ── Reversi: 4×4 board with alternating discs ────────────────────────────
function ReversiLogo() {
  const sq = 18, start = 4;   // board: 4..76 × 4..76
  const half = sq / 2;
  return (
    <svg viewBox={VB} className={CLS}>
      <rect x={start} y={start} width={4*sq} height={4*sq} rx={3}
        fill="rgba(21,128,61,0.40)" stroke={W} strokeWidth={1} opacity={0.6}/>
      {[1,2,3].map(i => (
        <g key={i}>
          <line x1={start+i*sq} y1={start} x2={start+i*sq} y2={start+4*sq}
            stroke={W} strokeWidth={0.8} opacity={0.3}/>
          <line x1={start} y1={start+i*sq} x2={start+4*sq} y2={start+i*sq}
            stroke={W} strokeWidth={0.8} opacity={0.3}/>
        </g>
      ))}
      {Array.from({length:4}, (_,r) =>
        Array.from({length:4}, (_,c) => (
          <circle key={`${r}${c}`}
            cx={start+c*sq+half} cy={start+r*sq+half} r={7}
            fill={(r+c)%2===0 ? "rgba(240,240,240,0.92)" : "rgba(12,12,12,0.88)"}
            stroke={W} strokeWidth={0.8}/>
        ))
      )}
    </svg>
  );
}

// ── Mancala: stores + 3 pits per row ─────────────────────────────────────
function MancalaLogo() {
  const pitCx = [27, 40, 53];
  return (
    <svg viewBox={VB} className={CLS}>
      {/* Board */}
      <rect x={3} y={11} width={74} height={58} rx={14}
        fill={D} stroke={W} strokeWidth={1.5} opacity={0.4}/>
      {/* Stores */}
      <ellipse cx={11} cy={40} rx={6} ry={22} fill={W} opacity={0.85}/>
      <ellipse cx={69} cy={40} rx={6} ry={22} fill={W} opacity={0.85}/>
      {/* Top row pits */}
      {pitCx.map((cx,i) => (
        <circle key={`t${i}`} cx={cx} cy={27} r={8} fill={W} opacity={0.88}/>
      ))}
      {/* Bottom row pits */}
      {pitCx.map((cx,i) => (
        <circle key={`b${i}`} cx={cx} cy={53} r={8} fill={W} opacity={0.88}/>
      ))}
      {/* Seeds in alternating pits */}
      {[[27,27],[40,53],[53,27]].map(([cx,cy],i) => (
        <g key={i}>
          <circle cx={cx-3} cy={cy-2} r={1.8} fill="rgba(0,0,0,0.35)"/>
          <circle cx={cx+3} cy={cy-2} r={1.8} fill="rgba(0,0,0,0.35)"/>
          <circle cx={cx}   cy={cy+3} r={1.8} fill="rgba(0,0,0,0.35)"/>
        </g>
      ))}
    </svg>
  );
}
