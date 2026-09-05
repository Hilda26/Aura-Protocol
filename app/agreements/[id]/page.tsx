"use client";
import { useEffect, useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { useParams } from "next/navigation";
import { Badge, Button, Card, Input, Label, SectionHeading, StatTile, TextArea } from "@/components/ui/Primitives";
import {
  getAgreement, type Agreement, isDisputeAbandonable, isStalledReclaimable,
  acceptAgreement, cancelAgreement, checkInterval, settleCheck, disputeCheck,
  resolveDispute, abandonStuckDispute, reclaimStalledAgreement, requiredDisputeBond,
} from "@/lib/genlayer/queries";
import { formatGen, formatDateTime, shortAddr, isPast, formatSeconds } from "@/lib/format";
import { classifyError } from "@/lib/errors";
import { getGenlayerExplorerTxUrl, isContractConfigured, CONTRACT_MISSING_MESSAGE } from "@/lib/genlayer/config";

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

function eq(a?: string, b?: string) {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export default function AgreementDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { address } = useAccount();

  const [a, setA] = useState<Agreement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [abandonable, setAbandonable] = useState(false);
  const [reclaimable, setReclaimable] = useState(false);
  const [disputeStatement, setDisputeStatement] = useState("");
  const [disputeUrl, setDisputeUrl] = useState("");
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!isContractConfigured()) { setError(CONTRACT_MISSING_MESSAGE); return; }
    try {
      const agreement = await getAgreement(id);
      setA(agreement);
      if (agreement.status === "DISPUTED") setAbandonable(await isDisputeAbandonable(id));
      if (agreement.status === "ACTIVE") setReclaimable(await isStalledReclaimable(id));
    } catch (e: any) {
      setError(String(e?.message || e));
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function run(label: string, fn: () => Promise<{ hash: string }>) {
    setBusy(label);
    setError(null);
    setTxHash(null);
    try {
      const result = await fn();
      setTxHash(result.hash);
      await load();
    } catch (e) {
      setError(classifyError(e).message);
    } finally {
      setBusy(null);
    }
  }

  if (error && !a) {
    return <Card className="border-danger/40"><pre className="whitespace-pre-wrap text-sm text-danger">{error}</pre></Card>;
  }
  if (!a) return <div className="text-sm text-muted">Loading…</div>;

  const isClient = eq(address, a.client);
  const isFreelancer = eq(address, a.freelancer);
  const dueInMs = Date.parse(a.next_check_due) - now;
  const disputeDeadlineMs = Date.parse(a.dispute_deadline) - now;
  const bond = requiredDisputeBond(a.payment_per_interval);

  return (
    <div className="space-y-6">
      <SectionHeading eyebrow={`Agreement #${a.id}`} title={a.description} />

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
        <Badge tone="neutral">{a.checks_done}/{a.total_intervals} intervals</Badge>
        <Badge tone={a.strikes > 0 ? "danger" : "neutral"}>{a.strikes}/{a.strike_threshold} strikes</Badge>
        {isClient && <Badge tone="violet">You are the client</Badge>}
        {isFreelancer && <Badge tone="violet">You are the freelancer</Badge>}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatTile label="Escrow remaining" value={formatGen(a.escrow_balance)} tone="violet" />
        <StatTile label="Bond remaining" value={formatGen(a.bond_balance)} />
        <StatTile label="Payment / interval" value={formatGen(a.payment_per_interval)} />
        <StatTile label="Interval length" value={formatSeconds(a.interval_seconds)} />
      </div>

      <Card className="space-y-3">
        <h3 className="font-head text-sm uppercase tracking-wider text-muted">Cadence rule</h3>
        <p className="text-sm text-ink">{a.cadence_description}</p>
        <div className="flex flex-wrap gap-4 pt-2 text-xs text-muted">
          <span>Evidence: <a href={a.evidence_url} target="_blank" rel="noreferrer" className="font-mono text-violet-bright hover:underline">{a.evidence_host}</a></span>
          <span>Client: <span className="font-mono text-ink">{shortAddr(a.client)}</span></span>
          <span>Freelancer: <span className="font-mono text-ink">{shortAddr(a.freelancer)}</span></span>
          <span>Created: {formatDateTime(a.created_at)}</span>
        </div>
      </Card>

      {error && <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
      {txHash && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
          Confirmed: <a className="underline" href={getGenlayerExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">{txHash}</a>
        </div>
      )}

      <Card className="space-y-4">
        <h3 className="font-head text-sm uppercase tracking-wider text-muted">Actions</h3>

        {a.status === "PROPOSED" && isFreelancer && (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-muted">Accept and post a bond of <span className="font-mono text-ink">{formatGen(a.bond_per_interval * BigInt(a.strike_threshold))}</span> to activate.</p>
            <Button disabled={busy !== null} onClick={() => run("accept", () => acceptAgreement(a.id, a.bond_per_interval, a.strike_threshold))}>
              {busy === "accept" ? "Accepting…" : "Accept Agreement"}
            </Button>
          </div>
        )}
        {a.status === "PROPOSED" && isClient && (
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm text-muted">Not yet accepted -- you may cancel and reclaim your full escrow.</p>
            <Button variant="danger" disabled={busy !== null} onClick={() => run("cancel", () => cancelAgreement(a.id))}>
              {busy === "cancel" ? "Cancelling…" : "Cancel"}
            </Button>
          </div>
        )}

        {a.status === "ACTIVE" && (
          <div className="flex items-center gap-3">
            {dueInMs > 0 ? (
              <p className="flex-1 text-sm text-muted">Next interval check due in {formatSeconds(Math.max(0, Math.floor(dueInMs / 1000)))}.</p>
            ) : (
              <p className="flex-1 text-sm text-muted">This interval is due -- anyone may trigger the check.</p>
            )}
            <Button disabled={busy !== null || dueInMs > 0} onClick={() => run("check", () => checkInterval(a.id))}>
              {busy === "check" ? "Checking…" : "Check Interval"}
            </Button>
          </div>
        )}
        {a.status === "ACTIVE" && reclaimable && (isClient || isFreelancer) && (
          <div className="flex items-center gap-3 border-t border-line pt-4">
            <p className="flex-1 text-sm text-muted">Nobody has checked this agreement in a long time -- either party may dissolve it.</p>
            <Button variant="danger" disabled={busy !== null} onClick={() => run("reclaim", () => reclaimStalledAgreement(a.id))}>
              {busy === "reclaim" ? "Reclaiming…" : "Reclaim Stalled Agreement"}
            </Button>
          </div>
        )}

        {a.status === "PENDING_SETTLEMENT" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {disputeDeadlineMs > 0 ? (
                <p className="flex-1 text-sm text-muted">A MISSED verdict is pending -- disputable for {formatSeconds(Math.max(0, Math.floor(disputeDeadlineMs / 1000)))} more.</p>
              ) : (
                <p className="flex-1 text-sm text-muted">The dispute window has passed -- anyone may finalize it now.</p>
              )}
              <Button disabled={busy !== null || disputeDeadlineMs > 0} onClick={() => run("settle", () => settleCheck(a.id))}>
                {busy === "settle" ? "Settling…" : "Settle Check"}
              </Button>
            </div>
            {isFreelancer && disputeDeadlineMs > 0 && (
              <div className="space-y-3 border-t border-line pt-4">
                <Label>Your statement</Label>
                <TextArea rows={2} value={disputeStatement} onChange={(e) => setDisputeStatement(e.target.value)} placeholder="I delivered on time -- see this evidence" />
                <Label>Supplementary evidence URL</Label>
                <Input value={disputeUrl} onChange={(e) => setDisputeUrl(e.target.value)} placeholder="https://…" />
                <div className="flex items-center gap-3">
                  <p className="flex-1 text-xs text-muted">Requires a bond of {formatGen(bond)}, forfeit if the ruling is upheld.</p>
                  <Button
                    variant="secondary"
                    disabled={busy !== null || !disputeStatement || !disputeUrl}
                    onClick={() => run("dispute", () => disputeCheck(a.id, disputeStatement, disputeUrl, bond))}
                  >
                    {busy === "dispute" ? "Disputing…" : "Dispute This Interval"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {a.status === "DISPUTED" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <p className="flex-1 text-sm text-muted">A dispute is open -- anyone may permissionlessly trigger the panel to re-read the recorded dossier.</p>
              <Button disabled={busy !== null} onClick={() => run("resolve", () => resolveDispute(a.id))}>
                {busy === "resolve" ? "Resolving…" : "Resolve Dispute"}
              </Button>
            </div>
            {abandonable && (
              <div className="flex items-center gap-3 border-t border-line pt-3">
                <p className="flex-1 text-xs text-muted">The evidence has been unresolvable across repeated attempts and the grace period has elapsed.</p>
                <Button variant="danger" disabled={busy !== null} onClick={() => run("abandon", () => abandonStuckDispute(a.id))}>
                  {busy === "abandon" ? "Abandoning…" : "Abandon Stuck Dispute"}
                </Button>
              </div>
            )}
          </div>
        )}

        {["COMPLETED", "TERMINATED_BY_STRIKES", "CANCELLED", "RECLAIMED"].includes(a.status) && (
          <p className="text-sm text-muted">This agreement is terminal -- every remaining balance has already been refunded.</p>
        )}
      </Card>
    </div>
  );
}
