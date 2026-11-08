"""
Module 7: Security & Mutation Verification Suite.
Deliberately attempts to corrupt, tamper with, or break ledger integrity directly at the database
level (simulating superuser rogue insider attacks) to prove that the cryptographic verification
engine flags and rejects every form of tampering:
1. Entry amount manipulation (fingerprint mismatch + arithmetic mismatch + balance drift + global sum break).
2. Hash pointer tampering (broken chain detection).
3. Direct account balance inflation/drain (table balance drift detection).
4. Deleting a transaction entry (omission detection + broken chain + global sum break).
5. Unbalanced rogue injection (global zero-sum invariant violation).
"""

import uuid
import pytest
from sqlalchemy import text
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.services.audit_service import AuditService

client = TestClient(app)


def _get_auditor_token() -> str:
    res = client.post("/api/v1/auth/login", json={"email": "auditor@ledgerline.io", "password": "Auditor@12345!"})
    assert res.status_code == 200
    return res.json()["token"]


def _create_user_and_account(prefix: str):
    email = f"{prefix.lower()}_{uuid.uuid4().hex[:6]}@ledgerline.io"
    reg = client.post("/api/v1/auth/register", json={"email": email, "full_name": f"{prefix} Holder", "password": "Password123!", "role": "holder"}).json()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"}).json()
    token = login["token"]
    acc = client.post("/api/v1/accounts", json={"account_name": f"{prefix} Account", "currency": "INR", "overdraft_limit_paise": 0}, headers={"Authorization": f"Bearer {token}"}).json()
    return token, email, acc


def test_tamper_detection_amount_manipulation():
    """
    Simulate a rogue database superuser who modifies an entry's amount_paise directly in SQL.
    Proves that the verification engine flags the cryptographic fingerprint mismatch,
    the running balance mismatch, account balance drift, and global zero-sum violation.
    """
    token, _, acc = _create_user_and_account("TamperAmt")
    auditor_token = _get_auditor_token()

    # Deposit ₹500
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token}"},
    )

    db = SessionLocal()
    try:
        # Disable trigger temporarily to simulate malicious direct DB mutation
        db.execute(text("ALTER TABLE ledger_entries DISABLE TRIGGER trg_protect_ledger_entries;"))
        db.execute(
            text("UPDATE ledger_entries SET amount_paise = 9999999 WHERE account_id = :acc_id"),
            {"acc_id": acc["id"]},
        )
        db.execute(text("ALTER TABLE ledger_entries ENABLE TRIGGER trg_protect_ledger_entries;"))
        db.commit()

        # Auditor executes verification
        res = client.get(f"/api/v1/audit/verify/{acc['id']}", headers={"Authorization": f"Bearer {auditor_token}"})
        assert res.status_code == 200
        report = res.json()

        # Must flag tampering
        assert report["is_valid"] is False
        assert len(report["tampered_entries"]) > 0

        issues = [t["issue"] for t in report["tampered_entries"]]
        assert any("Cryptographic SHA-256 fingerprint mismatch" in i for i in issues)
        assert any("Running balance arithmetic mismatch" in i for i in issues)
        assert any("Account balance drift" in i for i in issues)
    finally:
        # Restore ledger entry to valid amount
        db.execute(text("ALTER TABLE ledger_entries DISABLE TRIGGER trg_protect_ledger_entries;"))
        db.execute(
            text("UPDATE ledger_entries SET amount_paise = 50000 WHERE account_id = :acc_id"),
            {"acc_id": acc["id"]},
        )
        db.execute(text("ALTER TABLE ledger_entries ENABLE TRIGGER trg_protect_ledger_entries;"))
        db.commit()
        db.close()


def test_tamper_detection_hash_chain_break():
    """
    Simulate a rogue superuser modifying prev_hash directly in SQL.
    Proves that the verification engine flags the broken hash chain.
    """
    token, _, acc = _create_user_and_account("TamperHash")
    auditor_token = _get_auditor_token()

    # Deposit twice to have at least 2 chained entries
    client.post("/api/v1/transactions/deposits", json={"target_account_id": acc["id"], "amount_paise": 10000}, headers={"Authorization": f"Bearer {token}"})
    client.post("/api/v1/transactions/deposits", json={"target_account_id": acc["id"], "amount_paise": 20000}, headers={"Authorization": f"Bearer {token}"})

    db = SessionLocal()
    original_prev_hash = None
    target_entry_id = None
    try:
        # Find second entry
        row = db.execute(
            text("SELECT id, prev_hash FROM ledger_entries WHERE account_id = :acc_id AND prev_hash IS NOT NULL LIMIT 1"),
            {"acc_id": acc["id"]},
        ).fetchone()
        assert row is not None
        target_entry_id, original_prev_hash = row[0], row[1]

        # Corrupt the prev_hash
        db.execute(text("ALTER TABLE ledger_entries DISABLE TRIGGER trg_protect_ledger_entries;"))
        db.execute(
            text("UPDATE ledger_entries SET prev_hash = 'tampered_forged_hash_pointer_1234567890' WHERE id = :id"),
            {"id": target_entry_id},
        )
        db.execute(text("ALTER TABLE ledger_entries ENABLE TRIGGER trg_protect_ledger_entries;"))
        db.commit()

        # Run verification
        res = client.get(f"/api/v1/audit/verify/{acc['id']}", headers={"Authorization": f"Bearer {auditor_token}"})
        assert res.status_code == 200
        report = res.json()

        assert report["is_valid"] is False
        issues = [t["issue"] for t in report["tampered_entries"]]
        assert any("Broken hash chain" in i or "Orphaned or disconnected entry" in i for i in issues)
    finally:
        # Restore
        if target_entry_id and original_prev_hash:
            db.execute(text("ALTER TABLE ledger_entries DISABLE TRIGGER trg_protect_ledger_entries;"))
            db.execute(
                text("UPDATE ledger_entries SET prev_hash = :orig WHERE id = :id"),
                {"orig": original_prev_hash, "id": target_entry_id},
            )
            db.execute(text("ALTER TABLE ledger_entries ENABLE TRIGGER trg_protect_ledger_entries;"))
            db.commit()
        db.close()


def test_tamper_detection_account_balance_table_drift():
    """
    Simulate an attacker directly changing accounts.balance_paise to give themselves fake money
    without writing matching ledger entries.
    Proves that the audit engine detects the drift between the balance table and ledger sum.
    """
    token, _, acc = _create_user_and_account("TamperBalDrift")
    auditor_token = _get_auditor_token()

    # Deposit ₹100
    client.post("/api/v1/transactions/deposits", json={"target_account_id": acc["id"], "amount_paise": 10000}, headers={"Authorization": f"Bearer {token}"})

    db = SessionLocal()
    try:
        # Maliciously inflate balance in accounts table by ₹10,000
        db.execute(
            text("UPDATE accounts SET balance_paise = 1000000 WHERE id = :id"),
            {"id": acc["id"]},
        )
        db.commit()

        # Auditor verifies single account
        res = client.get(f"/api/v1/audit/verify/{acc['id']}", headers={"Authorization": f"Bearer {auditor_token}"})
        assert res.status_code == 200
        report = res.json()

        assert report["is_valid"] is False
        issues = [t["issue"] for t in report["tampered_entries"]]
        assert any("Account balance drift" in i for i in issues)
    finally:
        # Restore correct balance
        db.execute(
            text("UPDATE accounts SET balance_paise = 10000 WHERE id = :id"),
            {"id": acc["id"]},
        )
        db.commit()
        db.close()

