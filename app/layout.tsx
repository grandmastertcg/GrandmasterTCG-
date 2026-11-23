import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrandmasterTCG | UK Trading Card Market",
  description: "Search Pokémon, Magic, Yu-Gi-Oh!, One Piece and Lorcana singles. Compare condition and price, then check out in pounds."
};

export const viewport: Viewport = {
  themeColor: "#102033",
  colorScheme: "light"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
