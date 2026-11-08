# LedgerLine Threat Model & Security Controls

This document tracks security threats, attack vectors, defensive architectures, automated tests proving the defense, and accepted risks.

---

### Threat 1: Direct Database Ledger Tampering
- **Category**: Data Integrity / Tamper Resistance
- **Threat Description**: An attacker or rogue process gaining SQL execution privileges attempts to retroactively alter past ledger entries (`ledger_entries`), manipulate transaction amounts, or delete records to hide fraudulent money movement.
- **Attack Vector**: Attacker runs `UPDATE ledger_entries SET amount_paise = 9999999 WHERE id = '...'` or `DELETE FROM ledger_entries WHERE id = '...'`.
- **Engineering Defense**: 
  1. PostgreSQL triggers `trg_protect_ledger_entries`, `trg_protect_ledger_transactions`, and `trg_protect_audit_logs` are installed directly at the database engine level via migration `e6acf3cc1d11`.
  2. The trigger functions (`prevent_ledger_entry_mutation()`, `prevent_ledger_transaction_mutation()`, `prevent_audit_log_mutation()`) intercept any `UPDATE` or `DELETE` statement before execution and immediately raise a PL/pgSQL exception (`RAISE EXCEPTION '... are immutable. UPDATE or DELETE operations are strictly forbidden.'`), terminating the query and rolling back the transaction.
- **Automated Verification Test**: `backend/tests/test_db_immutability.py`
  - `test_audit_logs_mutation_blocked_by_trigger` (PASSED)
  - `test_ledger_transactions_mutation_blocked_by_trigger` (PASSED)
  - `test_ledger_entries_mutation_blocked_by_trigger` (PASSED)
- **Remaining Accepted Risk**: A database superuser (`postgres` or Cloud admin) can theoretically drop the trigger. To counter this, periodic independent cryptographic SHA-256 hash chains across `ledger_entries` are verified and audited against independent audit checkpoints.

---

### Threat 2: Overdraft via Negative Balance Manipulation
- **Category**: Financial Integrity
- **Threat Description**: An account balance is manipulated to drop below zero (or below overdraft limit).
- **Attack Vector**: Rapid balance deductions or malicious API payloads causing balance to become negative.
- **Engineering Defense**:
  1. Database CheckConstraint `ck_accounts_overdraft`: `balance_paise >= -overdraft_limit_paise`.
  2. Database CheckConstraint `ck_accounts_overdraft_nonnegative`: `overdraft_limit_paise >= 0`.
  3. Database CheckConstraint `ck_ledger_entries_nonzero_amount`: `amount_paise <> 0`.
- **Automated Verification Test**: Enforced at PostgreSQL engine level via migration `e6acf3cc1d11` and tested in financial transaction test suites.
- **Remaining Accepted Risk**: None at the database layer; invalid updates are rejected by the PostgreSQL kernel.

---

### Threat 3: Credential Theft & Rainbow Table / GPU Cracking
- **Category**: Authentication Security
- **Threat Description**: Attackers obtain the database user dump or intercept authentication requests to reverse passwords using precomputed rainbow tables or GPU cracking rigs.
- **Attack Vector**: Offline dictionary or brute-force attack against database password hashes.
- **Engineering Defense**:
  1. Argon2id (RFC 9106 recommended winner of Password Hashing Competition) with memory-hardness (`memory_cost=65536` / 64MB, `time_cost=3`, `parallelism=4`).
  2. Argon2id resists GPU/ASIC parallelization attacks and side-channel timing attacks.
  3. API response schemas strictly omit password and password hashes.
- **Automated Verification Test**: `backend/tests/test_auth.py`
  - `test_user_registration_success` (verifies passwords never leak in responses)
  - `test_user_login_invalid_password_fails` (verifies strict verification)
- **Remaining Accepted Risk**: Compromise of user client endpoint. Mitigated by strong client-side password policies and rate limiting.

---

### Threat 4: Session Hijacking & Database Compromise Token Reconstruction
- **Category**: Session Security
- **Threat Description**: An attacker inspects the `user_sessions` database table to steal user tokens and impersonate administrators or holders.
- **Attack Vector**: Using database read access to impersonate active user sessions.
- **Engineering Defense**:
  1. The client receives a 256-bit URL-safe cryptographically secure random token (`secrets.token_urlsafe(32)`).
  2. The server only stores the SHA-256 one-way hash of the token (`token_hash`) in the database.
  3. Even with a full database dump, the attacker cannot reverse the hash to acquire the bearer token.
  4. Instant session revocation: `/api/v1/auth/logout` sets `revoked_at = NOW()`, immediately invalidating the session.
- **Automated Verification Test**: `backend/tests/test_auth.py`
  - `test_user_logout_revokes_session` (PASSED)
  - `test_user_me_unauthenticated_fails` (PASSED)
- **Remaining Accepted Risk**: Man-in-the-middle on unencrypted networks; mitigated by enforcing HTTPS/TLS in production.

---

### Threat 5: Privilege Escalation via Unauthorized Role Access
- **Category**: Authorization / RBAC
- **Threat Description**: A regular account holder or unauthenticated user attempts to access administrative functions (e.g. freezing accounts, altering limits) or auditor-only inspection logs.
- **Attack Vector**: Calling admin/auditor endpoints directly with a holder session token.
- **Engineering Defense**:
  1. Server-side dependency injection with `require_roles('admin')` and `require_roles('auditor')`.
  2. Roles are verified dynamically against active database user state on every request, independent of client claims.
  3. Unauthorized attempts return HTTP 403 Forbidden with security refusal details.
- **Automated Verification Test**: `backend/tests/test_auth.py`
  - `test_rbac_admin_and_holder_permissions` (PASSED: Holder and Auditor cannot access Admin-only endpoints).
- **Remaining Accepted Risk**: Insider threats with legitimate admin credentials; audited via append-only `audit_logs`.

---

### Threat 6: Insecure Direct Object Reference (IDOR) on Financial Accounts
- **Category**: Access Control / IDOR
- **Threat Description**: An authenticated user attempts to access, inspect, or modify another customer's financial account by manipulating UUID parameters in API requests.
- **Attack Vector**: Attacker calls `GET /api/v1/accounts/{target_account_id}` with their own valid session token.
- **Engineering Defense**:
  1. The service layer verifies the caller's membership in `account_members` for the specific account.
  2. Listing accounts via `GET /api/v1/accounts` automatically filters by `account_members.user_id == current_user.id` for regular holders.
  3. Unauthorized access attempts trigger an immediate `IDOR_ACCESS_DENIED` entry in `audit_logs` and return HTTP 403 Forbidden.
- **Automated Verification Test**: `backend/tests/test_accounts.py`
  - `test_list_accounts_idor_isolation` (PASSED: User A cannot see User B's accounts in listings)
  - `test_direct_object_reference_forbidden_idor` (PASSED: User B direct GET on User A's UUID returns 403 Forbidden)
- **Remaining Accepted Risk**: Legitimate shared account access; controlled by granular permissions (`can_view`, `can_transfer`).

---

### Threat 7: Unauthorized Overdraft Granting & Self-Credit Escalation
- **Category**: Financial Integrity / Fraud Prevention
- **Threat Description**: A rogue holder attempts to grant themselves an overdraft limit during account creation to allow negative balances and siphon funds.
- **Attack Vector**: Attacker submits `POST /api/v1/accounts` with `overdraft_limit_paise > 0`.
- **Engineering Defense**:
  1. Server-side validation strictly prohibits non-administrators from assigning an `overdraft_limit_paise > 0`, returning HTTP 403 Forbidden.
  2. Only users with role `admin` can set overdraft limits on customer accounts.
- **Automated Verification Test**: `backend/tests/test_accounts.py`
  - `test_non_admin_cannot_grant_overdraft` (PASSED)
  - `test_admin_can_create_account_with_overdraft` (PASSED)
- **Remaining Accepted Risk**: Malicious administrator granting unauthorized limits; mitigated by mandatory audit logging on account creation.

---

### Threat 8: Unauthorized Multi-User Account Member Escalation
- **Category**: Access Control
- **Threat Description**: A secondary account viewer or operator on a shared business account attempts to add additional members or escalate their own privileges to owner.
- **Attack Vector**: Calling `POST /api/v1/accounts/{id}/members` without being the account Owner.
- **Engineering Defense**:
  1. The service layer verifies that the caller has `member_role == 'owner'` (or is system `admin`) before modifying membership.
  2. Non-owners receive HTTP 403 Forbidden.
- **Automated Verification Test**: `backend/tests/test_accounts.py`
  - `test_non_owner_cannot_add_members` (PASSED)
  - `test_add_account_member_and_delegated_access` (PASSED)
- **Remaining Accepted Risk**: An account owner intentionally inviting an untrusted party; mitigated by owner accountability.
