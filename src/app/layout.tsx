import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Providers } from "@/components/providers/Providers";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-display", weight: ["300", "400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Arena 2P — Play 2-Player Games Online",
  description:
    "Challenge a friend or a stranger to chess, scrabble, backgammon, go, battleship, uno, pong, street fighter, and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body>
        <Providers>
          <Navbar />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
