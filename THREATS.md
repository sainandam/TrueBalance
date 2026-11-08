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

---

### Threat 9: Deadlock in Bi-Directional Concurrent Transfers
- **Category**: Concurrency / Deadlock Vulnerability
- **Threat Description**: Two concurrent requests attempting transfers between the same two accounts in opposite directions (Request 1 transfers A -> B while Request 2 simultaneously transfers B -> A). In a naive implementation, Request 1 acquires lock on A and waits for lock on B, while Request 2 acquires lock on B and waits for lock on A, causing a classic circular wait deadlock (`DeadlockDetected`) and aborting transactions.
- **Attack / Failure Vector**: Rapid bi-directional customer transfers causing database lock contention, deadlocks, and transaction aborts.
- **Engineering Defense**:
  1. Deterministic Lexicographical Lock Ordering: `first_id, second_id = sorted([source_acc.id, target_acc.id])`.
  2. Both transactions acquire `SELECT ... FOR UPDATE` locks on the accounts in the exact same global lexicographical order regardless of transfer direction.
  3. Circular lock dependencies are mathematically impossible, completely eliminating deadlocks without relying on retries.
- **Automated Verification Test**: `backend/tests/test_financial_engine.py`
  - `test_deterministic_lock_order_cross_transfers_no_deadlock` (PASSED: 10 parallel cross-transfers across threads execute with 100% success and zero deadlocks).
- **Remaining Accepted Risk**: High-frequency lock contention on a single celebrity account. Mitigated by low-latency transaction scopes.

---

### Threat 10: Money Creation or Destruction During Multi-Leg Transfers
- **Category**: Financial Integrity / Double-Entry Invariant
- **Threat Description**: System failure, partial commit, or rogue business logic debits an account without an equal credit, applies floating-point rounding errors, or fails to balance transaction legs, violating the fundamental law of money conservation.
- **Attack / Failure Vector**: Exploiting fractional currency conversions, unbonded partial legs, or single-entry updates.
- **Engineering Defense**:
  1. Strict Zero-Sum Invariant ($\sum \text{amount\_paise} = 0$): `LedgerService.post_double_entry()` verifies that the sum of all posting amounts strictly equals 0 before persisting. Any unbalanced batch raises `UnbalancedLedgerError` and immediately aborts.
  2. Atomic PostgreSQL Transactions: Both debit and credit `ledger_entries` and balance updates commit in a single ACID transaction block.
  3. Strict Integer Paise: All values are stored strictly as 64-bit integer paise (`BigInteger`), eliminating all IEEE 754 floating-point inaccuracies.
  4. Cryptographic Hash Chain: Each ledger entry computes `SHA-256(prev_hash + entry_id + account_id + amount_paise + created_at)`, creating a tamper-evident audit chain.
- **Automated Verification Test**: `backend/tests/test_financial_engine.py`
  - `test_deposit_success_and_zero_sum_invariant` (PASSED: Zero-sum invariant verified on deposit)
  - `test_withdrawal_success_and_hash_chain` (PASSED: Hash chain linkage and zero-sum verified)
  - `test_transfer_success_and_money_conservation` (PASSED: Combined account balance strictly conserved)
- **Remaining Accepted Risk**: None at the ledger layer; invariant is enforced mathematically and atomically.

---

### Threat 11: Idempotency Key Replay Double-Spending Attack
- **Category**: Transaction Integrity / Idempotency
- **Threat Description**: A network retry, flaky mobile connection, or malicious actor re-submits the exact same transaction request (deposit, withdrawal, or transfer) multiple times to execute duplicate money movements or drain balances twice.
- **Attack Vector**: Calling `POST /api/v1/transactions/transfers` 10 times in rapid succession with identical payloads.
- **Engineering Defense**:
  1. Mandatory or optional `Idempotency-Key` header mapped in `idempotency_keys` table with a `UniqueConstraint("user_id", "key")`.
  2. First request transitions key status to `processing`.
  3. Once transaction completes, the key transitions to `succeeded`, storing the exact `response_body` JSON and `transaction_id`.
  4. Subsequent replays with the identical key detect `status == 'succeeded'` and immediately return the cached response without touching account balances or ledger entries.
  5. Concurrent in-flight duplicates with the same key detect `status == 'processing'` and are rejected with HTTP 409 Conflict.
- **Automated Verification Test**: `backend/tests/test_idempotency.py`
  - `test_deposit_with_idempotency_key_replay_returns_cached_response` (PASSED: balance credited once)
  - `test_transfer_with_idempotency_key_replay_does_not_double_spend` (PASSED: balance debited once)
  - `test_concurrent_duplicate_requests_with_same_idempotency_key` (PASSED: exactly 1 transaction executed out of 10 concurrent calls)
- **Remaining Accepted Risk**: Client forgetting to pass an `Idempotency-Key`. Mitigated by client SDK enforcing idempotency keys on mutating endpoints.

---

### Threat 12: Idempotency Key Payload Tampering / Parameter Substitution
- **Category**: Fraud Prevention / Parameter Tampering
- **Threat Description**: An attacker captures a valid `Idempotency-Key` from a small transaction (e.g. ₹10) and attempts to reuse it for a larger transfer (e.g. ₹10,000) or to a different destination account, hoping the server will misattribute or execute the new payload under the approved key.
- **Attack Vector**: Submitting `POST /api/v1/transactions/transfers` with a previously used key but modified `amount_paise` or `target_account_id`.
- **Engineering Defense**:
  1. `IdempotencyService.compute_request_hash()` computes a SHA-256 fingerprint over the canonical JSON representation of `(endpoint, sorted payload)`.
  2. The canonical hash is stored in `idempotency_keys.request_hash`.
  3. On replay, if the incoming request hash does not match `existing.request_hash`, the request is immediately rejected with HTTP 422 Unprocessable Content (`Idempotency key reused with different request payload or endpoint.`).
- **Automated Verification Test**: `backend/tests/test_idempotency.py`
  - `test_reusing_idempotency_key_with_different_payload_is_rejected` (PASSED: rejected with HTTP 422)
- **Remaining Accepted Risk**: None; SHA-256 hash collision resistance prevents parameter manipulation.

---

### Threat 13: Race Condition Overdraft via Mass Concurrent Withdrawals (50 Parallel Requests Attack)
- **Category**: Financial Integrity / Concurrency Control
- **Threat Description**: An account with ₹1,000 balance is targeted by 50 concurrent withdrawal requests of ₹100 each from multiple distributed clients/threads. In a vulnerable system with race conditions (Read-Modify-Write), multiple threads read the positive balance simultaneously, all approve the withdrawal, and the account balance goes severely negative (-₹4,000), causing massive financial loss.
- **Attack Vector**: 50 parallel threads firing simultaneous HTTP `POST /api/v1/transactions/withdrawals` requests with distinct client request IDs.
- **Engineering Defense**:
  1. Immediate Row-Level Locking (`SELECT ... FOR UPDATE`): The customer account is locked atomically at the database kernel level upon entering the transaction.
  2. PostgreSQL serializes all 50 concurrent transactions strictly one-by-one.
  3. Real-time balance check (`balance + overdraft >= amount`):
     - The first 10 requests evaluate with positive available funds, deduct ₹100, update projected balance, and commit atomically.
     - The remaining 40 requests evaluate against a balance of ₹0, fail the condition, record a durable refusal in `transaction_attempts` (`reason_code='INSUFFICIENT_FUNDS'`), and return HTTP 422 Unprocessable Content.
  4. Final account balance remains strictly ₹0 (0 paise), with 0 overdraft and zero-sum ledger conservation.
- **Automated Verification Test**: `backend/tests/test_concurrency.py`
  - `test_50_concurrent_withdrawals_overdraft_prevention` (PASSED: Exactly 10 succeed, exactly 40 fail, final balance is ₹0, 40 durable refusal attempts logged in DB)
  - `test_concurrent_interleaved_deposits_and_withdrawals` (PASSED: 10 interleaved concurrent deposits/withdrawals maintain exact balance)
- **Remaining Accepted Risk**: High lock contention during burst traffic. Mitigated by direct PostgreSQL connections and low transaction duration.

---

### Threat 14: Silent Ledger Tampering & Hash-Chain Invalidation
- **Category**: Cryptographic Auditability & Tamper Detection
- **Threat Description**: A database administrator, rogue insider, or attacker with direct database access attempts to silently modify ledger amounts, delete historic transactions, inject fraudulent entries, or manipulate account balances directly in SQL, bypassing application-level checks.
- **Attack Vector**: Direct SQL execution attempting to change `amount_paise`, drop rows, or alter balances.
- **Engineering Defense**:
  1. Immutable PL/pgSQL database triggers (`prevent_ledger_entry_mutation`, `prevent_ledger_transaction_mutation`, `prevent_audit_log_mutation`) that reject any `UPDATE` or `DELETE` statement at the database kernel layer.
  2. Cryptographic SHA-256 Hash Chaining: Each `LedgerEntry` commits a cryptographic fingerprint `entry_hash = SHA256(id:tx_id:account_id:entry_num:amount:balance:prev_hash)` and points to the immediate predecessor `prev_hash`.
  3. `AuditService.verify_ledger_integrity()` continuously recomputes the cryptographic pointer chain, tests for forks, detects cyclic loops or orphaned entries, recomputes running balances step-by-step, reconciles against `accounts.balance_paise` and `accounts.last_entry_hash`, and validates global double-entry zero-sum conservation ($\sum = 0$).
- **Automated Verification Test**: `backend/tests/test_audit_verification.py` & `backend/tests/test_tamper_detection.py`
  - `test_full_ledger_verification_untampered` (PASSED: Complete system-wide ledger verification confirms `is_valid == True`, `global_sum_paise == 0`, and 0 tampered entries)
  - `test_single_account_verification` (PASSED: Per-account cryptographic verification validates chain continuity and balance projection)
  - `test_tamper_detection_amount_manipulation` (PASSED: Proves that SQL manipulation of `amount_paise` immediately trips SHA-256 fingerprint mismatch, arithmetic mismatch, and balance drift alarms)
  - `test_tamper_detection_hash_chain_break` (PASSED: Proves that forged `prev_hash` pointers immediately trip broken hash chain alarms)
  - `test_tamper_detection_account_balance_table_drift` (PASSED: Proves that direct SQL balance manipulation without matching ledger entries immediately trips account balance drift alarms)
- **Remaining Accepted Risk**: Direct manipulation of offline backups. Mitigated by continuous hash chain audit reports published to external tamper-evident audit logs.

---

### Threat 15: Financial Statement Snooping / Unauthorized Ledger Inspection (IDOR)
- **Category**: Authorization / Information Disclosure (IDOR)
- **Threat Description**: An unprivileged account holder probes `/api/v1/audit/statements/{account_id}` with UUIDs of other customers' accounts to inspect their financial transaction history, balances, and durable refusal attempts.
- **Attack Vector**: Submitting HTTP `GET /api/v1/audit/statements/<victim_account_uuid>` using an active session token belonging to another customer.
- **Engineering Defense**:
  1. IDOR Authorization Barrier: `AuditService.get_account_statement()` checks caller identity against `accounts` and `account_members` tables.
  2. Access is granted ONLY if the caller has the `admin` or `auditor` role, or is an explicit member with `can_view=True`.
  3. Unauthorized attempts are rejected with HTTP 403 Forbidden and logged as security breach events in `audit_logs` (`STATEMENT_VIEW_IDOR_BLOCKED`).
- **Automated Verification Test**: `backend/tests/test_audit_verification.py`
  - `test_account_statement_returns_entries_and_refusals` (PASSED: Valid member views both accepted ledger entries and durable refusal records)
  - `test_statement_idor_defense` (PASSED: Cross-user statement requests rejected with HTTP 403 Forbidden and logged)
  - `test_audit_logs_rbac` (PASSED: Regular holders forbidden HTTP 403 from inspecting system-wide audit logs; admins and auditors allowed)
- **Remaining Accepted Risk**: Authorized members leaking downloaded statement PDFs. Mitigated by session tracking and audit logging of statement views.
