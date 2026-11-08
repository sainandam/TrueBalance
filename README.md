# TrueBalance (LedgerLine)

> **Enterprise-Grade Financial Transaction Processing & Cryptographically Auditable Double-Entry Ledger**  
> Built for the **Snovasys Fresher Hiring Challenge 2026**.

[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL_18.6_(Neon_Cloud)-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![SQLAlchemy](https://img.shields.io/badge/ORM-SQLAlchemy_2.0-D71F00.svg)](https://www.sqlalchemy.org/)
[![React](https://img.shields.io/badge/Frontend-React_19_+_TypeScript-61DAFB.svg?logo=react&logoColor=black)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/UI-Tailwind_CSS_v4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/Tests-45_Passed_(100%25)-success.svg)](https://github.com/sainandam/TrueBalance)

---

## 1. Executive Summary & Core Invariants

In financial systems, traditional CRUD architectures are vulnerable to catastrophic money duplication, race conditions, unauthorized overdrafts, and silent ledger tampering. **TrueBalance** is architected from the ground up as a resilient financial transaction processing platform where:

1. **Zero-Sum Double-Entry Invariant ($\sum \text{amount\_paise} = 0$)**:  
   Money never moves unilaterally. Every deposit, withdrawal, and transfer consists of balanced debits and credits committed in a single atomic database transaction.
2. **Fixed 64-bit Integer Precision**:  
   All monetary amounts are stored as 64-bit integer `paise` (1 INR = 100 paise), entirely eliminating IEEE-754 floating-point rounding errors.
3. **Deterministic Lexicographical Locking**:  
   Multi-account transfers acquire row-level locks (`SELECT ... FOR UPDATE`) in strict lexicographical order of account UUIDs (`min(acc1, acc2)`, then `max(acc1, acc2)`). Deadlocks under concurrent cross-transfers are mathematically impossible.
4. **Idempotency Guarantee**:  
   Duplicate API requests (due to retries or network drops) pass an `Idempotency-Key`. Canonical SHA-256 payload hashing ensures that identical requests return cached responses, while parameter tampering under reused keys is rejected with `HTTP 422`.
5. **Flagship Concurrency Defense**:  
   **50 simultaneous concurrent withdrawal requests** of ₹100 against an account with ₹1,000 balance result in **strictly 10 successes, 40 failures (`INSUFFICIENT_FUNDS`), a final balance of strictly ₹0, and 40 durable refusal attempts**.
6. **Kernel-Level Immutability**:  
   PostgreSQL PL/pgSQL triggers block `UPDATE` and `DELETE` statements on `ledger_entries`, `ledger_transactions`, and `audit_logs` at the database kernel level.
7. **Cryptographic SHA-256 Chain Verification**:  
   Each ledger entry records a SHA-256 cryptographic fingerprint (`entry_hash`) linking to its immediate predecessor (`prev_hash`). An interactive verification engine allows auditors to mathematically verify that the ledger has not been tampered with or forked.

---

## 2. System Architecture

```mermaid
flowchart TD
    Client["React 19 + TypeScript SPA (Vite + Tailwind CSS)"]
    API["FastAPI Async Gateway (Port 8000)"]
    Auth["Argon2id Auth & Session Guard (SHA-256 Tokens)"]
    Service["Transaction & Ledger Service Layer"]
    Idem["Idempotency Engine (Canonical SHA-256)"]
    DB[("Neon Cloud PostgreSQL 18.6")]
    Audit["Cryptographic Verification Engine"]

    Client -->|HTTPS / REST API| API
    API --> Auth
    Auth --> Service
    Service --> Idem
    Service -->|Row Locks: SELECT ... FOR UPDATE| DB
    Service -->|Atomic Double-Entry Bookkeeping| DB
    DB -->|Immutability Triggers (PL/pgSQL)| DB
    Audit -->|Recompute SHA-256 Chains & Sums| DB
    API --> Audit
```

---

## 3. Seed Accounts & Roles

The system is seeded with three distinct user roles for demo and evaluation:

| Role | Email | Password | Permissions & Scope |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@ledgerline.io` | `Admin@12345!` | Full system governance, view all accounts, freeze/unfreeze accounts, manage overdraft limits, inspect audit logs. |
| **Independent Auditor** | `auditor@ledgerline.io` | `Auditor@12345!` | 1-click cryptographic ledger verification (`/api/v1/audit/verify`), view supervisory audit logs, inspect accounts without transacting. |
| **Account Holder** | `holder@ledgerline.io` | `Holder@12345!` | Create savings accounts, execute deposits, withdrawals, and transfers, view balances, and inspect statements with durable refusal badges. |

*Pre-seeded Primary Savings Account for Holder*: `ACC-DEMO-1001`

---

## 4. Verification & Threat Mapping

All 15 identified security threats from [THREATS.md](./THREATS.md) are mitigated by architecture and proven with automated tests:

| Threat ID | Threat Category | Automated Verification Test | Result |
| :---: | :--- | :--- | :---: |
| **T01** | Weak Password Storage | `test_auth.py::test_user_registration_success` | **PASSED** |
| **T02** | Session Token Prediction | `test_auth.py::test_user_login_success` | **PASSED** |
| **T03** | Unauthorized Role Elevation | `test_auth.py::test_rbac_admin_and_holder_permissions` | **PASSED** |
| **T04** | IDOR Account Snooping | `test_accounts.py::test_direct_object_reference_forbidden_idor` | **PASSED** |
| **T05** | Unauthorized Overdraft Grant | `test_accounts.py::test_non_admin_cannot_grant_overdraft` | **PASSED** |
| **T06** | Frozen Account Operation | `test_financial_engine.py::test_frozen_account_transfer_rejected` | **PASSED** |
| **T07** | Floating-Point Precision Drift | `test_financial_engine.py::test_deposit_success_and_zero_sum_invariant` | **PASSED** |
| **T08** | Negative Balance Overdraft | `test_financial_engine.py::test_withdrawal_insufficient_funds_refused` | **PASSED** |
| **T09** | Cross-Transfer Deadlock Race | `test_financial_engine.py::test_deterministic_lock_order_cross_transfers_no_deadlock` | **PASSED** |
| **T10** | Double-Entry Zero-Sum Breach | `test_financial_engine.py::test_transfer_success_and_money_conservation` | **PASSED** |
| **T11** | Idempotency Key Replay Double-Spend | `test_idempotency.py::test_deposit_with_idempotency_key_replay_returns_cached_response` | **PASSED** |
| **T12** | Payload Tampering on Reused Key | `test_idempotency.py::test_reusing_idempotency_key_with_different_payload_is_rejected` | **PASSED** |
| **T13** | **50 Concurrent Withdrawals Overdraft** | `test_concurrency.py::test_50_concurrent_withdrawals_overdraft_prevention` | **PASSED** |
| **T14** | Silent Ledger Tampering & Broken Chain | `test_tamper_detection.py::test_tamper_detection_amount_manipulation` | **PASSED** |
| **T15** | Financial Statement IDOR Leak | `test_audit_verification.py::test_statement_idor_defense` | **PASSED** |

---

## 5. Quickstart & Local Setup

### Prerequisites
- **Python**: 3.12 or higher (Python 3.14 verified)
- **Node.js**: 18.0 or higher (npm 10+)
- **PostgreSQL**: Cloud (Neon) or local PostgreSQL 16+

### 1. Clone Repository
```bash
git clone https://github.com/sainandam/TrueBalance.git
cd TrueBalance
```

### 2. Backend Setup
```bash
cd backend
python -m venv .venv

# Windows Powershell
.\.venv\Scripts\Activate.ps1
# Linux / macOS
# source .venv/bin/activate

pip install -r requirements.txt
```

### 3. Database Migrations & Seeding
Configure your `DATABASE_URL` in `backend/.env` (configured for Neon PostgreSQL by default), then run:
```bash
# Run migrations
alembic upgrade head

# Seed system clearing accounts and demo users
python app/db/seed.py
```

### 4. Run Automated Test Suite
To run all 45 automated security, concurrency, and integrity tests against the live database:
```bash
python -m pytest tests/ -v
```

### 5. Start Backend Server
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- API Documentation (Swagger / OpenAPI): `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/v1/health/ready`

### 6. Frontend Setup
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
- Web Application: `http://localhost:5173/`

*(Alternatively, the compiled production application is served directly by the backend at `http://127.0.0.1:8000/app`)*

---

## 6. Interactive Testing & Demonstrator Walkthrough

### Scenario A: Interactive Concurrency Lab (UI & Terminal)
1. In the Web UI, open the **⚡ Concurrency Lab** tab.
2. Select any target vault account (e.g. `ACC-DEMO-1001`).
3. Click **"Fire 10 Parallel Overdraft Requests"**:
   - The UI immediately dispatches 10 simultaneous asynchronous `fetch` threads via `Promise.all`.
   - Watch the thread telemetry grid illuminate with individual latency measurements, unique UUID idempotency keys, and HTTP status codes (`HTTP 200` vs `HTTP 422 Insufficient Funds`).
   - Observe the live verification summary proving initial balance minus total settled amount equals final balance, with zero overdraft and zero negative balances.
4. Or run the terminal automated test proving 50-worker zero-overdraft concurrency safety:
```bash
cd backend
python -m pytest tests/test_concurrency.py -k test_50_concurrent_withdrawals_overdraft_prevention -v
```
*Expected*: Exactly 10 succeed (credited), 40 fail with `INSUFFICIENT_FUNDS`, account balance is strictly ₹0, and 40 refusal records are permanently saved.

### Scenario B: 1-Click Cryptographic Ledger Verification
1. Sign in as **Auditor** (`auditor@ledgerline.io` / `Auditor@12345!`).
2. Switch to **Auditor Cockpit**.
3. Click **"Re-verify Entire Ledger"**.
4. Observe:
   - System overall integrity: `VALID & UNBROKEN`
   - Global zero-sum invariant: `0 paise` (`\sum = 0` strictly conserved)
   - Real-time audit events stream displaying actors, IP sessions, and cryptographic hashes.

### Scenario C: Statement with Durable Refusals & Idempotency
1. Sign in as **Account Holder** (`holder@ledgerline.io` / `Holder@12345!`).
2. Deposit ₹500 into your account.
3. Attempt to withdraw ₹1,000 (exceeding balance). Notice the immediate rejection (`HTTP 422 Insufficient Funds`).
4. Click **"Statement"** on your account:
   - See the settled deposit (+₹500.00) with its cryptographic `entry_hash` and `prev_hash`.
   - See the durable refusal badge displaying `REFUSED WITHDRAWAL: INSUFFICIENT_FUNDS`.
   - Click **"Verify Cryptographic Integrity"** to validate the account's private hash chain.

---

## 7. Deliverables Checklist

- [x] **Money Integrity & Security (35 Marks)**: Integer paise, zero-sum double-entry, deterministic row locks, PL/pgSQL immutability triggers, SHA-256 hash chains, 50-worker race condition proof.
- [x] **THREATS.md (15 Marks)**: 15 documented financial threats mapped 1:1 with automated test functions in `tests/`.
- [x] **Functional Requirements (15 Marks)**: Complete RBAC (Admin, Auditor, Holder), deposits, withdrawals, transfers, multi-account management, account statements, audit logs.
- [x] **PROMPTS.md (15 Marks)**: Dated architectural records detailing problem statements, AI design flaws identified, engineering corrections applied, and Git commit hashes.
- [x] **Engineering Quality (10 Marks)**: Production-grade FastAPI + SQLAlchemy 2.0 async service layer, Alembic migrations, clean REST schemas, responsive Tailwind UI.
- [x] **Documentation & Deployment (10 Marks)**: Comprehensive README, reproducible local setup, direct Neon Cloud database connection, pre-seeded accounts.

---

**Developed with precision for the Snovasys Fresher Hiring Challenge 2026.**
