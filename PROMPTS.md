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

---

### Record 5: 2026-11-08 — Module 5 Idempotency Engine & 50 Concurrent Withdrawals Stress Defense
- **Date**: 2026-11-08T09:12:00+05:30
- **What Was Asked**:
  Implement Module 5: Idempotency & Concurrency Hardening (P0 — 35 Marks Integrity/Security). Must implement SHA-256 canonical payload hashing, detection of concurrent duplicate requests (HTTP 409 Conflict), cached response replays, payload tampering rejection (HTTP 422), and pass the flagship hackathon challenge test: 50 concurrent withdrawals of ₹100 against an account with ₹1,000 balance, verifying exactly 10 succeed, 40 fail with Insufficient Funds, final balance is strictly ₹0, and 40 refusal attempts are durably logged.
- **What AI Initially Generated / Encountered**:
  1. Neon Serverless PgBouncer connection pooler (`-pooler`) in `DATABASE_URL` closed connections unexpectedly when multiple concurrent workers opened `SELECT ... FOR UPDATE` row locks, because PgBouncer in transaction-pooling mode does not support extended row-level locking across worker queues.
  2. Sequential duplicate queries: `TransactionService` queried `Account` without a lock before locking it with `with_for_update()`, causing SQLAlchemy session identity map caching of stale balances during high-frequency concurrent deposits.
  3. `TestClient` in `test_idempotency.py` initially looked for `"session_token"` instead of `"token"` in the auth login response.
- **What Was Corrected / Fixed**:
  1. Implemented `IdempotencyService` in `backend/app/services/idempotency_service.py`:
     - Canonical SHA-256 request payload hashing (`compute_request_hash`) over `(endpoint, sorted payload)`.
     - Detects in-flight concurrent duplicates and raises HTTP 409 Conflict.
     - Atomically transitions key from `processing` -> `succeeded` or `refused`.
     - Returns cached responses for identical replays without executing double transactions.
     - Rejects altered payloads under reused keys with HTTP 422 Unprocessable Content.
  2. Switched application database connection to direct Neon PostgreSQL instance (without `-pooler`), tuned SQLAlchemy connection pooling (`pool_size=10`, `max_overflow=15`, `pool_recycle=300`) to natively support concurrent ACID row locks.
  3. Streamlined `TransactionService` (`deposit`, `withdraw`, `transfer`):
     - Immediate row-level locking (`SELECT ... FOR UPDATE`) at query entry, completely eliminating stale balance reads from the SQLAlchemy identity map.
     - Unified durable attempt recording and idempotency failure caching in the exception handling path.
  4. Authored `backend/tests/test_idempotency.py` (4 tests) verifying replay protection, duplicate prevention, payload tampering defense, and concurrent duplicate collisions.
  5. Authored `backend/tests/test_concurrency.py` (2 tests), including the 50 simultaneous withdrawals stress test:
     - 50 concurrent threads simultaneously attempt to withdraw ₹100 from an account with ₹1,000.
     - Exactly 10 succeed (HTTP 201), exactly 40 fail (HTTP 422 Insufficient Funds).
     - Final balance is strictly ₹0.
     - Exactly 40 durable refusal attempts logged in `transaction_attempts`.
     - 10 interleaved concurrent deposits and withdrawals verified for zero balance drift.
- **Verification Result**:
  All 37 tests passed across all 7 test suites (`test_concurrency.py`, `test_idempotency.py`, `test_financial_engine.py`, `test_accounts.py`, `test_auth.py`, `test_db_immutability.py`, `test_health.py`). Commit: `305a1a0`.

---

### Record 6: 2026-11-08 — Module 6 Audit Trail, Refusals & Cryptographic Verification Engine
- **Date**: 2026-11-08T09:40:00+05:30
- **What Was Asked**:
  Implement Module 6: Audit Trail, Refusals & Integrity Verification Engine (P0/P1 — 15 Marks Integrity, 15 Marks Functionality). Must implement:
  1. Cryptographic ledger verification endpoints (`GET /api/v1/audit/verify` and `GET /api/v1/audit/verify/{account_id}`) verifying SHA-256 hash chains, running balance arithmetic, account balance reconciliation, and global zero-sum conservation.
  2. Account transaction statements (`GET /api/v1/audit/statements/{account_id}`) combining both accepted double-entry postings and durable refusal attempts in a single chronological stream with strict IDOR protection.
  3. Supervisory audit inspection (`GET /api/v1/audit/logs`) restricted to Admins and Auditors.
- **What AI Initially Generated / Encountered**:
  1. `AuditService.verify_ledger_integrity` ordered entries by `created_at` timestamp. Because PostgreSQL sets `now()` to the start of the transaction block (`transaction_timestamp()`), sub-millisecond concurrent transactions queued for locks evaluated `now()` slightly out-of-order relative to lock acquisition time, producing perceived chain breaks when ordered by timestamp alone.
  2. `test_db_immutability.py` in Module 1 committed mock ledger entries with `'mock_hash_entry_1'` and unbalanced amounts into the database, which violated the cryptographic hash chain and the global zero-sum invariant ($\sum \text{amount\_paise} = 0$).
  3. `AuditLog.details` JSON serialization threw `TypeError: Object of type Decimal is not JSON serializable` because SQLAlchemy `func.sum()` returned a `Decimal`.
  4. PostgreSQL transaction abort state in `test_db_immutability.py` prevented subsequent statements from running in the same transaction block without `SAVEPOINT`.
- **What Was Corrected / Fixed**:
  1. Tip Hash Pointer Architecture: Added `last_entry_hash` column to `accounts` table via Alembic migration `9a2c1eece936_add_last_entry_hash_to_accounts.py`. In `LedgerService.post_double_entry`, when an account is locked with `with_for_update()`, `prev_hash` is read directly from `account.last_entry_hash` and updated atomically upon entry insertion. This guarantees strictly linear chaining with zero forks under heavy concurrency without relying on clocks.
  2. Graph Traversal Integrity Engine: In `AuditService.verify_ledger_integrity`, reconstructed the entry chain by traversing `prev_hash -> entry_hash` pointers from genesis (`prev_hash is None`) to tip. Detects:
     - Forks (multiple entries referencing the same previous hash)
     - Cyclic loops in the ledger
     - Orphaned or disconnected entries
     - Cryptographic SHA-256 fingerprint tampering
     - Balance projection arithmetic discrepancies
     - Account balance drift (`accounts.balance_paise != sum(entries)`)
     - Tip hash drift (`accounts.last_entry_hash != tip.entry_hash`)
     - Global zero-sum invariant violation ($\sum \text{amount\_paise} \neq 0$)
  3. Account Statement Aggregation: In `AuditService.get_account_statement()`, combined posted ledger entries and durable refusal records (`transaction_attempts`) sorted chronologically, with strict member/ownership IDOR verification.
  4. Cleaned up mock entries and refactored `test_db_immutability.py` to use `db_conn.begin_nested()` (savepoints) and transaction rollback to avoid database test pollution.
  5. Authored comprehensive test suite in `backend/tests/test_audit_verification.py` (5 tests).
- **Verification Result**:
  All 42 tests passed across all 8 test suites (`test_audit_verification.py`, `test_accounts.py`, `test_auth.py`, `test_concurrency.py`, `test_db_immutability.py`, `test_financial_engine.py`, `test_health.py`, `test_idempotency.py`). Commit: `23beaae`.

---

### Record 7: 2026-11-08 — Module 7 Security & Mutation Verification Suite (Tamper Detection)
- **Date**: 2026-11-08T09:42:00+05:30
- **What Was Asked**:
  Implement Module 7: Security & Mutation Verification Suite (P0 — 35 Marks Integrity/Security, 15 Marks THREATS.md). Must write dedicated automated tests that deliberately attempt to break money integrity and falsify ledger data directly in PostgreSQL (simulating rogue insider superuser attacks) and prove that the cryptographic verification engine flags every anomaly.
- **What AI Initially Generated / Encountered**:
  Direct SQL updates on `ledger_entries` were blocked by the PostgreSQL trigger `trg_protect_ledger_entries`. To test verification of a compromised database, the test suite needed to simulate superuser privilege (temporarily disabling the trigger, applying the illicit mutation, asserting the verification engine's alarm response, and cleanly restoring the database state within a `finally` block).
- **What Was Corrected / Fixed**:
  Authored `backend/tests/test_tamper_detection.py` with 3 explicit mutation tests:
  1. `test_tamper_detection_amount_manipulation`: Mutates `amount_paise` directly in SQL. Proves that `GET /api/v1/audit/verify/{id}` returns `is_valid: False` and reports:
     - `Cryptographic SHA-256 fingerprint mismatch (tampering detected)`
     - `Running balance arithmetic mismatch`
     - `Account balance drift`
  2. `test_tamper_detection_hash_chain_break`: Forges `prev_hash` pointers in SQL. Proves that the verification engine flags `Broken hash chain` / `Orphaned or disconnected entry` and sets `is_valid: False`.
  3. `test_tamper_detection_account_balance_table_drift`: Modifies `accounts.balance_paise` directly in SQL without corresponding ledger entries. Proves that the verification engine flags `Account balance drift` between table balance and ledger sums.
- **Verification Result**:
  All 45 tests passed across all 9 test suites (`test_tamper_detection.py`, `test_audit_verification.py`, `test_accounts.py`, `test_auth.py`, `test_concurrency.py`, `test_db_immutability.py`, `test_financial_engine.py`, `test_health.py`, `test_idempotency.py`). Commit: `12ac7ed`.

---

### Record 8: 2026-11-08 — Module 8 React + TypeScript Frontend Application & Live Demonstrator Dashboard
- **Date**: 2026-11-08T09:51:00+05:30
- **What Was Asked**:
  Implement Module 8: React + TypeScript Frontend Application & Live Demonstrator Dashboard (P0/P1 — 10 Marks Engineering Quality, 10 Marks Documentation & Demo). Must build an enterprise-grade FinTech UI with:
  1. Role-based experience for Admin, Auditor, and Account Holder with 1-click instant demo sign-in for seed credentials.
  2. Account Cards displaying balances in ₹ (converted from integer paise), account numbers, and status.
  3. Action Modals for Deposits, Withdrawals, and Transfers with automatic `Idempotency-Key` generation and reason tracking.
  4. Interactive Statement Viewer combining settled double-entry postings and prominent durable refusal badges (`INSUFFICIENT_FUNDS`), displaying SHA-256 hash chains (`entry_hash` & `prev_hash`).
  5. Auditor Cockpit with 1-click Cryptographic Ledger Verification (`VALID & UNBROKEN`), Global Zero-Sum balance proof ($\sum = 0$), tampered entries breakdown, and live search/filter Audit Trail feed.
  6. Comprehensive `README.md` documentation, architecture diagrams, and testing scripts.
- **What AI Initially Generated / Encountered**:
  1. `src/main.tsx` side-effect import of `./index.css` failed TypeScript compilation with `error TS2882: Cannot find module or type declarations for side-effect import of './index.css'` because `src/vite-env.d.ts` was missing.
  2. Serving static frontend assets at the root route `/` overrode the JSON API dictionary expected by `test_health.py::test_root`, causing a JSON decode error.
- **What Was Corrected / Fixed**:
  1. Configured `@tailwindcss/vite` in `frontend/vite.config.ts`, added modern Tailwind CSS styling in `src/index.css`, installed `lucide-react`, and created `src/vite-env.d.ts`.
  2. Implemented modular React components in `frontend/src/components/`:
     - `Navbar.tsx`: Live Neon PostgreSQL health indicator, role badges, user profile, and session termination.
     - `AuthModal.tsx`: Dual-mode login/register with 1-click Quick Login buttons for pre-seeded Admin, Auditor, and Holder accounts.
     - `AccountCard.tsx`: Balance cards with ₹ formatting, freeze indicators, and quick action buttons.
     - `TransactionModal.tsx`: Atomic double-entry execution modal with client-side paise conversion and cryptographic UUID `Idempotency-Key` generation.
     - `StatementModal.tsx`: Combined chronological ledger with credit/debit indicators, durable refusal alerts, SHA-256 fingerprint provenance, and 1-click single-account cryptographic verify.
     - `AuditorView.tsx`: System-wide audit cockpit with 1-click hash recomputation, zero-sum meter, and searchable audit trail with expandable JSON details.
     - `CreateAccountModal.tsx`: Account creation with optional overdraft configuration for admins.
  3. In `backend/app/main.py`, preserved `@app.get("/")` JSON API response for health probes and mounted the compiled SPA under `/app`, supporting both developer hot-reload via Vite and standalone full-stack serving.
  4. Executed `npm run build` in `frontend/`, verifying strict TypeScript compilation and production Vite bundling (`dist/index.html`, `dist/assets/index.css`, `dist/assets/index.js`) in 1.29s.
  5. Authored comprehensive, publication-grade `README.md` with Mermaid architecture diagrams, 15 threat mappings, quickstart guide, and evaluation instructions.
- **Verification Result**:
  Frontend production build successful (`dist/` generated). All 45 backend automated tests passed across all 9 test suites on real Neon Cloud PostgreSQL. Commit: `2fc049d`.
