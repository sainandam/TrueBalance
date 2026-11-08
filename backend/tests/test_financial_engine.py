"""
Automated test suite for Module 4: Financial Engine, Double-Entry Ledger,
Zero-Sum Conservation Invariant, Row-Level Locking, and Deadlock Prevention.
"""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _create_user_and_account(initial_name="Trading Vault"):
    email = f"user_{uuid4().hex[:8]}@example.com"
    pwd = "StrongPassword!123"
    client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": "Trader", "password": pwd, "role": "holder"},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": pwd}).json()
    token = login["token"]
    user = login["user"]

    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": initial_name, "currency": "INR"},
        headers={"Authorization": f"Bearer {token}"},
    ).json()

    return token, user, acc


def _get_admin_token():
    return client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ledgerline.io", "password": "Admin@12345!"},
    ).json()["token"]


def test_deposit_success_and_zero_sum_invariant():
    """
    Verify deposit from external world (SYS-WORLD-001) into customer account:
    - Target balance increases by exact amount.
    - Zero-Sum invariant: Sum of ledger entries strictly equals 0.
    - SHA-256 hashes generated for all ledger entries.
    """
    token, _, acc = _create_user_and_account("Deposit Test Account")
    amount = 100000  # ₹1,000.00 in paise

    res = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": amount, "reason": "Initial Capital"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["target_balance_paise"] == amount
    assert data["transaction_type"] == "deposit"
    assert len(data["entries"]) == 2

    # Verify Zero-Sum Conservation Invariant
    entry_sum = sum(e["amount_paise"] for e in data["entries"])
    assert entry_sum == 0

    # Verify entry amounts: System World is debited (-100000), Customer credited (+100000)
    amounts = sorted([e["amount_paise"] for e in data["entries"]])
    assert amounts == [-100000, 100000]

    # Verify SHA-256 hashes
    for e in data["entries"]:
        assert len(e["entry_hash"]) == 64


def test_withdrawal_success_and_hash_chain():
    """
    Verify withdrawal from customer account:
    - Balance decreases by exact amount.
    - Zero-Sum invariant holds.
    - Cryptographic prev_hash chains directly to the previous entry hash for the account.
    """
    token, _, acc = _create_user_and_account("Withdrawal Test Account")

    # Deposit ₹1,000
    dep_res = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 100000},
        headers={"Authorization": f"Bearer {token}"},
    ).json()
    prev_entry_hash = next(e["entry_hash"] for e in dep_res["entries"] if e["account_id"] == acc["id"])

    # Withdraw ₹400 (40,000 paise)
    with_res = client.post(
        "/api/v1/transactions/withdrawals",
        json={"source_account_id": acc["id"], "amount_paise": 40000, "reason": "ATM Cash Withdrawal"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert with_res.status_code == 201
    with_data = with_res.json()
    assert with_data["source_balance_paise"] == 60000  # ₹600.00 remaining

    # Zero-sum check
    assert sum(e["amount_paise"] for e in with_data["entries"]) == 0

    # Hash-chain linkage check: The customer entry's prev_hash must match the deposit entry's entry_hash
    customer_withdrawal_entry = next(e for e in with_data["entries"] if e["account_id"] == acc["id"])
    assert customer_withdrawal_entry["prev_hash"] == prev_entry_hash


def test_transfer_success_and_money_conservation():
    """
    Verify atomic internal transfer between two accounts:
    - Source decreases, target increases.
    - Total combined money across accounts is strictly conserved.
    - Zero-sum invariant: Net movement = 0.
    """
    token_a, _, acc_a = _create_user_and_account("Sender Account A")
    token_b, _, acc_b = _create_user_and_account("Receiver Account B")

    # Fund Account A with ₹500
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # Transfer ₹200 from A to B
    res = client.post(
        "/api/v1/transactions/transfers",
        json={
            "source_account_id": acc_a["id"],
            "target_account_id": acc_b["id"],
            "amount_paise": 20000,
            "reason": "Payment for services",
        },
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["source_balance_paise"] == 30000  # ₹300 remaining
    assert data["target_balance_paise"] == 20000  # ₹200 received

    # Zero-sum invariant
    assert sum(e["amount_paise"] for e in data["entries"]) == 0

    # Verify balances via GET /accounts/{id}
    check_a = client.get(f"/api/v1/accounts/{acc_a['id']}", headers={"Authorization": f"Bearer {token_a}"}).json()
    check_b = client.get(f"/api/v1/accounts/{acc_b['id']}", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert check_a["balance_paise"] == 30000
    assert check_b["balance_paise"] == 20000
    assert check_a["balance_paise"] + check_b["balance_paise"] == 50000  # Conserved!


def test_withdrawal_insufficient_funds_refused():
    """
    Verify that withdrawal exceeding available balance is rejected with HTTP 422
    and balances remain unaltered.
    """
    token, _, acc = _create_user_and_account("Poor Account")

    # Balance is 0; attempt to withdraw ₹100
    res = client.post(
        "/api/v1/transactions/withdrawals",
        json={"source_account_id": acc["id"], "amount_paise": 10000},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 422
    assert "Insufficient funds" in res.json()["detail"]

    # Balance remains 0
    check = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert check["balance_paise"] == 0


def test_self_transfer_rejected():
    """Verify transferring to the same account is rejected with HTTP 400 Bad Request."""
    token, _, acc = _create_user_and_account("Loop Account")
    res = client.post(
        "/api/v1/transactions/transfers",
        json={"source_account_id": acc["id"], "target_account_id": acc["id"], "amount_paise": 5000},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400
    assert "distinct" in res.json()["detail"]


def test_frozen_account_transfer_rejected():
    """Verify transfer involving a frozen account is rejected with HTTP 422."""
    admin_token = _get_admin_token()
    token_a, _, acc_a = _create_user_and_account("Active A")
    token_b, _, acc_b = _create_user_and_account("To-Be-Frozen B")

    # Fund A with ₹500
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    # Freeze Account B
    client.patch(
        f"/api/v1/accounts/{acc_b['id']}/status",
        json={"status": "frozen", "reason": "Investigation"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )

    # Attempt transfer from A to frozen B -> rejected
    res = client.post(
        "/api/v1/transactions/transfers",
        json={"source_account_id": acc_a["id"], "target_account_id": acc_b["id"], "amount_paise": 10000},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert res.status_code == 422
    assert "not active" in res.json()["detail"]


def test_unauthorized_user_cannot_transfer():
    """Verify an attacker cannot transfer from an account where they lack transfer permissions."""
    token_victim, _, acc_victim = _create_user_and_account("Victim Account")
    token_attacker, _, acc_attacker = _create_user_and_account("Attacker Account")

    # Fund victim with ₹1,000
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_victim["id"], "amount_paise": 100000},
        headers={"Authorization": f"Bearer {token_victim}"},
    )

    # Attacker tries to transfer victim's money to attacker account
    res = client.post(
        "/api/v1/transactions/transfers",
        json={
            "source_account_id": acc_victim["id"],
            "target_account_id": acc_attacker["id"],
            "amount_paise": 50000,
        },
        headers={"Authorization": f"Bearer {token_attacker}"},
    )
    assert res.status_code == 403
    assert "authorization" in res.json()["detail"]

    # Victim balance remains intact
    victim_acc = client.get(
        f"/api/v1/accounts/{acc_victim['id']}", headers={"Authorization": f"Bearer {token_victim}"}
    ).json()
    assert victim_acc["balance_paise"] == 100000


def test_deterministic_lock_order_cross_transfers_no_deadlock():
    """
    CRITICAL CONCURRENCY AUDIT TEST:
    Simultaneously execute 10 cross-transfers (A -> B and B -> A) across parallel threads.
    Verifies that Deterministic Lexicographical Lock Ordering prevents database deadlocks!
    """
    token_a, _, acc_a = _create_user_and_account("Deadlock Test A")
    token_b, _, acc_b = _create_user_and_account("Deadlock Test B")

    # Fund both with ₹10,000
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 1000000},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_b["id"], "amount_paise": 1000000},
        headers={"Authorization": f"Bearer {token_b}"},
    )

    def transfer_a_to_b():
        return client.post(
            "/api/v1/transactions/transfers",
            json={"source_account_id": acc_a["id"], "target_account_id": acc_b["id"], "amount_paise": 1000},
            headers={"Authorization": f"Bearer {token_a}"},
        )

    def transfer_b_to_a():
        return client.post(
            "/api/v1/transactions/transfers",
            json={"source_account_id": acc_b["id"], "target_account_id": acc_a["id"], "amount_paise": 1000},
            headers={"Authorization": f"Bearer {token_b}"},
        )

    # Run 10 parallel cross-transfers
    tasks = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        for i in range(5):
            tasks.append(executor.submit(transfer_a_to_b))
            tasks.append(executor.submit(transfer_b_to_a))

    results = [t.result() for t in tasks]
    # Every single transfer must succeed with 201 without any deadlock exceptions
    status_codes = [r.status_code for r in results]
    assert all(code == 201 for code in status_codes), f"Some transfers failed: {status_codes}"

    # Final combined balance must equal the initial combined balance (₹20,000 = 2,000,000 paise)
    final_a = client.get(f"/api/v1/accounts/{acc_a['id']}", headers={"Authorization": f"Bearer {token_a}"}).json()
    final_b = client.get(f"/api/v1/accounts/{acc_b['id']}", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert final_a["balance_paise"] + final_b["balance_paise"] == 2000000

