"""
Live walkthrough against the ALREADY-DEPLOYED Aura contract on StudioNet
(not a fresh throwaway deploy) -- populates the persistent contract with a
real agreement, real escrow, and a real posted bond.

Run with:
    gltest tests/integration/test_live_walkthrough.py -v -s --network studionet
"""

import re
import time

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

CONTRACT_ADDRESS = "0x4F9556cB8a5E720B822De216e77254ec8d7F2b7E"
CONTRACT_PATH = "Aura.py"

_PACE_SECONDS = 5
_RATE_LIMIT_DEFAULT_BACKOFF = 65
_MAX_RETRIES = 6

EVIDENCE_URL = "https://en.wikipedia.org/wiki/Freelancer"
DESCRIPTION = "Build and maintain a marketing landing page with weekly milestone updates"
CADENCE = "A milestone update must be posted at least once every interval, describing concrete progress"


def _pace():
    time.sleep(_PACE_SECONDS)


def _extract_retry_after(exc: Exception) -> int:
    m = re.search(r"retry_after_seconds['\"]?\s*[:=]\s*(\d+)", str(exc))
    return int(m.group(1)) if m else _RATE_LIMIT_DEFAULT_BACKOFF


def _is_rate_limit_error(exc: Exception) -> bool:
    return "rate limit" in str(exc).lower()


def _with_retry(fn, *args, **kwargs):
    last_exc = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:  # noqa: BLE001
            if not _is_rate_limit_error(e):
                raise
            last_exc = e
            wait = _extract_retry_after(e)
            print(f"[rate-limit] attempt {attempt + 1}/{_MAX_RETRIES + 1} backing off {wait}s: {e}")
            time.sleep(wait)
    raise last_exc


def test_live_walkthrough_on_deployed_contract():
    accounts = get_accounts()
    client, freelancer = accounts[0], accounts[1]
    print("client:    ", client.address)
    print("freelancer:", freelancer.address)

    factory = get_contract_factory(contract_file_path=CONTRACT_PATH)
    contract_client = factory.build_contract(contract_address=CONTRACT_ADDRESS, account=client)
    _pace()

    # Amounts are denominated in GEN, not raw wei. An earlier run used 500
    # wei per interval, which is dust: the app then displayed a meaningless
    # figure for every escrow, bond and payment on the flagship agreement.
    # 0.01 GEN per interval over 6 intervals escrows 0.06 GEN, and a 0.005
    # GEN bond against a 3-strike threshold posts 0.015 GEN -- the exact
    # worst case the contract can ever slash.
    payment = 10 ** 16       # 0.01 GEN per interval
    total_intervals = 6      # -> 0.06 GEN escrowed
    bond = 5 * 10 ** 15      # 0.005 GEN per interval
    strike_threshold = 3     # -> 0.015 GEN bonded
    interval_seconds = 7 * 24 * 3600  # weekly cadence

    tx = _with_retry(
        lambda: contract_client.create_agreement(
            args=[
                freelancer.address, DESCRIPTION, CADENCE, EVIDENCE_URL,
                interval_seconds, total_intervals, payment, bond, strike_threshold,
            ]
        ).transact(value=payment * total_intervals)
    )
    print("create_agreement tx status:", tx.get("status"))
    assert tx_execution_succeeded(tx)
    _pace()

    agreement_ids = _with_retry(lambda: contract_client.list_agreement_ids(args=[]).call())
    agreement_id = agreement_ids[-1]
    print("agreement_id:", agreement_id)
    _pace()

    contract_freelancer = factory.build_contract(contract_address=CONTRACT_ADDRESS, account=freelancer)
    _pace()
    tx = _with_retry(
        lambda: contract_freelancer.accept_agreement(args=[agreement_id]).transact(
            value=bond * strike_threshold
        )
    )
    print("accept_agreement tx status:", tx.get("status"))
    assert tx_execution_succeeded(tx)
    _pace()

    a = _with_retry(lambda: contract_client.get_agreement(args=[agreement_id]).call())
    print(
        "Agreement now live:",
        {k: a[k] for k in ("status", "escrow_balance", "bond_balance", "total_intervals", "next_check_due")},
    )

    print(
        "\nDone. Live contract now has real, browsable, staked, ACTIVE data at:",
        CONTRACT_ADDRESS,
        "agreement_id:", agreement_id,
    )
    print("First interval check comes due at:", a["next_check_due"])
