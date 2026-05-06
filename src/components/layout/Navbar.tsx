import Link from "next/link";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-arena-border bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-arena-accent">Arena</span>
          <span className="text-xl font-bold text-arena-text">2P</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-arena-text-muted sm:flex">
          <Link href="/games" className="hover:text-arena-text transition-colors">
            Games
          </Link>
          <Link href="/leaderboard" className="hover:text-arena-text transition-colors">
            Leaderboard
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-arena-border bg-transparent px-3 py-1.5 text-sm font-medium text-arena-text transition-colors hover:bg-arena-surface"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center rounded-lg bg-arena-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-arena-accent-hover"
          >
            Play now
          </Link>
        </div>
      </div>
    </header>
  );
}
