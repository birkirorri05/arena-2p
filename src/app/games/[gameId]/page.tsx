import { notFound } from "next/navigation";
import { GAME_REGISTRY } from "@/lib/games/registry";
import { GameLobby } from "@/components/lobby/GameLobby";
import type { GameId } from "@/types/game";

interface Props {
  params: Promise<{ gameId: string }>;
}

export async function generateStaticParams() {
  return Object.keys(GAME_REGISTRY).map((id) => ({ gameId: id }));
}

export async function generateMetadata({ params }: Props) {
  const { gameId } = await params;
  const game = GAME_REGISTRY[gameId as GameId];
  if (!game) return {};
  return { title: `${game.name} — Arena 2P` };
}

export default async function GamePage({ params }: Props) {
  const { gameId } = await params;
  const game = GAME_REGISTRY[gameId as GameId];
  if (!game) notFound();

  return <GameLobby game={game} />;
}
