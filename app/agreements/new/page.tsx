"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Input, Label, SectionHeading, TextArea } from "@/components/ui/Primitives";
import { createAgreement } from "@/lib/genlayer/queries";
import { parseGenToWei, formatGen } from "@/lib/format";
import { classifyError } from "@/lib/errors";
import { isContractConfigured, CONTRACT_MISSING_MESSAGE } from "@/lib/genlayer/config";

export default function NewAgreementPage() {
  const router = useRouter();
  const [freelancer, setFreelancer] = useState("");
  const [description, setDescription] = useState("");
  const [cadence, setCadence] = useState("A milestone update must be posted at least once every interval");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [intervalDays, setIntervalDays] = useState("7");
  const [totalIntervals, setTotalIntervals] = useState("4");
  const [payment, setPayment] = useState("100");
  const [bond, setBond] = useState("20");
  const [strikeThreshold, setStrikeThreshold] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const paymentWei = parseGenToWei(payment);
  const bondWei = parseGenToWei(bond);
  const nIntervals = Number(totalIntervals) || 0;
  const nThreshold = Number(strikeThreshold) || 0;
  const escrowTotal = paymentWei && nIntervals ? paymentWei * BigInt(nIntervals) : null;
  const bondTotal = bondWei && nThreshold ? bondWei * BigInt(nThreshold) : null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isContractConfigured()) { setError(CONTRACT_MISSING_MESSAGE); return; }
    if (!paymentWei || !bondWei) { setError("Enter valid GEN amounts."); return; }
    setSubmitting(true);
    try {
      const result = await createAgreement({
        freelancer,
        description,
        cadenceDescription: cadence,
        evidenceUrl,
        intervalSeconds: Number(intervalDays) * 86400,
        totalIntervals: nIntervals,
        paymentPerInterval: paymentWei,
        bondPerInterval: bondWei,
        strikeThreshold: nThreshold,
      });
      setTxHash(result.hash);
      setTimeout(() => router.push("/agreements"), 1200);
    } catch (err) {
      setError(classifyError(err).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <SectionHeading
        eyebrow="Client"
        title="Create an Agreement"
        description="You escrow the full project budget now. The named freelancer must separately post a bond to activate it."
      />
      <form onSubmit={onSubmit} className="grid gap-6 md:grid-cols-[2fr_1fr]">
        <Card className="space-y-5">
          <div>
            <Label>Freelancer wallet address</Label>
            <Input value={freelancer} onChange={(e) => setFreelancer(e.target.value)} placeholder="0x…" required />
          </div>
          <div>
            <Label>Project scope</Label>
            <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} required placeholder="Build a landing page with weekly milestone updates" />
          </div>
          <div>
            <Label>Cadence rule (what counts as on-schedule)</Label>
            <TextArea value={cadence} onChange={(e) => setCadence(e.target.value)} rows={2} required />
          </div>
          <div>
            <Label>Evidence URL (checked every interval)</Label>
            <Input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="https://…" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Interval length (days)</Label>
              <Input type="number" min={1} value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} required />
            </div>
            <div>
              <Label>Total intervals</Label>
              <Input type="number" min={1} max={52} value={totalIntervals} onChange={(e) => setTotalIntervals(e.target.value)} required />
            </div>
            <div>
              <Label>Payment per interval (GEN)</Label>
              <Input value={payment} onChange={(e) => setPayment(e.target.value)} required />
            </div>
            <div>
              <Label>Bond per interval (GEN)</Label>
              <Input value={bond} onChange={(e) => setBond(e.target.value)} required />
            </div>
            <div>
              <Label>Strike threshold</Label>
              <Input type="number" min={1} value={strikeThreshold} onChange={(e) => setStrikeThreshold(e.target.value)} required />
            </div>
          </div>
          {error && <div className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</div>}
          {txHash && <div className="rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">Submitted: {txHash}</div>}
          <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Escrow & Create Agreement"}</Button>
        </Card>
        <Card className="h-fit space-y-3">
          <h3 className="font-head text-sm uppercase tracking-wider text-muted">Summary</h3>
          <div className="flex justify-between text-sm"><span className="text-muted">You escrow now</span><span className="font-mono text-violet-bright">{escrowTotal !== null ? formatGen(escrowTotal) : "—"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Freelancer must bond</span><span className="font-mono text-ink">{bondTotal !== null ? formatGen(bondTotal) : "—"}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted">Max strikes before termination</span><span className="font-mono text-ink">{nThreshold || "—"}</span></div>
          <p className="pt-2 text-xs text-muted">
            The bond is sized exactly to bond_per_interval × strike_threshold -- the freelancer can never be
            asked to cover more than the agreement can ever slash.
          </p>
        </Card>
      </form>
    </div>
  );
}
