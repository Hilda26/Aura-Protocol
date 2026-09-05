# Aura - Decision Record

## Why a recurring cadence, not another one-shot resolution

Every prior project in this author's GenLayer series resolves exactly one terminal question at
exactly one moment. That shape is well-proven in this series, but it means the underlying
consensus primitive (`gl.nondet.web.get` + `gl.eq_principle.prompt_comparative`) has never been
asked to judge the SAME relationship more than once. Aura's core bet is that GenLayer's real
differentiator -- non-deterministic validator consensus over a genuinely ambiguous, subjective
real-world judgment -- is under-used by one-shot resolution, and better demonstrated by a
contract that keeps asking the same question, with consequences that compound (strikes) rather
than resolve.

## Why bond-sized-to-worst-case, not bond-sized-to-total-liability

An earlier design considered sizing the freelancer's bond to
`bond_per_interval * total_intervals` -- covering every interval, not just up to the strike
threshold. Rejected: reaching `strike_threshold` is ALREADY terminal (the agreement ends), so a
bond sized past that point would sit as dead capital the agreement can never actually reach far
enough into strikes to slash. Sizing the bond to EXACTLY
`bond_per_interval * strike_threshold` means the posted bond is always exactly the maximum the
agreement can ever ask for -- provable, not just intended, and checked by
`test_two_misses_terminate_by_strikes_and_refund_remainder`, which asserts the freelancer
receives exactly `0` when both strike-worthy intervals are slashed in full.

## Why a MISSED verdict arms a window instead of paying instantly

The straightforward design pays the client back and slashes the bond the instant `check_interval`
returns MISSED. Rejected: that gives the freelancer no recourse if the evidence source was
misleading, temporarily broken, or judged against outdated content -- and unlike CoverPool's
single terminal claim, a wrongly-slashed interval here recurs, compounding an error across the
rest of the agreement's life. `PENDING_SETTLEMENT` plus `DISPUTE_WINDOW_SECONDS` borrows the
same "arm, then settle" shape this author's Sigil-inspired appeal design uses for a terminal
ruling, but scoped to one interval so contesting it never blocks or reopens any other interval's
already-settled history.

## Why the dispute panel reads a snapshot, never the live web

If `resolve_dispute` re-fetched the evidence URL live, either party could wait out the dispute
window and then edit the page before resolution -- the same chain-of-custody problem CoverPool's
review and this author's Sigil-pattern research both surfaced. Both `pending_original_excerpt`
(from the original check) and `dispute_evidence_excerpt` (from the dispute filing) are fetched
and hashed once, at the moment they are first seen, and `resolve_dispute` reads only those
stored strings.

## Why abandonment resolves as UPHOLD, not a neutral/split outcome

`abandon_stuck_dispute` exists so a dead or permanently inconclusive dispute evidence source
can't strand an agreement in `DISPUTED` forever. It resolves conservatively as if the panel had
ruled UPHOLD -- the original recorded MISSED stands -- rather than inventing a third, more
lenient outcome. Reasoning: the freelancer's dispute was never actually vindicated on its
merits, so defaulting to the side that already had a decisive (if since-unconfirmable) ruling
behind it is more conservative than manufacturing a result neither panel reached. The dispute
bond IS returned, though -- the freelancer's attempt to contest was genuine and undecided, not
frivolous.

## Why party-authored text is defanged of the fence sequence, not escaped or rejected

Rejecting any statement containing `<<<`/`>>>` would let a party weaponize the fence sequence as
a denial-of-service against their own dispute. Escaping it (e.g. backslash-escaping) still risks
an LLM interpreting an escaped sequence loosely. Substitution to a fixed, unambiguous ASCII
placeholder (`(((`/`)))`) can never collide with the real fence markers used to delimit trusted
recorded evidence in the prompt, so a forged block can only ever arrive visibly defused -- and
unlike an earlier draft that used Unicode lookalikes (`‹‹‹`/`›››`), the ASCII substitution never
risks crashing an ASCII-only client that has to serialize the contract's own source code (see
`CONTRACT_STATUS.md`'s deployment note).

## Self-review

This project's pipeline deploys to real StudioNet and runs real integration tests before any
status document is written, specifically because an ASCII-encoding bug in the contract's own
source (see `CONTRACT_STATUS.md`) passed `genvm-lint` and all 33 direct-mode tests but broke
schema compilation against real infrastructure. Source-level review and unit tests are
necessary but not sufficient; this author's own audit habit across this series (GroundTruth's
checks-effects-interactions catch, CoverPool's abandon-liveness design) is to assume a passing
test suite is not proof of a working deployed system until it has actually been deployed and
exercised against it.
