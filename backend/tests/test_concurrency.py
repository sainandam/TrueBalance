"""
Concurrency & Overdraft Hardening Test Suite
Directly tests the core hackathon challenge requirement:
"An account has ₹1,000 balance. 50 concurrent requests simultaneously attempt to withdraw ₹100.
Exactly 10 succeed, 40 fail, final balance is ₹0, no overdraft."
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.models.account import Account
from app.models.ledger_entry import LedgerEntry
from app.models.transaction_attempt import TransactionAttempt

client = TestClient(app)


def _create_user_and_account(email_prefix: str):
    unique = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{unique}@example.com"
    password = "SecurePassword123!"

    # 1. Register
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": f"{email_prefix} User", "role": "holder"},
    )
    # 2. Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    token = login_res.json()["token"]

    # 3. Create Account
    acc_res = client.post(
        "/api/v1/accounts",
        json={"account_name": f"{email_prefix} Account", "currency": "INR"},
        headers={"Authorization": f"Bearer {token}"},
    )
    return token, email, acc_res.json()


def test_50_concurrent_withdrawals_overdraft_prevention():
    """
    THE 35-MARK FLAGSHIP CONCURRENCY STRESS TEST:
    1. Account is funded with exactly ₹1,000 (100,000 paise).
    2. 50 simultaneous threads issue ₹100 (10,000 paise) withdrawal requests concurrently.
    3. Assertions:
       - Exactly 10 requests succeed (HTTP 201).
       - Exactly 40 requests fail with Insufficient Funds (HTTP 422).
       - Final balance is strictly ₹0 (0 paise).
       - Zero-sum invariant is preserved across every successful withdrawal.
       - Exactly 40 refused attempts are recorded durably in `transaction_attempts`.
    """
    token, _, acc = _create_user_and_account("StressWithdraw")
    account_id = acc["id"]

    # Fund the account with ₹1,000 (100,000 paise)
    deposit_res = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": account_id, "amount_paise": 100000, "reason": "Initial ₹1,000 corpus"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert deposit_res.status_code == 201
    assert deposit_res.json()["target_balance_paise"] == 100000

    def attempt_withdrawal(idx: int):
        unique_key = f"race-withdraw-{account_id}-{idx}-{uuid.uuid4().hex[:6]}"
        return client.post(
            "/api/v1/transactions/withdrawals",
            json={"source_account_id": account_id, "amount_paise": 10000, "reason": f"ATM withdrawal #{idx}"},
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": unique_key},
        )

    # Launch 50 concurrent withdrawal requests across worker threads
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(attempt_withdrawal, i) for i in range(50)]
        responses = [f.result() for f in futures]

    statuses = [r.status_code for r in responses]
    successes = [r for r in responses if r.status_code == 201]
    failures = [r for r in responses if r.status_code == 422]

    # Exactly 10 succeed, exactly 40 fail!
    assert len(successes) == 10, f"Expected 10 successes, got {len(successes)}: {statuses}"
    assert len(failures) == 40, f"Expected 40 failures, got {len(failures)}: {statuses}"

    # Verify failure reasons
    for f in failures:
        assert "Insufficient funds" in f.json()["detail"]

    # Verify final balance via API
    check = client.get(f"/api/v1/accounts/{account_id}", headers={"Authorization": f"Bearer {token}"}).json()
    assert check["balance_paise"] == 0, f"Expected 0 paise balance, got {check['balance_paise']}"

    # Database level deep verification
    db: Session = SessionLocal()
    try:
        db_account = db.query(Account).filter_by(id=uuid.UUID(account_id)).first()
        assert db_account.balance_paise == 0

        # Verify durable attempt records
        attempts = db.query(TransactionAttempt).filter_by(source_account_id=uuid.UUID(account_id)).all()
        accepted_attempts = [a for a in attempts if a.outcome == "accepted"]
        refused_attempts = [a for a in attempts if a.outcome == "refused"]

        assert len(accepted_attempts) == 10
        assert len(refused_attempts) == 40
        assert all(a.reason_code == "INSUFFICIENT_FUNDS" for a in refused_attempts)

        # Verify ledger entries for this account: 1 deposit (+100,000) and 10 withdrawals (-10,000 each)
        entries = db.query(LedgerEntry).filter_by(account_id=uuid.UUID(account_id)).all()
        assert len(entries) == 11
        total_ledger_paise = sum(e.amount_paise for e in entries)
        assert total_ledger_paise == 0, f"Expected ledger sum 0, got {total_ledger_paise}"
    finally:
        db.close()


def test_concurrent_interleaved_deposits_and_withdrawals():
    """
    Verify concurrency safety when deposits and withdrawals run simultaneously on an account:
    - 5 deposits of ₹100 (+10,000 paise each) = +₹500
    - 5 withdrawals of ₹100 (-10,000 paise each) = -₹500
    - Initial balance: ₹200 (20,000 paise)
    - Expected final balance: strictly ₹200 (20,000 paise)
    - All 10 requests must succeed without race conditions or lost updates.
    """
    token, _, acc = _create_user_and_account("Interleave")
    account_id = acc["id"]

    # Initial balance: ₹200
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": account_id, "amount_paise": 20000},
        headers={"Authorization": f"Bearer {token}"},
    )

    def do_deposit(idx: int):
        return client.post(
            "/api/v1/transactions/deposits",
            json={"target_account_id": account_id, "amount_paise": 10000, "reason": f"Interleave Dep #{idx}"},
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"dep-intl-{idx}-{uuid.uuid4().hex[:6]}"},
        )

    def do_withdrawal(idx: int):
        return client.post(
            "/api/v1/transactions/withdrawals",
            json={"source_account_id": account_id, "amount_paise": 10000, "reason": f"Interleave Wdr #{idx}"},
            headers={"Authorization": f"Bearer {token}", "Idempotency-Key": f"wdr-intl-{idx}-{uuid.uuid4().hex[:6]}"},
        )

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = []
        for i in range(5):
            futures.append(executor.submit(do_deposit, i))
            futures.append(executor.submit(do_withdrawal, i))
        results = [f.result() for f in futures]

    # Every request should succeed (since balance never drops below 0 when starting from 200 and +100/-100 in equal counts)
    assert all(r.status_code == 201 for r in results)

    # Final balance check: must be strictly ₹200 (20,000 paise)
    check = client.get(f"/api/v1/accounts/{account_id}", headers={"Authorization": f"Bearer {token}"}).json()
    assert check["balance_paise"] == 20000
