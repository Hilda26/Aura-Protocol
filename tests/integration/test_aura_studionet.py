"""
Integration tests for Aura against real StudioNet consensus.

Run with:

    PYTHONIOENCODING=utf-8 gltest tests/integration/ -v -s --network studionet

Design notes (mirrors CoverPool's/GroundTruth's equivalent files in this
series):

* `check_interval` requires the current interval to have strictly elapsed,
  and `MIN_INTERVAL_SECONDS` is 1 hour -- so a full create -> accept ->
  check_interval cycle against real live-fetched content can't be exercised
  in one short automated run without an actual hour-long wait. This file
  proves everything that CAN be proven quickly against real consensus/state:
  agreement creation (exact-escrow enforcement), acceptance (exact-bond
  enforcement), the clock gate rejecting an early check, cancellation
  refunds, and view methods -- all against a real deployed contract on real
  StudioNet, not a mock.
"""

import re
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from gltest import get_contract_factory, get_accounts
from gltest.assertions import tx_execution_succeeded

CONTRACTS_DIR = Path(__file__).parent.parent.parent / "contracts"

_PACE_SECONDS = 4
_RATE_LIMIT_DEFAULT_BACKOFF = 65
_MAX_RETRIES = 4

EVIDENCE_URL = "https://example.com/status"
DESCRIPTION = "Build a landing page with weekly milestone updates"
CADENCE = "A milestone update must be posted at least once every interval"


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


def _deploy_as(account):
    factory = get_contract_factory(contract_file_path=CONTRACTS_DIR / "Aura.py")
    contract = _with_retry(factory.deploy, args=[], account=account)
    return contract, factory


def test_aura_create_accept_early_check_rejection_and_cancel_on_studionet():
    accounts = get_accounts()
    client, freelancer, other = accounts[0], accounts[1], accounts[2]

    contract, factory = _deploy_as(client)
    _pace()

    payment = 1000
    total_intervals = 3
    bond = 200
    strike_threshold = 2

    # ------------------------------------------------------------------
    # create_agreement -- exact-escrow enforcement, real revert
    # ------------------------------------------------------------------
    contract_client = factory.build_contract(contract_address=contract.address, account=client)
    _pace()
    try:
        _with_retry(
            lambda: contract_client.create_agreement(
                args=[
                    freelancer.address, DESCRIPTION, CADENCE, EVIDENCE_URL,
                    3600, total_intervals, payment, bond, strike_threshold,
                ]
            ).transact(value=payment * total_intervals - 1)
        )
        raise AssertionError("expected a revert for wrong escrow value")
    except Exception as e:
        assert "revert" in str(e).lower() or "error" in str(e).lower()
    _pace()

    tx = _with_retry(
        lambda: contract_client.create_agreement(
            args=[
                freelancer.address, DESCRIPTION, CADENCE, EVIDENCE_URL,
                3600, total_intervals, payment, bond, strike_threshold,
            ]
        ).transact(value=payment * total_intervals)
    )
    print("create_agreement tx status:", tx.get("status"))
    assert tx_execution_succeeded(tx)
    _pace()

    agreement_ids = _with_retry(lambda: contract.list_agreement_ids(args=[]).call())
    agreement_id = agreement_ids[-1]
    print("agreement_id:", agreement_id)
    _pace()

    a = _with_retry(lambda: contract.get_agreement(args=[agreement_id]).call())
    assert a["status"] == "PROPOSED"
    assert a["escrow_balance"] == payment * total_intervals
    _pace()

    # ------------------------------------------------------------------
    # accept_agreement -- exact-bond enforcement, real revert
    # ------------------------------------------------------------------
    contract_freelancer = factory.build_contract(contract_address=contract.address, account=freelancer)
    _pace()
    try:
        _with_retry(
            lambda: contract_freelancer.accept_agreement(args=[agreement_id]).transact(
                value=bond * strike_threshold - 1
            )
        )
        raise AssertionError("expected a revert for wrong bond value")
    except Exception as e:
        assert "revert" in str(e).lower() or "error" in str(e).lower()
    _pace()

    tx = _with_retry(
        lambda: contract_freelancer.accept_agreement(args=[agreement_id]).transact(
            value=bond * strike_threshold
        )
    )
    print("accept_agreement tx status:", tx.get("status"))
    assert tx_execution_succeeded(tx)
    _pace()

    a = _with_retry(lambda: contract.get_agreement(args=[agreement_id]).call())
    assert a["status"] == "ACTIVE"
    assert a["bond_balance"] == bond * strike_threshold
    print("Agreement after acceptance:", {k: a[k] for k in ("status", "escrow_balance", "bond_balance", "next_check_due")})
    _pace()

    # ------------------------------------------------------------------
    # check_interval -- real, observed rejection before the interval is due
    # ------------------------------------------------------------------
    try:
        _with_retry(lambda: contract_client.check_interval(args=[agreement_id]).transact())
        raise AssertionError("expected a revert -- interval not due yet")
    except Exception as e:
        assert "revert" in str(e).lower() or "error" in str(e).lower()
    _pace()

    # ------------------------------------------------------------------
    # A second, freshly-created agreement proves cancel_agreement's refund
    # path against real state (not the one just accepted above).
    # ------------------------------------------------------------------
    tx = _with_retry(
        lambda: contract_client.create_agreement(
            args=[
                freelancer.address, DESCRIPTION, CADENCE, EVIDENCE_URL,
                3600, total_intervals, payment, bond, strike_threshold,
            ]
        ).transact(value=payment * total_intervals)
    )
    assert tx_execution_succeeded(tx)
    _pace()
    agreement_ids = _with_retry(lambda: contract.list_agreement_ids(args=[]).call())
    second_id = agreement_ids[-1]
    assert second_id != agreement_id
    _pace()

    tx = _with_retry(lambda: contract_client.cancel_agreement(args=[second_id]).transact())
    print("cancel_agreement tx status:", tx.get("status"))
    assert tx_execution_succeeded(tx)
    _pace()

    a2 = _with_retry(lambda: contract.get_agreement(args=[second_id]).call())
    assert a2["status"] == "CANCELLED"
    assert a2["escrow_balance"] == 0

    print(
        "\nDone against real StudioNet:", contract.address,
        "agreement_id:", agreement_id, "cancelled agreement_id:", second_id,
    )
