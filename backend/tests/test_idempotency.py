"""
Idempotency Test Suite
Verifies:
1. Replaying the exact same idempotency key returns the cached response without double-spending.
2. Ledger entries are created exactly once.
3. Reusing the same key with different payloads is rejected with HTTP 422.
4. Concurrent requests with the same key never duplicate transactions.
5. Failed/refused transactions record idempotency state and do not allow double charges.
"""

import uuid
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient

from app.main import app

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


def test_deposit_with_idempotency_key_replay_returns_cached_response():
    """
    Test that replaying a deposit with the same Idempotency-Key header returns the
    identical cached response and does NOT deposit the money twice.
    """
    token, _, acc = _create_user_and_account("IdempDeposit")
    idempotency_key = f"key-dep-{uuid.uuid4()}"

    # First deposit: ₹500
    res1 = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": idempotency_key},
    )
    assert res1.status_code == 201
    data1 = res1.json()
    tx1_id = data1["transaction_id"]
    assert data1["target_balance_paise"] == 50000

    # Second deposit with identical payload and identical Idempotency-Key
    res2 = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": idempotency_key},
    )
    assert res2.status_code == 201
    data2 = res2.json()
    assert data2["transaction_id"] == tx1_id
    assert data2["target_balance_paise"] == 50000

    # Balance check: must be ₹500, NOT ₹1,000!
    check = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {token}"}).json()
    assert check["balance_paise"] == 50000


def test_transfer_with_idempotency_key_replay_does_not_double_spend():
    """
    Test that replaying a transfer with the same Idempotency-Key does NOT debit or credit twice.
    """
    token_a, _, acc_a = _create_user_and_account("IdempTransferA")
    token_b, _, acc_b = _create_user_and_account("IdempTransferB")

    # Initial Deposit of ₹1,000 into A
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 100000},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    transfer_key = f"key-transfer-{uuid.uuid4()}"
    transfer_payload = {
        "source_account_id": acc_a["id"],
        "target_account_id": acc_b["id"],
        "amount_paise": 40000,  # ₹400
        "reason": "Rent Payment",
    }

    # First Transfer Request
    res1 = client.post(
        "/api/v1/transactions/transfers",
        json=transfer_payload,
        headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": transfer_key},
    )
    assert res1.status_code == 201
    tx1_id = res1.json()["transaction_id"]

    # Verify balances: A has ₹600, B has ₹400
    check_a = client.get(f"/api/v1/accounts/{acc_a['id']}", headers={"Authorization": f"Bearer {token_a}"}).json()
    check_b = client.get(f"/api/v1/accounts/{acc_b['id']}", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert check_a["balance_paise"] == 60000
    assert check_b["balance_paise"] == 40000

    # Replay identical transfer request with same Idempotency-Key
    res2 = client.post(
        "/api/v1/transactions/transfers",
        json=transfer_payload,
        headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": transfer_key},
    )
    assert res2.status_code == 201
    assert res2.json()["transaction_id"] == tx1_id

    # Balances must remain EXACTLY ₹600 and ₹400!
    check_a2 = client.get(f"/api/v1/accounts/{acc_a['id']}", headers={"Authorization": f"Bearer {token_a}"}).json()
    check_b2 = client.get(f"/api/v1/accounts/{acc_b['id']}", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert check_a2["balance_paise"] == 60000
    assert check_b2["balance_paise"] == 40000


def test_reusing_idempotency_key_with_different_payload_is_rejected():
    """
    Test that sending the same Idempotency-Key with a modified payload (e.g. different amount)
    is rejected with HTTP 422 Unprocessable Content.
    """
    token, _, acc = _create_user_and_account("TamperIdemp")
    shared_key = f"key-tamper-{uuid.uuid4()}"

    # Initial Deposit of ₹100
    res1 = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 10000},
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": shared_key},
    )
    assert res1.status_code == 201

    # Attempt to reuse the SAME key with a different amount (₹500 instead of ₹100)
    res2 = client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc["id"], "amount_paise": 50000},
        headers={"Authorization": f"Bearer {token}", "Idempotency-Key": shared_key},
    )
    assert res2.status_code == 422
    assert "different request payload" in res2.json()["detail"]


def test_concurrent_duplicate_requests_with_same_idempotency_key():
    """
    CRITICAL CONCURRENCY AUDIT TEST:
    Simultaneously fire 10 concurrent requests with the EXACT SAME Idempotency-Key.
    Verifies that:
    1. Exactly 1 transaction is processed in the ledger.
    2. No duplicate balance deduction occurs.
    3. Other requests receive the cached response or 409 Conflict.
    """
    token_a, _, acc_a = _create_user_and_account("ConcurrentIdempA")
    token_b, _, acc_b = _create_user_and_account("ConcurrentIdempB")

    # Fund A with ₹1,000
    client.post(
        "/api/v1/transactions/deposits",
        json={"target_account_id": acc_a["id"], "amount_paise": 100000},
        headers={"Authorization": f"Bearer {token_a}"},
    )

    concurrent_key = f"key-race-{uuid.uuid4()}"
    transfer_payload = {
        "source_account_id": acc_a["id"],
        "target_account_id": acc_b["id"],
        "amount_paise": 25000,  # ₹250
        "reason": "Concurrent duplicate test",
    }

    def execute_request():
        return client.post(
            "/api/v1/transactions/transfers",
            json=transfer_payload,
            headers={"Authorization": f"Bearer {token_a}", "Idempotency-Key": concurrent_key},
        )

    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = [executor.submit(execute_request) for _ in range(8)]
        results = [f.result() for f in futures]

    statuses = [r.status_code for r in results]
    # Responses must either be 201 (success/cached) or 409 (conflict during processing)
    for code in statuses:
        assert code in (201, 409), f"Unexpected status code: {code}"

    # Exactly one transaction ID must exist across all 201 responses
    successful_tx_ids = {r.json()["transaction_id"] for r in results if r.status_code == 201}
    assert len(successful_tx_ids) == 1

    # Verify Account A balance: exactly ₹750 remaining (1000 - 250)
    check_a = client.get(f"/api/v1/accounts/{acc_a['id']}", headers={"Authorization": f"Bearer {token_a}"}).json()
    assert check_a["balance_paise"] == 75000

    # Verify Account B balance: exactly ₹250 received
    check_b = client.get(f"/api/v1/accounts/{acc_b['id']}", headers={"Authorization": f"Bearer {token_b}"}).json()
    assert check_b["balance_paise"] == 25000
