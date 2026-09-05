import { read, writeAndWait, type WriteResult } from "./client";

export type Agreement = {
  id: number;
  client: string;
  freelancer: string;
  description: string;
  cadence_description: string;
  evidence_url: string;
  evidence_host: string;
  interval_seconds: number;
  total_intervals: number;
  payment_per_interval: bigint;
  bond_per_interval: bigint;
  strike_threshold: number;
  status:
    | "PROPOSED"
    | "ACTIVE"
    | "PENDING_SETTLEMENT"
    | "DISPUTED"
    | "COMPLETED"
    | "TERMINATED_BY_STRIKES"
    | "CANCELLED"
    | "RECLAIMED";
  escrow_balance: bigint;
  bond_balance: bigint;
  checks_done: number;
  strikes: number;
  resolution_attempts: number;
  created_at: string;
  next_check_due: string;
  pending_check_at: string;
  dispute_open: boolean;
  dispute_deadline: string;
  dispute_evidence_url: string;
  dispute_bond: bigint;
  dispute_attempts: number;
};

export type Reputation = {
  agreements_as_freelancer: number;
  agreements_as_client: number;
  completed_clean: number;
  terminated_by_strikes: number;
  strikes_received: number;
  disputes_won: number;
  disputes_lost: number;
};

function toAgreement(id: number, raw: any): Agreement {
  return {
    id,
    client: raw.client,
    freelancer: raw.freelancer,
    description: raw.description,
    cadence_description: raw.cadence_description,
    evidence_url: raw.evidence_url,
    evidence_host: raw.evidence_host,
    interval_seconds: Number(raw.interval_seconds),
    total_intervals: Number(raw.total_intervals),
    payment_per_interval: BigInt(raw.payment_per_interval),
    bond_per_interval: BigInt(raw.bond_per_interval),
    strike_threshold: Number(raw.strike_threshold),
    status: raw.status,
    escrow_balance: BigInt(raw.escrow_balance),
    bond_balance: BigInt(raw.bond_balance),
    checks_done: Number(raw.checks_done),
    strikes: Number(raw.strikes),
    resolution_attempts: Number(raw.resolution_attempts),
    created_at: raw.created_at,
    next_check_due: raw.next_check_due,
    pending_check_at: raw.pending_check_at,
    dispute_open: Boolean(raw.dispute_open),
    dispute_deadline: raw.dispute_deadline,
    dispute_evidence_url: raw.dispute_evidence_url,
    dispute_bond: BigInt(raw.dispute_bond),
    dispute_attempts: Number(raw.dispute_attempts),
  };
}

export async function getAgreement(id: number): Promise<Agreement> {
  const raw = await read("get_agreement", [id]);
  return toAgreement(id, raw);
}

export async function getAgreementCount(): Promise<number> {
  return Number(await read("get_agreement_count", []));
}

export async function listAgreementIds(): Promise<number[]> {
  const ids = await read("list_agreement_ids", []);
  return (ids as any[]).map((x) => Number(x));
}

export async function listAgreementsPage(offset: number, limit: number): Promise<Agreement[]> {
  const rows = await read("list_agreements_page", [offset, limit]);
  return (rows as any[]).map((r) => toAgreement(Number(r.id), r));
}

export async function isDisputeAbandonable(id: number): Promise<boolean> {
  return Boolean(await read("is_dispute_abandonable", [id]));
}

export async function isStalledReclaimable(id: number): Promise<boolean> {
  return Boolean(await read("is_stalled_reclaimable", [id]));
}

export async function getReputation(address: string): Promise<Reputation> {
  const raw = await read("get_reputation", [address]);
  return {
    agreements_as_freelancer: Number(raw.agreements_as_freelancer),
    agreements_as_client: Number(raw.agreements_as_client),
    completed_clean: Number(raw.completed_clean),
    terminated_by_strikes: Number(raw.terminated_by_strikes),
    strikes_received: Number(raw.strikes_received),
    disputes_won: Number(raw.disputes_won),
    disputes_lost: Number(raw.disputes_lost),
  };
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createAgreement(params: {
  freelancer: string;
  description: string;
  cadenceDescription: string;
  evidenceUrl: string;
  intervalSeconds: number;
  totalIntervals: number;
  paymentPerInterval: bigint;
  bondPerInterval: bigint;
  strikeThreshold: number;
}): Promise<WriteResult> {
  const escrow = params.paymentPerInterval * BigInt(params.totalIntervals);
  return writeAndWait(
    "create_agreement",
    [
      params.freelancer,
      params.description,
      params.cadenceDescription,
      params.evidenceUrl,
      params.intervalSeconds,
      params.totalIntervals,
      params.paymentPerInterval,
      params.bondPerInterval,
      params.strikeThreshold,
    ],
    escrow,
  );
}

export async function acceptAgreement(id: number, bondPerInterval: bigint, strikeThreshold: number): Promise<WriteResult> {
  return writeAndWait("accept_agreement", [id], bondPerInterval * BigInt(strikeThreshold));
}

export async function cancelAgreement(id: number): Promise<WriteResult> {
  return writeAndWait("cancel_agreement", [id]);
}

export async function checkInterval(id: number): Promise<WriteResult> {
  return writeAndWait("check_interval", [id]);
}

export async function settleCheck(id: number): Promise<WriteResult> {
  return writeAndWait("settle_check", [id]);
}

export async function disputeCheck(id: number, statement: string, evidenceUrl: string, bond: bigint): Promise<WriteResult> {
  return writeAndWait("dispute_check", [id, statement, evidenceUrl], bond);
}

export async function resolveDispute(id: number): Promise<WriteResult> {
  return writeAndWait("resolve_dispute", [id]);
}

export async function abandonStuckDispute(id: number): Promise<WriteResult> {
  return writeAndWait("abandon_stuck_dispute", [id]);
}

export async function reclaimStalledAgreement(id: number): Promise<WriteResult> {
  return writeAndWait("reclaim_stalled_agreement", [id]);
}

export function requiredDisputeBond(paymentPerInterval: bigint): bigint {
  const tenth = paymentPerInterval / 10n;
  return tenth > 0n ? tenth : 1n;
}
