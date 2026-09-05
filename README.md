# Aura Protocol

**Freelance delivery-cadence agreements, continuously re-judged by GenLayer live-web consensus -- not resolved once and left to die.**

**Live app:** (deploy and add link here)
**Contract (StudioNet):** [`0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E`](https://explorer-studio.genlayer.com/address/0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E)
**Source:** this repo (`contracts/Aura.py`)

## What it is

Every other project in this author's GenLayer series (BriefBond, OriginalStake, OpenDocket,
GroundTruth, CoverPool) resolves ONE terminal question at ONE moment -- did the event happen,
yes or no, once. Aura is different in kind: a client escrows a project's budget and a freelancer
posts a bond, then a recurring cadence commitment (e.g. "a milestone update at least every 7
days") is re-judged by validator consensus EVERY interval, for as long as the agreement runs.
Strikes accumulate automatically from missed intervals -- no dispute is required for the common
case -- and a single interval's ruling can be contested, bonded, without reopening the whole
agreement.

## Why this needs GenLayer

A traditional oracle can store one fixed result. It cannot read a project's public tracker,
GitHub repo, or shared doc and decide -- in plain English, against a rule the client wrote, not a
developer -- whether delivery happened on schedule, over and over, indefinitely. Aura delegates
that recurring judgment to GenLayer validator consensus via `gl.nondet.web.get` +
`gl.eq_principle.prompt_comparative`, the same primitive this author's CoverPool and GroundTruth
projects use for a single terminal judgment, applied here to an unbounded number of judgments
over one agreement's life.

## The new invariant class this project adds to the series

1. **Bounded recurring liability.** The freelancer's bond is sized to EXACTLY
   `bond_per_interval * strike_threshold` at `accept_agreement` -- the maximum the agreement can
   ever slash, because reaching `strike_threshold` is itself terminal. The bond can never be
   asked to cover more than it was posted for.
2. **A single interval is disputable without reopening the agreement.** `dispute_check` contests
   exactly the one pending interval; every other interval's history -- already-paid DELIVEREDs,
   already-settled MISSEDs -- is untouched no matter how the dispute resolves.
3. **Arm, then settle -- applied to a recurring penalty, not a one-shot escrow.** A MISSED
   interval does not pay instantly. It arms a bonded dispute window
   (`DISPUTE_WINDOW_SECONDS`), the same discipline this author's Sigil-inspired appeal pattern
   uses for a terminal ruling, here applied per-interval so a freelancer has a real, bonded path
   to contest a single missed check before any money moves.

## Verdict outcomes

| Verdict | Meaning | Fund flow |
|---|---|---|
| DELIVERED | The fetched evidence confirms on-cadence delivery | Pays the freelancer immediately |
| MISSED | The fetched evidence confirms the cadence was not met | Nothing pays yet -- arms a dispute window |
| INSUFFICIENT_DATA | Not enough information to judge right now | Retryable -- **nothing paid, nothing released** |

A disputed MISSED is re-judged from the recorded dossier only (never the live web):

| Dispute verdict | Meaning | Fund flow |
|---|---|---|
| UPHOLD | The miss stands | Same effect as an undisputed settle -- client refund + bond slash, dispute bond forfeit |
| FLIP | The freelancer's supplementary record shows delivery after all | Pays the freelancer instead, no slash, no strike, dispute bond returned |
| INSUFFICIENT_DATA | Not enough to decide | Retryable |

## Lessons carried forward from this author's prior GenLayer projects

Applied here from day one, not discovered through review, the same way this author's own
pre-submission audits have caught these classes of issue before a reviewer had to:

- **Collateral invariant.** `check_interval` and `resolve_dispute` never pay or release anything
  on an `INSUFFICIENT_DATA` verdict -- only a decisive verdict moves funds or releases capacity.
  Both are freely retryable.
- **Checks-effects-interactions.** Every terminal state flip (strikes, escrow, bond) happens
  BEFORE the corresponding payout call, in every code path (`_apply_miss`, `_apply_flip`,
  `_refund_remainder`).
- **Exact-value matching, not "at least."** `create_agreement`'s escrow, `accept_agreement`'s
  bond, and `dispute_check`'s bond all require the EXACT computed amount -- no overpay silently
  absorbed, no underpay silently accepted.
- **Userinfo URL-spoofing defense.** `evidence_url`'s host is parsed the same way as
  CoverPool's `approved_source_url` -- `https://real.test@attacker.example/` is correctly read
  as `attacker.example`, not `real.test`.
- **Prompt-injection defense.** Every fetched excerpt and every party-authored string (statement,
  cadence description, project description) is defanged of the exact fence sequence used to
  delimit recorded evidence in the prompt before it is hashed, stored, or assembled -- so a party
  cannot forge a recorded-evidence block by typing the fence markers into their own text.
- **Liveness, not just solvency.** Two dedicated exits mirror CoverPool's
  `abandon_unresolvable_claim` lesson: `abandon_stuck_dispute` (a dispute whose evidence can
  never be judged, gated on repeated genuine attempts + a grace period) and
  `reclaim_stalled_agreement` (nobody has triggered a check in a long time). Neither can be used
  to dodge an agreement that would actually have resolved on its merits.

## Verdict bucket / fund-flow specifics

See `contracts/Aura.py`'s module docstring for the full fund-flow policy and non-determinism
budget, and `CONTRACT_STATUS.md` for test coverage detail.

## Stack

Next.js (App Router), TypeScript strict, Tailwind, wagmi + viem, `genlayer-js` 1.1.8 targeting
GenLayer StudioNet.

## Contract quality gates

```bash
PYTHONIOENCODING=utf-8 genvm-lint check contracts/Aura.py --json
pytest tests/direct/ -v
gltest tests/integration/ -v -s --network studionet
```

## Getting started

```bash
# contract tests
python -m pytest tests/direct -q

# frontend
cp .env.example .env.local   # contract address prefilled for Studionet
npm install
npm run dev
```
