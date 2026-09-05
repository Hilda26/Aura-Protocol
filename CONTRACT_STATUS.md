# Aura - Contract Status

## v1 - initial submission

Aura is a new project in this author's GenLayer series, not a review-fix iteration -- but it
applies every lesson this series' prior review cycles (CoverPool, GroundTruth, OpenDocket,
OriginalStake) have already taught, from the very first submission:

1. **Collateral invariant applied from day one.** `INSUFFICIENT_DATA` from either
   `check_interval` or `resolve_dispute` never pays anything and never changes any balance or
   state -- the lesson OriginalStake's and OpenDocket's reviews required after the fact, applied
   here before any review asked for it.
2. **Checks-effects-interactions applied from day one.** Every terminal balance mutation
   (`_apply_miss`, `_apply_flip`, `_refund_remainder`) flips state and adjusts balances BEFORE
   any payout call.
3. **Exact-value matching, not "at least."** `create_agreement` requires the escrow value to
   equal `payment_per_interval * total_intervals` EXACTLY; `accept_agreement` requires the bond
   to equal `bond_per_interval * strike_threshold` EXACTLY; `dispute_check` requires the dispute
   bond to equal the computed floor-protected amount EXACTLY.
4. **Userinfo URL-spoofing defense**, same parsing as CoverPool's `approved_source_url`:
   `evidence_url`'s host strips everything before the last `@` in the authority, so
   `https://real.test@attacker.example/` is correctly read as `attacker.example`.
5. **Prompt-injection defense.** Every fetched excerpt and every party-authored string is
   defanged of the exact `<<<`/`>>>` fence sequence used to delimit recorded evidence in the
   prompt, before it is hashed, stored, or assembled into a prompt -- so a party cannot forge a
   recorded-evidence block by typing the fence markers into their own statement or cadence text.
6. **Liveness exits for both failure modes this shape can hit**: `abandon_stuck_dispute` (a
   dispute whose evidence can never be judged -- gated on `MIN_DISPUTE_ATTEMPTS_BEFORE_ABANDON`
   genuinely-failed consensus attempts AND `DISPUTE_ABANDON_GRACE_SECONDS`) and
   `reclaim_stalled_agreement` (nobody has triggered a due check in
   `STALL_RECLAIM_GRACE_SECONDS`) -- neither gate can be satisfied by an agreement that would
   actually have resolved properly, and both refund every remaining balance to its rightful
   owner.

## The new invariant class this project adds to the series

- **Bounded recurring liability.** `accept_agreement` requires the freelancer's bond to equal
  EXACTLY `bond_per_interval * strike_threshold` -- the maximum the agreement can ever slash,
  since reaching `strike_threshold` is itself terminal (`_finalize_if_terminal`). The bond can
  never be asked to cover more than it was sized for, and is never left holding idle capital
  beyond that worst case either -- every remaining bond returns at any terminal state.
- **A single interval's ruling is disputable without reopening the whole agreement.**
  `dispute_check` / `resolve_dispute` contest exactly the one currently-`PENDING_SETTLEMENT`
  interval; every other interval's already-finalized history (paid DELIVEREDs, settled MISSEDs)
  is untouched no matter the outcome. Evidence read by the dispute panel is snapshotted at the
  ORIGINAL check (chain of custody) plus whatever the freelancer pins at dispute time -- also
  snapshotted then, never re-fetched live at resolution, so neither side can edit a page after
  the other has answered it.
- **Arm-then-settle, applied per-interval.** A MISSED verdict does not pay instantly -- it arms
  `DISPUTE_WINDOW_SECONDS` before `settle_check` (permissionless) finalizes it, giving the
  freelancer a real, bonded window to contest one specific interval without blocking or
  reopening any other.

## Design choices

- **Escrow-then-accept**, same two-step commitment pattern as this series' other bilateral
  agreements: the client's full budget is committed at `create_agreement`, but nothing is
  ACTIVE (and no clock starts) until the freelancer separately posts their bond in
  `accept_agreement`. `cancel_agreement` refunds the client in full before that happens.
- **One non-deterministic round per check, retryable only on INSUFFICIENT_DATA.**
  `check_interval` may be called repeatedly if it keeps landing on INSUFFICIENT_DATA, but the
  moment it lands on DELIVERED or MISSED, that interval is settled (or pending) and
  `check_interval` cannot re-judge it. Same budget for `resolve_dispute` against the one
  currently-open dispute.
- **Premium-free reputation ledger.** `get_reputation` tracks completions, terminations,
  strikes received, and dispute win/loss per wallet -- the one thing meant to be publicly
  legible about a party's history, mirroring this series' existing reputation-surface pattern.

## Lint

`PYTHONIOENCODING=utf-8 genvm-lint check contracts/Aura.py --json` -> clean pass, 16 methods
(7 view, 9 write).

## Direct tests

`tests/direct/test_aura.py` + `tests/direct/conftest.py` (same Windows fd-0 unlink workaround
and `warp_to` helper as the rest of this series).

**33 tests, 33 passed (100%).**

Coverage includes: agreement creation validation (freelancer-equals-client rejection, empty
cadence, invalid evidence URL, interval/threshold bounds, exact-escrow enforcement), acceptance
(exact-bond enforcement, non-freelancer rejection, correct `next_check_due` seeding),
cancellation (refund, post-acceptance rejection), interval checking (early-check rejection,
DELIVERED immediate payment, INSUFFICIENT_DATA no-op retryability, MISSED arming the pending
window with no instant payment), settlement (pre-window rejection, correct payment+slash split,
two-miss termination with full remainder refund, all-delivered completion with full bond
return), disputes (exact-bond enforcement, non-freelancer rejection, post-window rejection,
FLIP paying the freelancer with no strike, UPHOLD slashing and forfeiting the dispute bond,
INSUFFICIENT_DATA retryability, two-gate abandonment), stalled-agreement reclaim (pre-grace
rejection, full dual-refund), a structural signature-regression guard on `check_interval`, a
reputation-update check, and a full-lifecycle balance-level solvency test proving total money
out equals total money in at a terminal state across a DELIVERED, a disputed-FLIP, and a
disputed-UPHOLD interval.

## Integration tests (real StudioNet)

`tests/integration/test_aura_studionet.py`, run via
`PYTHONIOENCODING=utf-8 gltest tests/integration/ -v -s --network studionet` (invoked through
`gltest_cli.main.main()` directly on this environment).

`check_interval` requires the current interval to have strictly elapsed, and
`MIN_INTERVAL_SECONDS` is 1 hour -- so a full create -> accept -> check_interval cycle against
real live-fetched content can't be exercised in one short automated run without an actual
hour-long wait. This suite proves everything that CAN be proven quickly against real
consensus/state: a real, on-chain-reverted rejection of a wrong-value `create_agreement` call
and a correctly-accepted one, a real wrong-value `accept_agreement` rejection and a
correctly-accepted one, a real, observed `check_interval` rejection before the interval is due,
and a real `cancel_agreement` refund -- all against a freshly deployed contract on real
StudioNet, not a mock.

**1 passed in 198.30s (3m18s)** against real StudioNet.

### Live walkthrough on the persistent deployment

`tests/integration/test_live_walkthrough.py` populated the actual deployed contract with a real
agreement (agreement_id 0, weekly cadence, 6 intervals, 500 GEN/interval, freelancer bond posted)
-- browsable now at the address below.

## Deployment

`0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E` on StudioNet. Schema verified via
`genlayer schema <address>` to match source exactly: 16 methods, correct param types,
`create_agreement`/`accept_agreement`/`dispute_check` correctly payable.

An earlier deploy attempt (`0xa8c7445A...`, `0x6f7Aeea4...`) surfaced a real engineering bug
before it ever reached a reviewer: the contract source briefly contained non-ASCII characters
(from an early prompt-injection defense that substituted `‹‹‹`/`›››` for the recorded-evidence
fence sequence), which crashed the schema-compilation client with a `UnicodeEncodeError` even
though `genvm-lint` and every direct-mode test passed cleanly against it. Fixed by using
ASCII-only substitutes (`(((`/`)))`) -- the same defense, without the encoding hazard. Caught by
attempting a real integration-test deploy against real StudioNet infrastructure, not by source
review alone, which is why this project's pipeline always deploys and integration-tests for
real before writing this file.
