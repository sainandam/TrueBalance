"""
Automated test suite for Module 3: Account Management, Multi-user Membership,
and Insecure Direct Object Reference (IDOR) Protection.
"""

from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _create_and_login_user(role="holder"):
    email = f"user_{uuid4().hex[:8]}@example.com"
    password = "StrongPassword!123"
    reg = client.post(
        "/api/v1/auth/register",
        json={"email": email, "full_name": f"Test {role.title()}", "password": password, "role": role},
    )
    assert reg.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["token"]
    user = login.json()["user"]
    return token, user


def _get_admin_token():
    login = client.post("/api/v1/auth/login", json={"email": "admin@ledgerline.io", "password": "Admin@12345!"})
    return login.json()["token"]


def _get_auditor_token():
    login = client.post("/api/v1/auth/login", json={"email": "auditor@ledgerline.io", "password": "Auditor@12345!"})
    return login.json()["token"]


def test_holder_create_account():
    """Verify an account holder can create an account and is automatically assigned Owner."""
    token, _ = _create_and_login_user("holder")
    payload = {"account_name": "Personal Checking", "currency": "INR", "overdraft_limit_paise": 0}
    res = client.post(
        "/api/v1/accounts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["account_name"] == "Personal Checking"
    assert data["currency"] == "INR"
    assert data["balance_paise"] == 0
    assert data["overdraft_limit_paise"] == 0
    assert data["status"] == "active"
    assert data["is_system"] is False
    assert data["current_user_role"] == "owner"
    assert data["account_number"].startswith("ACC-")


def test_non_admin_cannot_grant_overdraft():
    """Verify regular account holders are forbidden from granting themselves overdraft limits."""
    token, _ = _create_and_login_user("holder")
    payload = {"account_name": "Greedy Account", "currency": "INR", "overdraft_limit_paise": 5000000}
    res = client.post(
        "/api/v1/accounts",
        json=payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403
    assert "Only system administrators" in res.json()["detail"]


def test_admin_can_create_account_with_overdraft():
    """Verify administrators can assign non-zero overdraft limits."""
    admin_token = _get_admin_token()
    payload = {"account_name": "Corporate Credit Account", "currency": "INR", "overdraft_limit_paise": 20000000}
    res = client.post(
        "/api/v1/accounts",
        json=payload,
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res.status_code == 201
    data = res.json()
    assert data["overdraft_limit_paise"] == 20000000


def test_list_accounts_idor_isolation():
    """
    Verify IDOR isolation between users:
    - User A only sees User A's accounts
    - User B only sees User B's accounts
    """
    token_a, _ = _create_and_login_user("holder")
    token_b, _ = _create_and_login_user("holder")

    # A creates account
    res_a = client.post(
        "/api/v1/accounts",
        json={"account_name": "User A Vault", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    acc_a_id = res_a.json()["id"]

    # B creates account
    res_b = client.post(
        "/api/v1/accounts",
        json={"account_name": "User B Vault", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    acc_b_id = res_b.json()["id"]

    # A lists accounts -> sees A, not B
    list_a = client.get("/api/v1/accounts", headers={"Authorization": f"Bearer {token_a}"}).json()
    ids_seen_by_a = [acc["id"] for acc in list_a]
    assert acc_a_id in ids_seen_by_a
    assert acc_b_id not in ids_seen_by_a

    # B lists accounts -> sees B, not A
    list_b = client.get("/api/v1/accounts", headers={"Authorization": f"Bearer {token_b}"}).json()
    ids_seen_by_b = [acc["id"] for acc in list_b]
    assert acc_b_id in ids_seen_by_b
    assert acc_a_id not in ids_seen_by_b


def test_direct_object_reference_forbidden_idor():
    """
    Verify Insecure Direct Object Reference (IDOR) defense:
    Attempting to directly fetch another user's account by UUID returns 403 Forbidden.
    """
    token_a, _ = _create_and_login_user("holder")
    token_b, _ = _create_and_login_user("holder")

    # User A creates account
    acc_a = client.post(
        "/api/v1/accounts",
        json={"account_name": "Secret Trust A", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_a}"},
    ).json()

    # User B attempts to directly read User A's account via UUID
    idor_res = client.get(
        f"/api/v1/accounts/{acc_a['id']}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert idor_res.status_code == 403
    assert "Access denied" in idor_res.json()["detail"]


def test_admin_and_auditor_can_inspect_any_account():
    """Verify regulatory roles (Admin and Auditor) have supervisory visibility across accounts."""
    token_holder, _ = _create_and_login_user("holder")
    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": "Inspected Account", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_holder}"},
    ).json()

    admin_token = _get_admin_token()
    auditor_token = _get_auditor_token()

    # Admin read -> 200 OK
    res_admin = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_admin.status_code == 200
    assert res_admin.json()["account_name"] == "Inspected Account"

    # Auditor read -> 200 OK
    res_auditor = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_auditor.status_code == 200
    assert res_auditor.json()["account_name"] == "Inspected Account"


def test_add_account_member_and_delegated_access():
    """
    Verify multi-user account permissions:
    Owner invites a collaborator as 'operator' with view & transfer permissions.
    """
    token_owner, _ = _create_and_login_user("holder")
    token_delegate, delegate_user = _create_and_login_user("holder")

    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": "Shared Business Ops", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_owner}"},
    ).json()

    # Before delegation: delegate has no access (403)
    res_before = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {token_delegate}"})
    assert res_before.status_code == 403

    # Owner adds delegate as operator
    member_payload = {
        "user_email": delegate_user["email"],
        "member_role": "operator",
        "can_view": True,
        "can_deposit": True,
        "can_withdraw": False,
        "can_transfer": True,
    }
    add_res = client.post(
        f"/api/v1/accounts/{acc['id']}/members",
        json=member_payload,
        headers={"Authorization": f"Bearer {token_owner}"},
    )
    assert add_res.status_code == 201
    assert add_res.json()["member_role"] == "operator"
    assert add_res.json()["can_transfer"] is True

    # After delegation: delegate can now access the account
    res_after = client.get(f"/api/v1/accounts/{acc['id']}", headers={"Authorization": f"Bearer {token_delegate}"})
    assert res_after.status_code == 200
    assert res_after.json()["current_user_role"] == "operator"


def test_non_owner_cannot_add_members():
    """Verify non-owners (e.g. operators or external users) cannot add new members."""
    token_owner, _ = _create_and_login_user("holder")
    token_operator, operator_user = _create_and_login_user("holder")
    _, third_user = _create_and_login_user("holder")

    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": "Firm Ops", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_owner}"},
    ).json()

    # Owner adds operator
    client.post(
        f"/api/v1/accounts/{acc['id']}/members",
        json={"user_email": operator_user["email"], "member_role": "operator", "can_view": True},
        headers={"Authorization": f"Bearer {token_owner}"},
    )

    # Operator attempts to add third user -> forbidden (403)
    attempt = client.post(
        f"/api/v1/accounts/{acc['id']}/members",
        json={"user_email": third_user["email"], "member_role": "viewer", "can_view": True},
        headers={"Authorization": f"Bearer {token_operator}"},
    )
    assert attempt.status_code == 403
    assert "Only the account owner" in attempt.json()["detail"]


def test_admin_freeze_and_unfreeze_account():
    """Verify Admin can freeze an account, and regular holders cannot modify status."""
    token_holder, _ = _create_and_login_user("holder")
    admin_token = _get_admin_token()

    acc = client.post(
        "/api/v1/accounts",
        json={"account_name": "Freeze Target Account", "currency": "INR"},
        headers={"Authorization": f"Bearer {token_holder}"},
    ).json()

    # Regular holder attempts status update -> 403 Forbidden
    res_holder = client.patch(
        f"/api/v1/accounts/{acc['id']}/status",
        json={"status": "frozen", "reason": "Self freeze attempt"},
        headers={"Authorization": f"Bearer {token_holder}"},
    )
    assert res_holder.status_code == 403

    # Admin freezes account -> 200 OK
    res_freeze = client.patch(
        f"/api/v1/accounts/{acc['id']}/status",
        json={"status": "frozen", "reason": "AML Review Hold"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_freeze.status_code == 200
    assert res_freeze.json()["status"] == "frozen"

    # Admin unfreezes account -> 200 OK
    res_unfreeze = client.patch(
        f"/api/v1/accounts/{acc['id']}/status",
        json={"status": "active", "reason": "AML Review Cleared"},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_unfreeze.status_code == 200
    assert res_unfreeze.json()["status"] == "active"
