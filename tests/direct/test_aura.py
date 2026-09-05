"""
Direct-mode tests for the Aura freelance-cadence contract.

Run with: pytest tests/direct/ -v
"""

import inspect
import sys

import pytest

from conftest import warp_to

CONTRACT = "contracts/Aura.py"

T0 = "2026-01-01T00:00:00.000000Z"

INTERVAL_SECONDS = 3600  # 1h, the minimum allowed
TOTAL_INTERVALS = 4
PAYMENT = 1000
BOND = 200
STRIKE_THRESHOLD = 2  # bond posted = BOND * STRIKE_THRESHOLD = 400

EVIDENCE_URL = "https://example.com/status"
DESCRIPTION = "Build a landing page with weekly milestone updates"
CADENCE = "A milestone update must be posted at least once every interval"


def _deploy(direct_deploy):
    return direct_deploy(CONTRACT)


def _hex(addr):
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    return "0x" + addr.hex()


def _add_seconds(iso, seconds):
    from datetime import datetime, timedelta

    dt = datetime.fromisoformat(iso.replace("Z", "+00:00")) + timedelta(seconds=seconds)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _create_agreement(
    direct_vm, c, client, freelancer,
    interval_seconds=INTERVAL_SECONDS, total_intervals=TOTAL_INTERVALS,
    payment=PAYMENT, bond=BOND, strike_threshold=STRIKE_THRESHOLD,
    evidence_url=EVIDENCE_URL, description=DESCRIPTION, cadence=CADENCE, at=T0,
):
    warp_to(direct_vm, at)
    direct_vm.sender = client
    direct_vm.value = payment * total_intervals
    aid = c.create_agreement(
        _hex(freelancer), description, cadence, evidence_url,
        interval_seconds, total_intervals, payment, bond, strike_threshold,
    )
    direct_vm.value = 0
    return aid


def _accept(direct_vm, c, freelancer, aid, bond=BOND, strike_threshold=STRIKE_THRESHOLD):
    direct_vm.sender = freelancer
    direct_vm.value = bond * strike_threshold
    c.accept_agreement(aid)
    direct_vm.value = 0


def _mock_check(direct_vm, band, reason="test reason"):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "<html>evidence</html>"})
    direct_vm.mock_llm(r".*", '{"band": "%s", "reason": "%s"}' % (band, reason))


def _mock_dispute(direct_vm, band, reason="dispute reason"):
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*", {"status": 200, "body": "<html>supplementary evidence</html>"})
    direct_vm.mock_llm(r".*", '{"band": "%s", "reason": "%s"}' % (band, reason))


def _active_agreement(direct_vm, c, client, freelancer, **kwargs):
    aid = _create_agreement(direct_vm, c, client, freelancer, **kwargs)
    _accept(direct_vm, c, freelancer, aid)
    return aid


def _dispute_bond(payment=PAYMENT):
    return max(payment // 10, 1)


# ---------------------------------------------------------------------------
# create_agreement
# ---------------------------------------------------------------------------


def test_create_agreement_happy_path(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)
    a = c.get_agreement(aid)
    assert a["status"] == "PROPOSED"
    assert a["client"].lower() == _hex(direct_alice).lower()
    assert a["freelancer"].lower() == _hex(direct_bob).lower()
    assert a["escrow_balance"] == PAYMENT * TOTAL_INTERVALS
    assert a["bond_balance"] == 0


def test_create_agreement_rejects_freelancer_equal_client(direct_vm, direct_deploy, direct_alice):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_alice), DESCRIPTION, CADENCE, EVIDENCE_URL,
            INTERVAL_SECONDS, TOTAL_INTERVALS, PAYMENT, BOND, STRIKE_THRESHOLD,
        )


def test_create_agreement_rejects_empty_cadence(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_bob), DESCRIPTION, "   ", EVIDENCE_URL,
            INTERVAL_SECONDS, TOTAL_INTERVALS, PAYMENT, BOND, STRIKE_THRESHOLD,
        )


def test_create_agreement_rejects_invalid_evidence_url(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_bob), DESCRIPTION, CADENCE, "not-a-url",
            INTERVAL_SECONDS, TOTAL_INTERVALS, PAYMENT, BOND, STRIKE_THRESHOLD,
        )


def test_create_agreement_rejects_interval_below_minimum(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_bob), DESCRIPTION, CADENCE, EVIDENCE_URL,
            60, TOTAL_INTERVALS, PAYMENT, BOND, STRIKE_THRESHOLD,
        )


def test_create_agreement_rejects_strike_threshold_above_total(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_bob), DESCRIPTION, CADENCE, EVIDENCE_URL,
            INTERVAL_SECONDS, TOTAL_INTERVALS, PAYMENT, BOND, TOTAL_INTERVALS + 1,
        )


def test_create_agreement_rejects_wrong_escrow_value(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    warp_to(direct_vm, T0)
    direct_vm.sender = direct_alice
    direct_vm.value = PAYMENT * TOTAL_INTERVALS - 1
    with direct_vm.expect_revert("EXPECTED"):
        c.create_agreement(
            _hex(direct_bob), DESCRIPTION, CADENCE, EVIDENCE_URL,
            INTERVAL_SECONDS, TOTAL_INTERVALS, PAYMENT, BOND, STRIKE_THRESHOLD,
        )


# ---------------------------------------------------------------------------
# accept_agreement / cancel_agreement
# ---------------------------------------------------------------------------


def test_accept_agreement_requires_exact_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)
    direct_vm.sender = direct_bob
    direct_vm.value = BOND * STRIKE_THRESHOLD - 1
    with direct_vm.expect_revert("EXPECTED"):
        c.accept_agreement(aid)


def test_accept_agreement_rejects_non_freelancer(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = _deploy(direct_deploy)
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)
    direct_vm.sender = direct_charlie
    direct_vm.value = BOND * STRIKE_THRESHOLD
    with direct_vm.expect_revert("EXPECTED"):
        c.accept_agreement(aid)


def test_accept_agreement_happy_path_sets_next_check_due(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    a = c.get_agreement(aid)
    assert a["status"] == "ACTIVE"
    assert a["bond_balance"] == BOND * STRIKE_THRESHOLD
    assert a["next_check_due"] == _add_seconds(T0, INTERVAL_SECONDS)


def test_cancel_agreement_refunds_client(direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    c.cancel_agreement(aid)
    assert payments == [(_hex(direct_alice).lower(), PAYMENT * TOTAL_INTERVALS)]
    assert c.get_agreement(aid)["status"] == "CANCELLED"


def test_cancel_agreement_rejects_after_acceptance(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("EXPECTED"):
        c.cancel_agreement(aid)


# ---------------------------------------------------------------------------
# check_interval -- DELIVERED / INSUFFICIENT_DATA / MISSED
# ---------------------------------------------------------------------------


def test_check_interval_rejects_before_due(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    _mock_check(direct_vm, "DELIVERED")
    with direct_vm.expect_revert("EXPECTED"):
        c.check_interval(aid)


def test_check_interval_delivered_pays_freelancer_immediately(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "DELIVERED")
    band = c.check_interval(aid)
    assert band == "DELIVERED"
    assert payments == [(_hex(direct_bob).lower(), PAYMENT)]
    a = c.get_agreement(aid)
    assert a["checks_done"] == 1
    assert a["escrow_balance"] == PAYMENT * (TOTAL_INTERVALS - 1)
    assert a["status"] == "ACTIVE"


def test_check_interval_insufficient_data_is_retryable_no_state_change(
    direct_vm, direct_deploy, direct_alice, direct_bob
):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "INSUFFICIENT_DATA")
    band = c.check_interval(aid)
    assert band == "INSUFFICIENT_DATA"
    a = c.get_agreement(aid)
    assert a["checks_done"] == 0
    assert a["resolution_attempts"] == 1
    assert a["status"] == "ACTIVE"
    assert a["escrow_balance"] == PAYMENT * TOTAL_INTERVALS


def test_check_interval_missed_arms_pending_window_no_instant_payment(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    band = c.check_interval(aid)
    assert band == "MISSED"
    assert payments == []  # nothing pays yet
    a = c.get_agreement(aid)
    assert a["status"] == "PENDING_SETTLEMENT"
    assert a["checks_done"] == 1
    assert a["dispute_deadline"] != ""


def test_check_interval_rejects_when_not_active(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)  # still PROPOSED
    _mock_check(direct_vm, "DELIVERED")
    with direct_vm.expect_revert("EXPECTED"):
        c.check_interval(aid)


# ---------------------------------------------------------------------------
# settle_check
# ---------------------------------------------------------------------------


def test_settle_check_rejects_before_window_passes(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    with direct_vm.expect_revert("EXPECTED"):
        c.settle_check(aid)


def test_settle_check_pays_client_and_slashes_bond(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["dispute_deadline"], 1))
    c.settle_check(aid)
    assert payments == [(_hex(direct_alice).lower(), PAYMENT + BOND)]
    a = c.get_agreement(aid)
    assert a["status"] == "ACTIVE"
    assert a["strikes"] == 1
    assert a["escrow_balance"] == PAYMENT * (TOTAL_INTERVALS - 1)
    assert a["bond_balance"] == BOND * STRIKE_THRESHOLD - BOND


def test_two_misses_terminate_by_strikes_and_refund_remainder(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)

    # first miss
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["dispute_deadline"], 1))
    c.settle_check(aid)
    assert c.get_agreement(aid)["status"] == "ACTIVE"

    # second miss reaches strike_threshold=2 -> terminates, remainder refunds
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["next_check_due"], 0))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["dispute_deadline"], 1))
    payments.clear()
    c.settle_check(aid)
    a = c.get_agreement(aid)
    assert a["status"] == "TERMINATED_BY_STRIKES"
    assert a["escrow_balance"] == 0
    assert a["bond_balance"] == 0
    # this settle: payment+slash to client, plus remainder refund to client (escrow),
    # plus remaining bond to freelancer
    total_to_client = sum(amt for who, amt in payments if who == _hex(direct_alice).lower())
    total_to_freelancer = sum(amt for who, amt in payments if who == _hex(direct_bob).lower())
    assert total_to_client == (PAYMENT + BOND) + PAYMENT * (TOTAL_INTERVALS - 2)
    assert total_to_freelancer == 0  # bond fully slashed away (2 * BOND == posted bond)


def test_all_delivered_completes_and_returns_full_bond(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    for _ in range(TOTAL_INTERVALS):
        a = c.get_agreement(aid)
        warp_to(direct_vm, a["next_check_due"])
        _mock_check(direct_vm, "DELIVERED")
        c.check_interval(aid)
    a = c.get_agreement(aid)
    assert a["status"] == "COMPLETED"
    assert a["escrow_balance"] == 0
    assert a["bond_balance"] == 0
    total_to_freelancer = sum(amt for who, amt in payments if who == _hex(direct_bob).lower())
    assert total_to_freelancer == PAYMENT * TOTAL_INTERVALS + BOND * STRIKE_THRESHOLD


# ---------------------------------------------------------------------------
# dispute_check / resolve_dispute
# ---------------------------------------------------------------------------


def test_dispute_check_requires_exact_bond(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond() - 1
    with direct_vm.expect_revert("EXPECTED"):
        c.dispute_check(aid, "I did deliver, see this link", EVIDENCE_URL)
    direct_vm.value = 0


def test_dispute_check_rejects_non_freelancer(direct_vm, direct_deploy, direct_alice, direct_bob, direct_charlie):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    direct_vm.sender = direct_charlie
    direct_vm.value = _dispute_bond()
    with direct_vm.expect_revert("EXPECTED"):
        c.dispute_check(aid, "not my agreement", EVIDENCE_URL)
    direct_vm.value = 0


def test_dispute_check_rejects_after_window_passed(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["dispute_deadline"], 1))
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    with direct_vm.expect_revert("EXPECTED"):
        c.dispute_check(aid, "too late but trying", EVIDENCE_URL)
    direct_vm.value = 0


def test_resolve_dispute_flip_pays_freelancer_no_strike(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)

    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    _mock_dispute(direct_vm, "FLIP")
    c.dispute_check(aid, "I did deliver, here is proof", EVIDENCE_URL)
    direct_vm.value = 0
    assert c.get_agreement(aid)["status"] == "DISPUTED"

    band = c.resolve_dispute(aid)
    assert band == "FLIP"
    a = c.get_agreement(aid)
    assert a["status"] == "ACTIVE"
    assert a["strikes"] == 0
    assert a["dispute_open"] is False
    assert payments == [(_hex(direct_bob).lower(), PAYMENT + _dispute_bond())]


def test_resolve_dispute_uphold_slashes_and_forfeits_dispute_bond(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)

    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    _mock_dispute(direct_vm, "UPHOLD")
    c.dispute_check(aid, "I claim I delivered", EVIDENCE_URL)
    direct_vm.value = 0

    band = c.resolve_dispute(aid)
    assert band == "UPHOLD"
    a = c.get_agreement(aid)
    assert a["status"] == "ACTIVE"
    assert a["strikes"] == 1
    total_to_client = sum(amt for who, amt in payments if who == _hex(direct_alice).lower())
    assert total_to_client == PAYMENT + BOND + _dispute_bond()


def test_resolve_dispute_insufficient_data_is_retryable(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    _mock_dispute(direct_vm, "UPHOLD")  # dispute_check itself doesn't judge; fine
    c.dispute_check(aid, "disputing", EVIDENCE_URL)
    direct_vm.value = 0

    _mock_dispute(direct_vm, "INSUFFICIENT_DATA")
    band = c.resolve_dispute(aid)
    assert band == "INSUFFICIENT_DATA"
    a = c.get_agreement(aid)
    assert a["status"] == "DISPUTED"
    assert a["dispute_attempts"] == 1


def test_abandon_stuck_dispute_gated_on_attempts_and_grace(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    warp_to(direct_vm, _add_seconds(T0, INTERVAL_SECONDS))
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    a = c.get_agreement(aid)
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    _mock_dispute(direct_vm, "INSUFFICIENT_DATA")
    c.dispute_check(aid, "disputing", EVIDENCE_URL)
    direct_vm.value = 0

    with direct_vm.expect_revert("EXPECTED"):
        c.abandon_stuck_dispute(aid)  # not enough attempts yet

    _mock_dispute(direct_vm, "INSUFFICIENT_DATA")
    c.resolve_dispute(aid)
    c.resolve_dispute(aid)  # now 2 attempts

    with direct_vm.expect_revert("EXPECTED"):
        c.abandon_stuck_dispute(aid)  # grace period not elapsed

    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["pending_check_at"], 7 * 24 * 3600 + 1))
    c.abandon_stuck_dispute(aid)
    a = c.get_agreement(aid)
    assert a["status"] == "ACTIVE"
    assert a["strikes"] == 1


# ---------------------------------------------------------------------------
# reclaim_stalled_agreement
# ---------------------------------------------------------------------------


def test_reclaim_stalled_agreement_rejects_before_grace(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("EXPECTED"):
        c.reclaim_stalled_agreement(aid)


def test_reclaim_stalled_agreement_refunds_both_sides(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    a = c.get_agreement(aid)
    warp_to(direct_vm, _add_seconds(a["next_check_due"], 14 * 24 * 3600 + 1))
    direct_vm.sender = direct_bob
    c.reclaim_stalled_agreement(aid)
    a = c.get_agreement(aid)
    assert a["status"] == "RECLAIMED"
    assert a["escrow_balance"] == 0
    assert a["bond_balance"] == 0
    assert payments == [
        (_hex(direct_alice).lower(), PAYMENT * TOTAL_INTERVALS),
        (_hex(direct_bob).lower(), BOND * STRIKE_THRESHOLD),
    ]


# ---------------------------------------------------------------------------
# Structural regression guard + reputation + solvency
# ---------------------------------------------------------------------------


def test_check_interval_signature_takes_only_agreement_id(direct_vm, direct_deploy):
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    sig = inspect.signature(mod.Aura.check_interval)
    params = list(sig.parameters.keys())
    assert params == ["self", "agreement_id"]


def test_reputation_updates_on_completion(direct_vm, direct_deploy, direct_alice, direct_bob):
    c = _deploy(direct_deploy)
    aid = _active_agreement(direct_vm, c, direct_alice, direct_bob)
    for _ in range(TOTAL_INTERVALS):
        a = c.get_agreement(aid)
        warp_to(direct_vm, a["next_check_due"])
        _mock_check(direct_vm, "DELIVERED")
        c.check_interval(aid)
    rep = c.get_reputation(_hex(direct_bob))
    assert rep["completed_clean"] == 1
    assert rep["agreements_as_freelancer"] == 1


def test_balance_level_solvency_across_full_lifecycle(
    direct_vm, direct_deploy, direct_alice, direct_bob, monkeypatch
):
    """Everything that ever leaves the contract must equal everything that
    ever entered it -- one DELIVERED, one disputed-and-FLIPped (no strike),
    one disputed-and-UPHELD (one strike) -- tracked at the balance level
    like this series' other solvency tests."""
    c = _deploy(direct_deploy)
    mod = sys.modules.get("_contract_Aura")
    payments = []
    monkeypatch.setattr(
        mod.Aura, "_pay",
        lambda self, to, amount: payments.append((to.as_hex.lower(), int(amount))) if int(amount) else None,
    )
    aid = _create_agreement(direct_vm, c, direct_alice, direct_bob)
    total_in = PAYMENT * TOTAL_INTERVALS
    _accept(direct_vm, c, direct_bob, aid)
    total_in += BOND * STRIKE_THRESHOLD

    # interval 1: DELIVERED
    a = c.get_agreement(aid)
    warp_to(direct_vm, a["next_check_due"])
    _mock_check(direct_vm, "DELIVERED")
    c.check_interval(aid)

    # interval 2: MISSED, disputed, FLIP
    a = c.get_agreement(aid)
    warp_to(direct_vm, a["next_check_due"])
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    total_in += _dispute_bond()
    _mock_dispute(direct_vm, "FLIP")
    c.dispute_check(aid, "delivered late but on record", EVIDENCE_URL)
    direct_vm.value = 0
    c.resolve_dispute(aid)

    # interval 3: MISSED, disputed, UPHOLD -> strikes reach threshold (2) -> terminal
    a = c.get_agreement(aid)
    warp_to(direct_vm, a["next_check_due"])
    _mock_check(direct_vm, "MISSED")
    c.check_interval(aid)
    direct_vm.sender = direct_bob
    direct_vm.value = _dispute_bond()
    total_in += _dispute_bond()
    _mock_dispute(direct_vm, "UPHOLD")
    c.dispute_check(aid, "disputing anyway", EVIDENCE_URL)
    direct_vm.value = 0
    c.resolve_dispute(aid)

    a = c.get_agreement(aid)
    # FLIP does not increment strikes, so only the UPHOLD counts -- one
    # strike, below strike_threshold=2, agreement stays ACTIVE.
    assert a["status"] == "ACTIVE"
    assert a["strikes"] == 1

    # interval 4: DELIVERED -> completes the agreement, releasing every
    # remaining balance. Only at a terminal state must total-out equal
    # total-in exactly -- mid-life, unchecked intervals' escrow and
    # unslashed bond legitimately still sit in the contract.
    a = c.get_agreement(aid)
    warp_to(direct_vm, a["next_check_due"])
    _mock_check(direct_vm, "DELIVERED")
    c.check_interval(aid)

    a = c.get_agreement(aid)
    assert a["status"] == "COMPLETED"
    assert a["escrow_balance"] == 0
    assert a["bond_balance"] == 0

    total_out = sum(amt for _, amt in payments)
    assert total_out == total_in
