import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrandmasterTCG | Trading Card Singles",
  description: "Shop Pokémon, Yu-Gi-Oh!, One Piece and more trading card singles at GrandmasterTCG."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
