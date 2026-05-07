"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getSocket } from "@/lib/socket/client";
import { useGameStore } from "@/store/gameStore";
import { cn } from "@/lib/utils";
import type { GameRoom } from "@/types/game";

const N = 15;
const VALS: Record<string,number> = {A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10};
const DIST: [string,number][] = [["A",9],["B",2],["C",2],["D",4],["E",12],["F",2],["G",3],["H",2],["I",9],["J",1],["K",1],["L",4],["M",2],["N",6],["O",8],["P",2],["Q",1],["R",6],["S",4],["T",6],["U",4],["V",2],["W",2],["X",1],["Y",2],["Z",1]];
const TW=new Set(["0,0","0,7","0,14","7,0","7,14","14,0","14,7","14,14"]);
const DW=new Set(["1,1","2,2","3,3","4,4","7,7","10,10","11,11","12,12","13,13","1,13","2,12","3,11","4,10","10,4","11,3","12,2","13,1"]);
const TL=new Set(["1,5","1,9","5,1","5,5","5,9","5,13","9,1","9,5","9,9","9,13","13,5","13,9"]);
const DL=new Set(["0,3","0,11","2,6","2,8","3,0","3,7","3,14","6,2","6,6","6,8","6,12","7,3","7,11","8,2","8,6","8,8","8,12","11,0","11,7","11,14","12,6","12,8","14,3","14,11"]);
const PS: Record<string,string> = {TW:"bg-red-700 text-white",DW:"bg-rose-400 text-white",TL:"bg-blue-700 text-white",DL:"bg-sky-400 text-white"};

type Board = (string|null)[][];
type PT = {row:number;col:number;letter:string;rackIdx:number};
type PP = {type:"place";tiles:{row:number;col:number;letter:string}[];score:number;tilesDrawn:number};
type MP = PP|{type:"pass"};

const emptyBoard = ():Board => Array.from({length:N},()=>Array(N).fill(null));

function seededBag(seed:string):string[] {
  const arr:string[]=[];
  for(const[l,c]of DIST) for(let i=0;i<c;i++) arr.push(l);
  let h=0; for(const c of seed) h=(Math.imul(31,h)+c.charCodeAt(0))|0;
  const rng=()=>{h^=h<<13;h^=h>>17;h^=h<<5;return(h>>>0)/0x100000000;};
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}

function premOf(r:number,c:number):"TW"|"DW"|"TL"|"DL"|null {
  const k=`${r},${c}`;
  return TW.has(k)?"TW":DW.has(k)?"DW":TL.has(k)?"TL":DL.has(k)?"DL":null;
}

function wordAt(board:Board,sr:number,sc:number,horiz:boolean,nSet:Set<string>) {
  let r=sr,c=sc;
  while(true){const pr=horiz?r:r-1,pc=horiz?c-1:c;if(pr<0||pc<0||!board[pr]?.[pc])break;r=pr;c=pc;}
  const ls2:string[]=[];let wm=1,lsum=0,cr=r,cc=c;
  while(cr<N&&cc<N&&board[cr]?.[cc]){
    const l=board[cr][cc]!;const isN=nSet.has(`${cr},${cc}`);
    let v=VALS[l]??0;
    if(isN){const p=premOf(cr,cc);if(p==="DL")v*=2;else if(p==="TL")v*=3;else if(p==="DW")wm*=2;else if(p==="TW")wm*=3;}
    lsum+=v;ls2.push(l);if(horiz)cc++;else cr++;
  }
  if(ls2.length<2)return null;
  return{word:ls2.join(""),score:lsum*wm};
}

function validateAndScore(board:Board,placed:PT[],firstMove:boolean) {
  if(!placed.length) return{valid:false,score:0,words:[],error:"No tiles placed"};
  const rows=placed.map(t=>t.row),cols=placed.map(t=>t.col);
  const sR=new Set(rows).size===1,sC=new Set(cols).size===1;
  if(placed.length>1&&!sR&&!sC) return{valid:false,score:0,words:[],error:"Tiles must be in a line"};
  const tmp:Board=board.map(r=>[...r]);
  const nSet=new Set<string>();
  for(const t of placed){tmp[t.row][t.col]=t.letter;nSet.add(`${t.row},${t.col}`);}
  if(sR&&placed.length>1){const mc=Math.min(...cols),xc=Math.max(...cols);for(let c=mc;c<=xc;c++)if(!tmp[rows[0]][c])return{valid:false,score:0,words:[],error:"Gap in word"};}
  if(sC&&placed.length>1){const mr=Math.min(...rows),xr=Math.max(...rows);for(let r=mr;r<=xr;r++)if(!tmp[r][cols[0]])return{valid:false,score:0,words:[],error:"Gap in word"};}
  if(firstMove){
    if(!placed.some(t=>t.row===7&&t.col===7)) return{valid:false,score:0,words:[],error:"First move must cover ★"};
    if(placed.length<2) return{valid:false,score:0,words:[],error:"First move needs ≥2 tiles"};
  } else {
    const ok=placed.some(t=>[[t.row-1,t.col],[t.row+1,t.col],[t.row,t.col-1],[t.row,t.col+1]].some(([r2,c2])=>r2>=0&&r2<N&&c2>=0&&c2<N&&board[r2][c2]&&!nSet.has(`${r2},${c2}`)));
    if(!ok) return{valid:false,score:0,words:[],error:"Must connect to existing tiles"};
  }
  let total=0;const words:string[]=[];
  const horiz=sR&&placed.length>1;
  if(horiz||placed.length===1){const w=wordAt(tmp,rows[0],Math.min(...cols),true,nSet);if(w){total+=w.score;words.push(w.word);}}
  if((!horiz&&sC)||placed.length===1){const w=wordAt(tmp,Math.min(...rows),cols[0],false,nSet);if(w){total+=w.score;words.push(w.word);}}
  for(const t of placed){
    if(horiz){const w=wordAt(tmp,t.row,t.col,false,nSet);if(w){total+=w.score;words.push(w.word);}}
    else if(sC&&placed.length>1){const w=wordAt(tmp,t.row,t.col,true,nSet);if(w){total+=w.score;words.push(w.word);}}
  }
  if(placed.length===7)total+=50;
  if(!words.length) return{valid:false,score:0,words:[],error:"No word formed"};
  return{valid:true,score:total,words};
}

interface Props{room:GameRoom}

export default function ScrabbleBoard({room}:Props) {
  const [board,   setBoard]   = useState<Board>(emptyBoard);
  const [myRack,  setMyRack]  = useState<string[]>([]);
  const [pending, setPending] = useState<PT[]>([]);
  const [selIdx,  setSelIdx]  = useState<number|null>(null);
  const [myScore, setMyScore] = useState(0);
  const [oppScore,setOppScore]= useState(0);
  const [drawn,   setDrawn]   = useState(14);
  const [hostTurn,setHostTurn]= useState(true);
  const [passes,  setPasses]  = useState(0);
  const [error,   setError]   = useState("");
  const [lastWords,setLastWords]=useState<string[]>([]);

  const myId  = useGameStore(s=>s.myPlayerId);
  const moves = useGameStore(s=>s.moves);
  const appliedRef = useRef(0);

  const isHost   = room.hostId===myId;
  const bag      = useMemo(()=>seededBag(room.id),[room.id]);
  const isMyTurn = hostTurn===isHost;
  const gameOver = passes>=4;
  const bagLeft  = Math.max(0,bag.length-drawn);

  useEffect(()=>{
    setBoard(emptyBoard());
    setMyRack(bag.slice(isHost?0:7,isHost?7:14));
    setPending([]);setSelIdx(null);setMyScore(0);setOppScore(0);
    setDrawn(14);setHostTurn(true);setPasses(0);setError("");setLastWords([]);
    appliedRef.current=0;
  },[room.hostId,bag,isHost]);

  useEffect(()=>{
    const batch=moves.slice(appliedRef.current);
    if(!batch.length)return;
    setBoard(prev=>{
      const next=prev.map(r=>[...r])as Board;
      for(const m of batch){const p=m.payload as MP;if(p?.type==="place")for(const t of p.tiles)next[t.row][t.col]=t.letter;}
      return next;
    });
    setOppScore(v=>{let s=v;for(const m of batch){const p=m.payload as MP;if(p?.type==="place")s+=p.score;}return s;});
    setDrawn(v=>{let d=v;for(const m of batch){const p=m.payload as MP;if(p?.type==="place")d+=p.tilesDrawn;}return d;});
    setHostTurn(v=>batch.length%2===0?v:!v);
    setPasses(v=>{let s=v;for(const m of batch){const p=m.payload as MP;if(p?.type==="place")s=0;else if(p?.type==="pass")s++;}return s;});
    setLastWords(()=>{const last=batch[batch.length-1]?.payload as MP;if(last?.type==="place")return last.tiles.map(t=>t.letter).join("");return [];});
    appliedRef.current=moves.length;
  },[moves]);

  useEffect(()=>{
    if(!gameOver||useGameStore.getState().result)return;
    const winnerId=myScore>oppScore?(myId??null):myScore<oppScore?(isHost?room.playerIds[1]:room.hostId):null;
    useGameStore.getState().setResult({winnerId,reason:"highest score"});
  },[gameOver,myScore,oppScore,myId,isHost,room.playerIds,room.hostId]);

  const handleCell=useCallback((row:number,col:number)=>{
    if(room.status!=="playing"||!isMyTurn||gameOver)return;
    const pi=pending.findIndex(t=>t.row===row&&t.col===col);
    if(pi>=0){
      const t=pending[pi];
      setMyRack(r=>{const n=[...r];n[t.rackIdx]=t.letter;return n;});
      setPending(p=>p.filter((_,i)=>i!==pi));
      setSelIdx(t.rackIdx);return;
    }
    if(selIdx===null||board[row][col]||pending.some(t=>t.row===row&&t.col===col))return;
    const letter=myRack[selIdx];if(!letter)return;
    setPending(p=>[...p,{row,col,letter,rackIdx:selIdx}]);
    setMyRack(r=>{const n=[...r];n[selIdx]="";return n;});
    setSelIdx(null);
  },[isMyTurn,gameOver,pending,selIdx,board,myRack,room.status]);

  const handleSubmit=useCallback(()=>{
    if(room.status!=="playing"||!isMyTurn||!pending.length||gameOver)return;
    const isFirst=board.every(r=>r.every(c=>c===null));
    const res=validateAndScore(board,pending,isFirst);
    if(!res.valid){setError(res.error??"Invalid");return;}
    const toDraw=Math.min(pending.length,bagLeft);
    setBoard(prev=>{const next=prev.map(r=>[...r])as Board;for(const t of pending)next[t.row][t.col]=t.letter;return next;});
    setMyRack(prev=>{const n=prev.filter(l=>l!=="");return[...n,...bag.slice(drawn,drawn+toDraw)];});
    setMyScore(v=>v+res.score);setDrawn(v=>v+toDraw);
    setHostTurn(v=>!v);setPasses(0);setLastWords(res.words);setError("");setPending([]);setSelIdx(null);
    getSocket().emit("game:move",room.id,{playerId:myId??"",timestamp:Date.now(),
      payload:{type:"place",tiles:pending.map(t=>({row:t.row,col:t.col,letter:t.letter})),score:res.score,tilesDrawn:toDraw} satisfies PP});
  },[isMyTurn,pending,gameOver,board,bag,drawn,bagLeft,myId,room.id,room.status]);

  const handleRecall=useCallback(()=>{
    setMyRack(prev=>{const n=prev.filter(l=>l!=="");for(const t of pending)n.push(t.letter);return n;});
    setPending([]);setSelIdx(null);
  },[pending]);

  const handlePass=useCallback(()=>{
    if(room.status!=="playing"||!isMyTurn||gameOver)return;
    if(pending.length){setMyRack(prev=>{const n=prev.filter(l=>l!=="");for(const t of pending)n.push(t.letter);return n;});setPending([]);setSelIdx(null);}
    setHostTurn(v=>!v);setPasses(v=>v+1);setError("");
    getSocket().emit("game:move",room.id,{playerId:myId??"",timestamp:Date.now(),payload:{type:"pass"}});
  },[isMyTurn,gameOver,pending,myId,room.id,room.status]);

  const statusLine=gameOver
    ?`Game over — ${myScore>oppScore?"You win!":myScore<oppScore?"Opponent wins!":"Draw"}`
    :isMyTurn?"Your turn":`Opponent's turn${lastWords.length?` — played: ${lastWords.join(", ")}`:""}`;

  return(
    <div className="flex flex-col items-center gap-3 select-none">
      <div className="flex gap-8 text-sm">
        <span className={cn("font-semibold",isMyTurn&&!gameOver?"text-yellow-400":"text-arena-text-muted")}>You: {myScore}</span>
        <span className="text-arena-text-muted">Bag: {bagLeft}</span>
        <span className={cn("font-semibold",!isMyTurn&&!gameOver?"text-yellow-400":"text-arena-text-muted")}>Opp: {oppScore}</span>
      </div>
      <p className="text-xs text-arena-text-muted">{statusLine}</p>
      {error&&<p className="text-xs font-medium text-red-400">{error}</p>}

      <div className="overflow-auto max-w-full">
        <div style={{display:"grid",gridTemplateColumns:`repeat(${N},28px)`,width:`${N*28}px`,border:"1px solid #444"}}>
          {Array.from({length:N},(_,r)=>Array.from({length:N},(_,c)=>{
            const letter=board[r][c];
            const pt=pending.find(t=>t.row===r&&t.col===c);
            const p=premOf(r,c);
            const isCenter=r===7&&c===7&&!letter&&!pt;
            return(
              <button key={`${r},${c}`} onClick={()=>handleCell(r,c)}
                className={cn("relative flex h-7 w-7 flex-col items-center justify-center border-r border-b border-black/15 text-[9px] font-bold transition-colors",
                  pt?"bg-yellow-200 text-gray-900 ring-1 ring-inset ring-yellow-500 z-10":
                  letter?"bg-[#f5e6c8] text-gray-900":
                  p?cn(PS[p],"opacity-90"):
                  "bg-[#d8cfc4]",
                  isMyTurn&&selIdx!==null&&!letter&&!pt&&"cursor-pointer hover:brightness-110")}>
                {pt&&<><span className="text-[11px] font-bold leading-none">{pt.letter}</span><span className="text-[7px] opacity-60 leading-none">{VALS[pt.letter]??0}</span></>}
                {!pt&&letter&&<><span className="text-[11px] font-bold leading-none">{letter}</span><span className="text-[7px] opacity-50 leading-none">{VALS[letter]??0}</span></>}
                {!pt&&!letter&&(isCenter?"★":p?<span className="text-[8px]">{p}</span>:null)}
              </button>
            );
          }))}
        </div>
      </div>

      <div className="flex gap-1 rounded-xl bg-[#8B6914] p-2 shadow-lg">
        {Array.from({length:7},(_,i)=>{
          const l=myRack[i]??"";const sel=selIdx===i;
          return(
            <button key={i} onClick={()=>l&&setSelIdx(sel?null:i)} disabled={!l}
              className={cn("flex h-10 w-10 flex-col items-center justify-center rounded border-2 transition-all",
                !l?"border-amber-800 bg-amber-950 opacity-20":
                sel?"border-yellow-400 bg-yellow-100 text-gray-900 scale-110 shadow-lg":
                "border-amber-600 bg-[#f5e6c8] text-gray-900 hover:scale-105 cursor-pointer")}>
              {l&&<><span className="text-sm font-bold leading-none">{l}</span><span className="text-[8px] opacity-60 leading-none">{VALS[l]??0}</span></>}
            </button>
          );
        })}
      </div>

      {isMyTurn&&!gameOver&&(
        <div className="flex gap-2">
          <button onClick={handleSubmit} disabled={!pending.length}
            className="rounded-lg bg-green-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-40 transition-colors">
            Play ({pending.length})
          </button>
          <button onClick={handleRecall} disabled={!pending.length}
            className="rounded-lg border border-arena-border bg-arena-surface px-3 py-1.5 text-sm text-arena-text hover:bg-arena-bg disabled:opacity-40 transition-colors">
            Recall
          </button>
          <button onClick={handlePass}
            className="rounded-lg border border-arena-border bg-arena-surface px-3 py-1.5 text-sm text-arena-text hover:bg-arena-bg transition-colors">
            Pass
          </button>
        </div>
      )}
    </div>
  );
}
