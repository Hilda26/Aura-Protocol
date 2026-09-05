"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMenu } from "@/components/auth/WalletMenu";
import { CodeRain } from "@/components/ui/CodeRain";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/agreements", label: "Agreements" },
  { href: "/agreements/new", label: "New Agreement" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="relative min-h-screen bg-bg text-ink">
      <CodeRain />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-display text-lg tracking-[0.15em] text-ink">
              AURA<span className="text-violet-bright">.</span>
            </span>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-chip px-3 py-1.5 text-sm font-head transition-colors",
                  pathname === item.href ? "bg-panel2 text-violet-bright" : "text-muted hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <WalletMenu />
        </div>
      </header>
      <main className="relative mx-auto max-w-6xl px-6 py-10">{children}</main>
      <footer className="relative mx-auto max-w-6xl px-6 py-10 text-xs text-muted">
        Aura Protocol · GenLayer Studionet · continuous cadence, continuous judgment.
      </footer>
    </div>
  );
}
