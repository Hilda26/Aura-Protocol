Aura is a GenLayer contract where a freelance delivery-cadence agreement is re-judged by
validator consensus every interval, for as long as it runs -- not resolved once, at the end, like
every other project in this author's series (BriefBond, OriginalStake, OpenDocket, GroundTruth,
CoverPool). A client escrows the full project budget and a freelancer posts a bond sized exactly
to the worst case (bond_per_interval x strike_threshold). Every interval, anyone can
permissionlessly trigger a real consensus round: validators fetch the committed evidence source
live and judge DELIVERED, MISSED, or INSUFFICIENT_DATA against a plain-English cadence rule.

The problem: every prior project in this series only ever had to resolve one terminal question
once. Aura needs a genuinely different invariant class on top of "don't pay out twice": bounded
RECURRING liability (the bond can never be asked to cover more than it was sized for, proven by a
balance-level test that sells exactly enough strikes to reach the threshold and asserts the
freelancer receives exactly zero), and a way to dispute ONE interval's ruling without reopening
the whole agreement's already-settled history. A MISSED verdict doesn't pay out instantly -- it
arms a bonded dispute window, and the panel that re-judges a contested interval reads a recorded
snapshot (chain of custody), never the live web again.

Every lesson this author's prior GenLayer review cycles have taught is applied here from the
first submission, not discovered through review: the collateral invariant (INSUFFICIENT_DATA
never pays or releases anything), checks-effects-interactions (every balance mutation flips state
before any payout call), exact-value escrow/bond/dispute-bond matching, userinfo URL-spoofing
defense on the evidence host, and prompt-injection defense (every fetched excerpt and
party-authored string is defanged of the exact fence sequence used to delimit recorded evidence,
so a party cannot forge a recorded-evidence block). Two liveness exits cover both ways this shape
can otherwise get stuck: `abandon_stuck_dispute` (evidence that can never be judged, gated on
repeated genuine attempts plus a grace period) and `reclaim_stalled_agreement` (nobody has
triggered a due check in a long time) -- both refund every remaining balance to its rightful
owner and neither can be satisfied by an agreement that would actually have resolved properly.

How to use it: connect a wallet, create an agreement naming a freelancer, a project scope, a
cadence rule, and an evidence URL that will be checked every interval. The freelancer accepts by
posting the bond. Once an interval is due, anyone can trigger the check -- a real, multi-minute
consensus round that actually fetches the page, not an instant result.

Measured results: lint clean (16 methods, 7 view / 9 write). **33/33 direct tests passing**,
including a full-lifecycle balance-level solvency test (DELIVERED, disputed-FLIP, disputed-UPHOLD,
then a final DELIVERED to completion) proving total money paid out equals total money deposited
at the terminal state, and a structural signature-regression guard on `check_interval`. **1/1 real
StudioNet integration test passing**: a real, on-chain-reverted rejection of a wrong-value
`create_agreement` and a correctly-accepted one, a real wrong-value `accept_agreement` rejection
and a correctly-accepted one, a real, observed early-check rejection, and a real cancellation
refund. A separate live walkthrough populated the persistent deployed contract with a real,
staked, ACTIVE agreement -- browsable now.

An early deploy attempt surfaced a real engineering bug before any reviewer had to: the contract
source briefly contained non-ASCII prompt-injection-defense characters that crashed the
schema-compilation client with a UnicodeEncodeError, even though lint and all direct-mode tests
passed cleanly. Caught by actually deploying and integration-testing against real StudioNet
infrastructure -- not by source review alone -- and fixed with ASCII-only substitutes carrying
the identical defense. Full detail in `CONTRACT_STATUS.md`.

Live app: (add once deployed)
Source: https://github.com/Hilda26/Aura-Protocol
Contract (StudioNet, current): 0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E
Full design rationale: DECISION_RECORD.md
Contract test/deploy detail: CONTRACT_STATUS.md
