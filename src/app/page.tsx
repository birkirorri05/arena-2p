import Link from "next/link";
import { GameGrid } from "@/components/lobby/GameGrid";

export default function HomePage() {
  return (
    <div className="space-y-10">
      {/* Hero */}
      <section className="py-14 text-center">
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-arena-text sm:text-6xl">
          Play. Challenge.{" "}
          <span className="text-arena-accent">Win.</span>
        </h1>
        <p className="mx-auto mb-8 max-w-lg text-base text-arena-text-muted">
          Two-player games in your browser. Share a link and go.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/games/chess"
            className="rounded-md bg-arena-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-arena-accent-hover"
          >
            Play Chess
          </Link>
          <Link
            href="/games"
            className="rounded-md border border-arena-border px-6 py-2.5 text-sm font-semibold text-arena-text transition-colors hover:bg-arena-surface"
          >
            All games
          </Link>
        </div>
      </section>

      {/* Game grid */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-arena-text-muted">
          Choose a game
        </h2>
        <GameGrid />
      </section>
    </div>
  );
}
