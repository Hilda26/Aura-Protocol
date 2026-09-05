"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Badge } from "@/components/ui/Primitives";
import { getAgreementCount } from "@/lib/genlayer/queries";
import { isContractConfigured, CONTRACT_ADDRESS, getGenlayerExplorerAddressUrl } from "@/lib/genlayer/config";

const PILLARS = [
  {
    title: "Judged every interval, not once",
    body: "A cadence commitment is re-checked by validator consensus every interval, for the life of the agreement -- strikes accumulate automatically, no dispute required for the common case.",
  },
  {
    title: "Bounded liability by construction",
    body: "A freelancer's bond is sized to exactly bond_per_interval × strike_threshold at acceptance -- the maximum the agreement can ever slash, never more, never idle beyond that worst case.",
  },
  {
    title: "One interval disputable, not the whole deal",
    body: "A single missed-interval ruling can be contested -- bonded, evidence-snapshotted -- without reopening every other interval's already-settled history.",
  },
];

export default function HomePage() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!isContractConfigured()) return;
    getAgreementCount().then(setCount).catch(() => setCount(null));
  }, []);

  return (
    <div className="space-y-16">
      <section className="pt-8 md:pt-16">
        <div className="mb-4 font-mono text-xs uppercase tracking-[0.3em] text-violet-bright">
          GenLayer live-web consensus
        </div>
        <h1 className="font-display text-4xl leading-tight text-ink text-glow md:text-6xl">
          Delivery cadence,
          <br />
          <span className="text-violet-bright">continuously judged.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base text-muted md:text-lg">
          Every other GenLayer agreement resolves one terminal question, once. Aura is different:
          a freelance agreement commits to a recurring cadence, and validator consensus re-judges
          it every interval -- for as long as the agreement runs.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/agreements/new"><Button variant="primary">Create an Agreement</Button></Link>
          <Link href="/agreements"><Button variant="secondary">Browse Agreements</Button></Link>
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {isContractConfigured() ? (
            <>
              <Badge tone="violet">{count === null ? "…" : count} agreements on-chain</Badge>
              <a
                href={getGenlayerExplorerAddressUrl(CONTRACT_ADDRESS)}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-muted hover:text-violet-bright"
              >
                {CONTRACT_ADDRESS} ↗
              </a>
            </>
          ) : (
            <Badge tone="warning">Contract not configured</Badge>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {PILLARS.map((p) => (
          <Card key={p.title} glow>
            <h3 className="font-head text-lg text-ink">{p.title}</h3>
            <p className="mt-2 text-sm text-muted">{p.body}</p>
          </Card>
        ))}
      </section>

      <section>
        <Card>
          <h2 className="font-display text-xl text-ink">How it works</h2>
          <ol className="mt-4 space-y-3 text-sm text-muted">
            <li><span className="font-mono text-violet-bright">1.</span> A client escrows the full project budget and proposes cadence terms + an evidence source.</li>
            <li><span className="font-mono text-violet-bright">2.</span> The freelancer accepts, posting a bond sized to the worst case.</li>
            <li><span className="font-mono text-violet-bright">3.</span> Every interval, anyone can trigger <code className="font-mono text-ink">check_interval</code> -- validators fetch the evidence live and judge DELIVERED / MISSED / INSUFFICIENT_DATA.</li>
            <li><span className="font-mono text-violet-bright">4.</span> A MISSED interval arms a dispute window instead of paying instantly -- contest it, or let it settle.</li>
            <li><span className="font-mono text-violet-bright">5.</span> Reaching the strike threshold, or completing every interval, is terminal -- every remaining balance refunds automatically.</li>
          </ol>
        </Card>
      </section>
    </div>
  );
}
