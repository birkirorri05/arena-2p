import { GameGrid } from "@/components/lobby/GameGrid";

export const metadata = {
  title: "Games — Arena 2P",
};

export default function GamesPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-arena-text">Games</h1>
      <GameGrid />
    </div>
  );
}
