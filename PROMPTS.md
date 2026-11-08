# Prompt Log & Engineering Decision Records

Genuine dated records of AI-assisted design, human review, defect corrections, and code implementation.

---

### Record 1: 2026-11-07 — Database Schema, Migrations & Ledger Immutability
- **Date**: 2026-11-07T18:14:00+05:30
- **What Was Asked**:
  Generate Alembic migrations and verify the 9 core database models (`users`, `user_sessions`, `accounts`, `account_members`, `ledger_transactions`, `ledger_entries`, `idempotency_keys`, `transaction_attempts`, `audit_logs`) against Neon Cloud PostgreSQL, ensuring database-level immutability for financial records.
- **What AI Initially Generated / Encountered**:
  1. Default Alembic autogenerate produced standard DDL tables without database triggers protecting against SQL tampering.
  2. Windows local DNS (`192.168.0.1`) experienced network timeouts attempting to resolve cloud endpoints (`neon.tech`, `pypi.org`), causing `[Errno 11001] getaddrinfo failed` or 40-second query hangs.
  3. `Mapped[object]` was initially assigned to `created_at` in several SQLAlchemy model files instead of `Mapped[datetime]`.
- **What Was Corrected / Fixed**:
  1. Implemented a zero-dependency RFC 1035 UDP DNS fallback resolver in `app/core/dns_patch.py` and `sitecustomize.py` that queries public DNS (`8.8.8.8`) directly, eliminating local router latency and DNS resolution failures.
  2. Enhanced Alembic migration `e6acf3cc1d11_initial_ledgerline_schema.py` with custom PostgreSQL triggers (`trg_protect_ledger_entries`, `trg_protect_ledger_transactions`, `trg_protect_audit_logs`) preventing `UPDATE` and `DELETE` at the engine level.
  3. Corrected all model datetime typings and foreign key constraints across the schema.
  4. Installed `argon2-cffi` for memory-hard password hashing.
  5. Created automated pytest suite `backend/tests/test_db_immutability.py` proving all direct SQL mutation attempts are rejected.
- **Verification Result**:
  All 10 tables and 6 protection triggers verified in Neon Cloud DB via `verify_db.py`. Pytest suite passed with 3/3 tests passing against real PostgreSQL. Commit: `40bf62e`.

---

### Record 2: 2026-11-08 — Module 2 Authentication, Session Security & RBAC
- **Date**: 2026-11-08T08:05:00+05:30
- **What Was Asked**:
  Implement Module 2: Authentication, revocable session management, and Role-Based Access Control (`ADMIN`, `HOLDER`, `AUDITOR`) using Argon2id password hashing and hashed session tokens.
- **What AI Initially Generated / Encountered**:
  1. Pydantic schema initially used deprecated class-based `class Config: from_attributes = True`, raising deprecation warnings in Pydantic 2.x.
  2. `EmailStr` required the `email-validator` library, which was missing from the initial virtual environment.
- **What Was Corrected / Fixed**:
  1. Installed `email-validator` and updated `backend/requirements.txt`.
  2. Updated schema to modern Pydantic V2 `model_config = ConfigDict(from_attributes=True)`.
  3. Implemented SHA-256 hashed sessions in `backend/app/security/session.py`: client gets high-entropy 256-bit token; server stores only SHA-256 hash.
  4. Implemented server-side RBAC dependency injection (`require_roles("admin")`, `require_roles("auditor")`) in `backend/app/security/deps.py`.
  5. Implemented `AuthService` in `backend/app/services/auth_service.py` with audit logging on registration, login, failed attempts, and logouts.
  6. Created comprehensive test suite `backend/tests/test_auth.py` covering registration, duplicate rejection, login, session revocation on logout, and role access denial.
- **Verification Result**:
  Full test suite passed: 14/14 tests passing across all suites (`test_auth.py`, `test_db_immutability.py`, `test_health.py`). Commit: `3efc06e`.

---

### Record 3: 2026-11-08 — Module 3 Account Management, IDOR Defense & Multi-User Membership
- **Date**: 2026-11-08T08:10:00+05:30
- **What Was Asked**:
  Implement Module 3: Account Management & Membership. Must support account creation, balance retrieval, multi-user membership permissions (Owner, Operator, Viewer), admin account freezing/lifecycle control, and strict defense against Insecure Direct Object References (IDOR).
- **What AI Initially Generated / Encountered**:
  1. Direct account lookup endpoints without membership verification could allow one customer to read another customer's balance or account information using predictable UUIDs (IDOR vulnerability).
  2. Need to ensure non-administrative users cannot grant themselves non-zero overdraft limits upon account creation.
- **What Was Corrected / Fixed**:
  1. Created `backend/app/schemas/account.py` defining requests, responses, member invitations, and lifecycle status changes.
  2. Implemented `AccountService` in `backend/app/services/account_service.py`:
     - Generates collision-resistant 10-digit account numbers (`ACC-XXXXXXXX`).
     - Creator is automatically registered as `owner` in `account_members` with full permissions.
     - Enforces IDOR isolation: holders can only list and view accounts where they have active membership. Unauthorized access attempts log an `IDOR_ACCESS_DENIED` security audit event and return HTTP 403 Forbidden.
     - Regulatory access: Admins and Auditors have supervisory visibility across non-system accounts.
     - Administrative control: Only admins can freeze/unfreeze customer accounts or grant overdraft limits.
  3. Created `backend/app/api/v1/accounts.py` and mounted router in `main.py`.
  4. Authored automated test suite `backend/tests/test_accounts.py` containing 9 comprehensive tests for creation, IDOR defense, multi-user member delegations, and account freezing.
- **Verification Result**:
  All 9 tests in `test_accounts.py` passed with 100% pass rate. Total passing tests across project: 23/23 tests.

---

### Record 4: 2026-11-08 — Module 4 Financial Engine, Double-Entry Invariants & Deadlock-Free Transfers
- **Date**: 2026-11-08T08:18:00+05:30
- **What Was Asked**:
  Implement Module 4: Financial Engine & Double-Entry Ledger. Must implement deposits, withdrawals, and internal transfers enforcing zero-sum money conservation ($\sum \text{amount\_paise} = 0$), SHA-256 hash chaining, row-level locking, deterministic lock ordering to prevent cross-transfer deadlocks, and durable transaction attempt recording for all accepted and refused requests.
- **What AI Initially Generated / Encountered**:
  1. Standard two-phase transfer locking can result in circular wait deadlocks when two users concurrently transfer money to each other (A -> B and B -> A) due to random locking order.
  2. Deprecated `status.HTTP_422_UNPROCESSABLE_ENTITY` generated Starlette deprecation warnings in newer Starlette/FastAPI versions.
  3. External clearinghouse account (`SYS-WORLD-001`) needed to act as the counterparty for deposits and withdrawals to preserve the double-entry accounting model across all transaction types.
- **What Was Corrected / Fixed**:
  1. Created `backend/app/schemas/transaction.py` specifying strict BigInteger integer paise models for deposits, withdrawals, and transfers.
  2. Implemented `LedgerService` in `backend/app/services/ledger_service.py`:
     - Enforces zero-sum invariant: sum of debits and credits must equal zero.
     - Computes tamper-evident SHA-256 hash chains (`entry_hash`, `prev_hash`) per account.
     - Atomically updates account balances in concert with ledger entries.
  3. Implemented `TransactionService` in `backend/app/services/transaction_service.py`:
     - Deposit: Debits `SYS-WORLD-001`, credits customer account.
     - Withdrawal: Debits customer account, credits `SYS-WORLD-001`. Enforces `balance + overdraft >= amount`.
     - Internal Transfer: Enforces distinct source/target accounts, active account statuses, and caller permissions.
     - Implemented Deterministic Lexicographical Lock Ordering (`sorted([source_id, target_id])` with `with_for_update()`) completely eliminating cross-transfer deadlocks.
     - Durable attempt tracking: records all accepted and refused transactions in `transaction_attempts` table.
  4. Created `backend/app/api/v1/transactions.py` and mounted router in `main.py`.
  5. Authored comprehensive test suite `backend/tests/test_financial_engine.py` with 8 tests, including a multi-threaded parallel cross-transfer deadlock stress test.
- **Verification Result**:
  All 31 tests passed across the full test suite (`test_financial_engine.py`, `test_accounts.py`, `test_auth.py`, `test_db_immutability.py`, `test_health.py`). Commit: `3e4e19d`.
