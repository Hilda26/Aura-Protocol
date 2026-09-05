"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, SectionHeading } from "@/components/ui/Primitives";
import { listAgreementsPage, type Agreement } from "@/lib/genlayer/queries";
import { formatGen, shortAddr, formatDateTime } from "@/lib/format";
import { isContractConfigured, CONTRACT_MISSING_MESSAGE } from "@/lib/genlayer/config";

const STATUS_TONE: Record<Agreement["status"], "neutral" | "success" | "warning" | "danger" | "violet"> = {
  PROPOSED: "neutral",
  ACTIVE: "violet",
  PENDING_SETTLEMENT: "warning",
  DISPUTED: "danger",
  COMPLETED: "success",
  TERMINATED_BY_STRIKES: "danger",
  CANCELLED: "neutral",
  RECLAIMED: "neutral",
};

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isContractConfigured()) {
      setError(CONTRACT_MISSING_MESSAGE);
      return;
    }
    listAgreementsPage(0, 100)
      .then((rows) => setAgreements(rows.reverse()))
      .catch((e) => setError(String(e?.message || e)));
  }, []);

  return (
    <div>
      <SectionHeading eyebrow="On-chain" title="Agreements" description="Every agreement ever created, live from StudioNet." />
      {error && (
        <Card className="border-danger/40">
          <pre className="whitespace-pre-wrap text-sm text-danger">{error}</pre>
        </Card>
      )}
      {!error && agreements === null && <div className="text-sm text-muted">Loading…</div>}
      {agreements && agreements.length === 0 && <div className="text-sm text-muted">No agreements yet.</div>}
      <div className="grid gap-4 md:grid-cols-2">
        {agreements?.map((a) => (
          <Link key={a.id} href={`/agreements/${a.id}`}>
            <Card glow className="h-full transition-transform hover:-translate-y-0.5">
              <div className="flex items-start justify-between gap-3">
                <div className="font-mono text-xs text-muted">#{a.id}</div>
                <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-ink">{a.description}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
                <div>Client <span className="font-mono text-ink">{shortAddr(a.client)}</span></div>
                <div>Freelancer <span className="font-mono text-ink">{shortAddr(a.freelancer)}</span></div>
                <div>{a.checks_done}/{a.total_intervals} intervals checked</div>
                <div>{a.strikes}/{a.strike_threshold} strikes</div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs">
                <span className="text-muted">Escrow left</span>
                <span className="font-mono text-violet-bright">{formatGen(a.escrow_balance)}</span>
              </div>
              {a.status === "ACTIVE" && (
                <div className="mt-1 text-xs text-muted">Next check due {formatDateTime(a.next_check_due)}</div>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
