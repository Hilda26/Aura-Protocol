import type { Metadata } from "next";
import { Orbitron, Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/auth/Providers";
import { AppShell } from "@/components/layout/AppShell";

const display = Orbitron({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-display" });
const head = Space_Grotesk({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-head" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Aura Protocol - Continuous freelance cadence, judged by GenLayer consensus",
  description:
    "Aura is a GenLayer contract that re-judges freelance delivery cadence every interval, for the life of the agreement -- not once, at the end.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${head.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
