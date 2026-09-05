# Aura Protocol demo video script

Target length: ~2.5-3 minutes. Screen-record the local app (`npm run dev`) or the deployed
frontend once published.

---

## 1. Cold open - the landing page (0:00-0:20)

**Say:**
> "This is Aura -- the first project in this GenLayer series that doesn't resolve one question
> once. It re-judges a freelance delivery cadence, every interval, for the life of the
> agreement."

---

## 2. Browse a real agreement (0:20-0:50)

Go to `/agreements`, click into agreement #0 -- real, live on StudioNet.

**Say:**
> "Here's a real agreement, live on-chain right now. The client escrowed the full budget, the
> freelancer posted a bond, and it's ACTIVE -- zero of six intervals checked so far, zero
> strikes."

Point at the escrow/bond stat tiles.

---

## 3. Why this is a different shape, not just a different domain (0:50-1:30)

**Say:**
> "Every other project I've built on GenLayer resolves once -- did the event happen, yes or no,
> done. This is different in kind: the cadence rule gets re-checked by validator consensus over
> and over, and the freelancer's bond is sized to EXACTLY the worst case -- bond per interval
> times the strike threshold. It can never be asked to cover more than that, and it's never left
> holding idle capital past it either."

---

## 4. A missed interval doesn't punish instantly (1:30-2:10)

**Say:**
> "If a check comes back MISSED, nothing pays out immediately -- it arms a dispute window. The
> freelancer can contest that ONE interval with their own evidence, bonded, without reopening
> anything else about the agreement. The panel that re-judges a dispute reads a recorded
> snapshot, never the live web again, so neither side can edit a page after the other has
> answered it."

---

## 5. Termination and completion are both automatic (2:10-2:40)

**Say:**
> "Hit the strike threshold, and the agreement ends automatically -- every remaining balance
> refunds in the same transaction. Complete every interval cleanly, and the freelancer gets
> their full bond back too. No one has to remember to close anything out."

---

## 6. Close (2:40-2:55)

Cut back to the landing page or the GitHub repo.

**Say:**
> "No claims department, no manual accounting -- the contract proves, in code, that the bond can
> never be asked for more than it was sized for, and that every terminal state releases every
> balance exactly once. Source and the deployed contract address are in the README. Thanks for
> watching."

---

## Notes for recording

- A full real check_interval consensus round needs the interval to actually elapse (minimum 1
  hour) -- narrate over the live agreement's current ACTIVE state rather than waiting for one on
  camera, or cut to a resolved interval from the direct-mode test suite's output.
- Contract address: `0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E`
- Explorer: https://explorer-studio.genlayer.com/address/0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E
