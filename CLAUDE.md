# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Arena 2P** — a browser-based platform for two-player online games (chess, scrabble, backgammon, go, battleship, uno, pong, street fighter, checkers, connect 4, tic-tac-toe, reversi, and more). Built with Next.js 15 App Router, TypeScript, Tailwind CSS, and Socket.io.

## Commands

```bash
npm install            # install deps (requires Node 20+)
npm run dev            # Next.js dev server on :3000
npm run server         # Socket.io server on :3001 (tsx watch)
npm run dev:all        # both servers concurrently

npm run build          # production Next.js build
npm run start          # serve production build
npm run lint           # ESLint
npm run type-check     # tsc --noEmit (no test runner yet)
```

## Architecture

### Two-process model

The app runs as two separate processes:

| Process | Command | Port | Purpose |
|---------|---------|------|---------|
| Next.js | `npm run dev` | 3000 | UI + API routes |
| Socket.io | `npm run server` | 3001 | Real-time game events |

`next.config.ts` rewrites `/socket.io/*` to `localhost:3001` in development so the browser only needs to know about port 3000.

### Data flow for a game move

```
Player clicks → game component calls getSocket().emit("game:move", roomId, move)
  → server/index.ts relays move to the other socket in the room
  → opponent's useSocket() hook fires "game:move" → addMove() in Zustand
  → game component reads moves from useGameStore() and applies the delta
```

Game state is **delta-synced**: the server forwards raw moves without interpreting them. Each game component owns its local board state and applies incoming moves itself. The server only has authority over room lifecycle (create/join/leave/resign/result).

### Key directories

```
src/
  app/                    # Next.js App Router pages
    games/[gameId]/       # Lobby page (create/join room) for each game
    room/[roomId]/        # Live game page
  components/
    games/                # One folder per game (e.g. chess/ChessBoard.tsx)
    game/                 # Shared in-room UI (GameBoard, PlayerBar, GameOverlay)
    lobby/                # Game selection UI (GameGrid, GameCard, GameLobby)
    layout/               # Navbar
    ui/                   # Primitives: Button, Card
  hooks/
    useSocket.ts          # Connects socket, wires Zustand listeners
    useRoom.ts            # create/join/leave/resign/rematch actions
  lib/
    games/registry.ts     # GAME_REGISTRY — single source of truth for all games
    socket/client.ts      # Singleton socket getter
    utils.ts              # cn(), formatTime(), generateGuestName()
  store/
    gameStore.ts          # Zustand store: room, players, moves, result, myPlayer
  types/
    game.ts               # GameId, GameMeta, GameRoom, GameMove, GamePlayer
    socket.ts             # Typed Socket.io event maps

server/
  index.ts                # Socket.io server — room lifecycle + move relay
```

### Adding a new game

1. Add `GameId` to `src/types/game.ts`
2. Add entry to `GAME_REGISTRY` in `src/lib/games/registry.ts`
3. Create `src/components/games/<id>/<ComponentName>.tsx` — receives `{ room: GameRoom }` prop
4. Register the dynamic import in `GAME_COMPONENTS` inside `src/components/game/GameBoard.tsx`

The game component is responsible for:
- Rendering the board/canvas
- Calling `getSocket().emit("game:move", roomId, move)` on local actions
- Applying opponent moves from `useGameStore().moves` via `useEffect` + `useRef` (track applied count with a ref; do **not** apply moves during render)
- Calling `useGameStore.getState().setResult(...)` when a win/draw is detected locally — this triggers the `GameOverlay`; both players detect it independently from the board state

**Currently playable:** only `tictactoe`. All other games use `components/games/_stub/GameStub.tsx` and show a "coming soon" placeholder. `TicTacToeBoard` is the reference implementation to follow.

The socket server does **not** validate game moves — all rule enforcement is client-side for now.

### Styling conventions

- All colors use the `arena-*` palette defined in `tailwind.config.ts`
- Use the `cn()` utility from `@/lib/utils` (clsx + tailwind-merge) for conditional classes
- Dark background: `arena-bg` (#0f0f1a), surfaces: `arena-surface`, accent: `arena-accent` (indigo-500)

### Socket types

`src/types/socket.ts` contains the typed `ClientToServerEvents` and `ServerToClientEvents` interfaces. The socket client (`AppSocket`) and server (`Server<...>`) are both typed against these — keep them in sync when adding new events.

### State management

Zustand (`useGameStore`) is the single source of truth for in-game state. Components should **read** from the store and **write** only via the action functions exposed by the store — never mutate state directly.

### Player identity

Players are currently anonymous guests. On first interaction `generateGuestName()` creates a random name and `uuid` generates an ID, both stored in Zustand and sent as socket auth. Persistent accounts (NextAuth) are planned but not yet implemented.
