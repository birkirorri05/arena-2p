import Link from "next/link";
import { GameGrid } from "@/components/lobby/GameGrid";

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="py-16 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight text-arena-text sm:text-6xl">
          Two players.{" "}
          <span className="text-arena-accent">One winner.</span>
        </h1>
        <p className="mx-auto mb-8 max-w-xl text-lg text-arena-text-muted">
          Jump into chess, scrabble, pong, street fighter, and dozens more. No
          downloads — just share a link and play.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/games"
            className="rounded-lg bg-arena-accent px-6 py-3 font-semibold text-white transition-colors hover:bg-arena-accent-hover"
          >
            Browse games
          </Link>
          <Link
            href="/games/chess"
            className="rounded-lg border border-arena-border px-6 py-3 font-semibold text-arena-text transition-colors hover:bg-arena-surface"
          >
            Quick match — Chess
          </Link>
        </div>
      </section>

      {/* Game grid */}
      <section>
        <GameGrid />
      </section>
    </div>
  );
}
