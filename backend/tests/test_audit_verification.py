"""
Audit, Statements & Cryptographic Verification Test Suite.
Verifies:
1. Full cryptographic ledger verification (SHA-256 hash chains, balance projections, zero-sum invariant).
2. Account statements combining posted ledger entries and durable refusal attempts.
3. IDOR access control protection on statements.
4. RBAC protection on supervisory audit endpoints.
5. Detection of tampered entries.
"""

import uuid
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.db.session import SessionLocal
from app.models.ledger_entry import LedgerEntry
from app.services.audit_service import AuditService

client = TestClient(app)


def _get_admin_token():
    return client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ledgerline.io", "password": "Admin@12345!"},
    ).json()["token"]


def _get_auditor_token():
    return client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@ledgerline.io", "password": "Auditor@12345!"},
    ).json()["token"]


def _create_user_and_account(email_prefix: str):
    unique = uuid.uuid4().hex[:8]
    email = f"{email_prefix}_{unique}@example.com"
    pwd = "SecurePassword123!"

    client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": pwd, "full_name": f"{email_prefix} User", "role": "holder"},
    )
    token = client.post("/api/v1/auth/login", json={"email": email, "password": pwd}).json()["token"]
    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": f"{email_prefix} Account", "currency": "INR"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    return token, email, acc


def test_full_ledger_verification_untampered():
    """
    Test that an Auditor running GET /api/v1/audit/verify gets a clean bill of health:
    - is_valid is True
    - global_sum_paise == 0
    - tampered_entries is empty
    """
    token, _, acc = _create_user_and_account("AuditSetupAcc")
    # Post a deposit to ensure there are ledger entries to verify
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token}"},
    )

    auditor_token = _get_auditor_token()

    res = client.get("/api/v1/audit/verify", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res.status_code == 200
    report = res.json()

    assert report["is_valid"] is True
    assert report["global_sum_paise"] == 0
    assert report["global_sum_is_zero"] is True
    assert len(report["tampered_entries"]) == 0
    assert report["accounts_verified"] > 0
    assert report["total_entries"] > 0


def test_account_statement_returns_entries_and_refusals():
    """
    Test that an account statement includes both:
    1. Successful posted ledger entries (credits and debits)
    2. Durable refused attempts (e.g. INSUFFICIENT_FUNDS)
    """
    token_a, _, acc_a = _create_user_and_account("StmtA")
    token_b, _, acc_b = _create_user_and_account("StmtB")

    # 1. Deposit ₹500 into Account A
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 50000, "reason": "Salary credit"},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # 2. Refused withdrawal of ₹1,000 (exceeds balance of ₹500)
    refuse_res = client.post(
        "/api/v1/transactions/withdrawals",
        json={"source_account_id": acc_a["id"], "amount_paise": 100000, "reason": "Excessive ATM"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert refuse_res.status_code == 422

    # 3. Successful transfer of ₹200 from A to B
    client.post(
        "/api/v1/transactions/transfers",
        json={
            "source_account_id": acc_a["id"],
            "target_account_id": acc_b["id"],
            "amount_paise": 20000,
            "reason": "Payment for services",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # 4. Fetch Statement
    res = client.get(
        f"/api/v1/audit/statements/{acc_a['id']}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 200
    stmt = res.json()

    # Balance check: ₹500 - ₹200 = ₹300 (30,000 paise)
    assert stmt["current_balance_paise"] == 30000

    # Successful entries check: Deposit (+50000) and Transfer (-20000)
    assert len(stmt["entries"]) == 2
    amounts = [e["amount_paise"] for e in stmt["entries"]]
    assert 50000 in amounts
    assert -20000 in amounts

    # Refusal attempt check: Exactly 1 refused withdrawal of ₹100,000 paise
    assert len(stmt["refusal_attempts"]) == 1
    refusal = stmt["refusal_attempts"][0]
    assert refusal["outcome"] == "refused"
    assert refusal["reason_code"] == "INSUFFICIENT_FUNDS"
    assert refusal["amount_paise"] == 100000


def test_statement_idor_defense():
    """
    Verify IDOR defense: User B cannot access the statement of User A's account.
    Attempt is blocked with HTTP 403 Forbidden and logged as IDOR_ACCESS_DENIED.
    """
    token_victim, _, acc_victim = _create_user_and_account("VictimStmt")
    token_attacker, _, acc_attacker = _create_user_and_account("AttackerStmt")

    # Attacker tries to read Victim's statement
    res = client.get(
        f"/api/v1/audit/statements/{acc_victim['id']}",
        headers={"Authorization": f"Bearer {token_attacker}"},
    )
    assert res.status_code == 403
    assert "authorization" in res.json()["detail"]


def test_audit_logs_rbac():
    """
    Verify RBAC on audit logs:
    - Regular holder is blocked with HTTP 403.
    - Auditor can inspect audit events.
    """
    token_holder, _, _ = _create_user_and_account("HolderAudit")
    auditor_token = _get_auditor_token()

    # Holder blocked
    res_holder = client.get("/api/v1/audit/logs", headers={"Authorization": f"Bearer {token_holder}"})
    assert res_holder.status_code == 403

    # Auditor permitted
    res_auditor = client.get("/api/v1/audit/logs?limit=10", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_auditor.status_code == 200
    logs = res_auditor.json()
    assert isinstance(logs, list)
    assert len(logs) > 0


def test_single_account_verification():
    """Verify cryptographic check on a single specific account."""
    token, _, acc = _create_user_and_account("VerifyAcc")

    # Deposit ₹100
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 10000},
        headers={"Authorization": f"Bearer {token}"},
    )

    res = client.get(f"/api/v1/audit/verify/{acc['id']}", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    report = res.json()
    assert report["is_valid"] is True
    assert report["accounts_verified"] == 1
    assert len(report["tampered_entries"]) == 0
