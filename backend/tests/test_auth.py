"""
Automated test suite for Module 2: Authentication, Session Management, and Role-Based Access Control (RBAC).
"""

from uuid import uuid4
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_user_registration_success():
    """Verify that a new user can register and receive a sanitized profile without password exposure."""
    unique_email = f"user_{uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "full_name": "Test Trader",
        "password": "StrongPassword!123",
        "role": "holder",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == unique_email
    assert data["full_name"] == "Test Trader"
    assert data["role"] == "holder"
    assert data["status"] == "active"
    assert "password" not in data
    assert "password_hash" not in data


def test_user_registration_duplicate_email_fails():
    """Verify that registering with an already existing email is rejected with 409 Conflict."""
    unique_email = f"dup_{uuid4().hex[:8]}@example.com"
    payload = {
        "email": unique_email,
        "full_name": "First User",
        "password": "StrongPassword!123",
        "role": "holder",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_user_login_success():
    """Verify login with valid credentials yields a Bearer session token and correct user profile."""
    # Using seeded holder account
    payload = {
        "email": "holder@ledgerline.io",
        "password": "Holder@12345!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "token" in data
    assert len(data["token"]) > 30  # High entropy token
    assert data["token_type"] == "Bearer"
    assert data["user"]["email"] == "holder@ledgerline.io"
    assert data["user"]["role"] == "holder"


def test_user_login_invalid_password_fails():
    """Verify login with incorrect password returns 401 Unauthorized."""
    payload = {
        "email": "holder@ledgerline.io",
        "password": "WrongPassword999!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


def test_user_me_authenticated():
    """Verify /me endpoint returns user identity when supplied with a valid session token."""
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ledgerline.io", "password": "Admin@12345!"},
    )
    token = login_res.json()["token"]

    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "admin@ledgerline.io"
    assert data["role"] == "admin"


def test_user_me_unauthenticated_fails():
    """Verify /me endpoint rejects requests with missing or invalid tokens."""
    # Missing token
    res1 = client.get("/api/v1/auth/me")
    assert res1.status_code == 401

    # Fake token
    res2 = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer fake_token_that_does_not_exist"},
    )
    assert res2.status_code == 401


def test_user_logout_revokes_session():
    """Verify that logging out revokes the session token so subsequent requests fail."""
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@ledgerline.io", "password": "Auditor@12345!"},
    )
    token = login_res.json()["token"]

    # Access /me before logout -> 200 OK
    me_res1 = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res1.status_code == 200

    # Logout
    logout_res = client.post(
        "/api/v1/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_res.status_code == 200
    assert "revoked" in logout_res.json()["message"]

    # Access /me after logout -> 401 Unauthorized
    me_res2 = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res2.status_code == 401


def test_rbac_admin_and_holder_permissions():
    """
    Verify Role-Based Access Control:
    - Admin can access /admin-only
    - Holder CANNOT access /admin-only (403 Forbidden)
    - Auditor CANNOT access /admin-only (403 Forbidden)
    """
    admin_token = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@ledgerline.io", "password": "Admin@12345!"},
    ).json()["token"]

    holder_token = client.post(
        "/api/v1/auth/login",
        json={"email": "holder@ledgerline.io", "password": "Holder@12345!"},
    ).json()["token"]

    auditor_token = client.post(
        "/api/v1/auth/login",
        json={"email": "auditor@ledgerline.io", "password": "Auditor@12345!"},
    ).json()["token"]

    # Admin access -> 200 OK
    res_admin = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert res_admin.status_code == 200
    assert "Welcome Admin" in res_admin.json()["message"]

    # Holder access -> 403 Forbidden
    res_holder = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {holder_token}"},
    )
    assert res_holder.status_code == 403
    assert "not authorized" in res_holder.json()["detail"]

    # Auditor access -> 403 Forbidden
    res_auditor = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {auditor_token}"},
    )
    assert res_auditor.status_code == 403
    assert "not authorized" in res_auditor.json()["detail"]
