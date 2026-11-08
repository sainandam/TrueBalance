# LedgerLine (TrueBalance) — Complete Project & IDE Guide

Welcome to **LedgerLine**. This document explains the architecture, directory structure, what every file does in your IDE, what Module 1 achieved, and how Module 2 works.

---

## 1. What is LedgerLine?

LedgerLine is a **secure financial transaction platform** built to solve the hardest problems in financial computing:
- **Zero-Sum Money Conservation**: Every transaction balances to zero ($\sum \text{debits} + \sum \text{credits} = 0$). Money cannot appear or vanish.
- **Double-Spending Prevention**: Concurrency attacks (e.g. 50 simultaneous withdrawals) cannot cause an overdraft.
- **Idempotency**: Retrying the same transaction request 20 times pays exactly once.
- **Ledger Immutability**: Historical entries can never be edited or deleted by anyone.
- **Auditability**: Refused and failed attempts are permanently logged alongside successful operations.

---

## 2. Directory Tour — What is What on Your IDE

```
snovays/
├── backend/                        # FastAPI Backend & Database Services
│   ├── alembic/                    # Database Migrations
│   │   ├── versions/               # Python migration scripts (e.g. e6acf3cc1d11_initial_ledgerline_schema.py)
│   │   ├── env.py                  # Alembic runtime config (reads DB URL, connects target metadata)
│   │   └── script.py.mako          # Template used to generate new migration files
│   ├── alembic.ini                 # Alembic migration configuration file
│   │
│   ├── app/                        # Main Application Code
│   │   ├── api/                    # HTTP API Routes
│   │   │   └── v1/
│   │   │       └── health.py       # Health checks (/api/v1/health/live, /api/v1/health/ready)
│   │   ├── core/                   # Core Configuration & Low-Level Helpers
│   │   │   ├── config.py           # Reads .env using pydantic-settings
│   │   │   └── dns_patch.py        # Direct RFC 1035 UDP DNS fallback (eliminates router timeouts)
│   │   ├── db/                     # Database Connectivity & Utilities
│   │   │   ├── session.py          # SQLAlchemy engine & SessionLocal factory
│   │   │   ├── seed.py             # Seeds SYS-WORLD-001, SYS-FEES-001, and default demo users
│   │   │   └── verify_db.py        # Inspects tables, constraints, and triggers in Neon DB
│   │   ├── models/                 # SQLAlchemy 2.0 Database Models
│   │   │   ├── base.py             # DeclarativeBase class
│   │   │   ├── user.py             # User credentials, roles ('admin', 'holder', 'auditor')
│   │   │   ├── session.py          # UserSession: cryptographically secure revocable sessions
│   │   │   ├── account.py          # Financial accounts with integer paise & overdraft constraints
│   │   │   ├── account_member.py   # Multi-user account permissions (owner, operator, viewer)
│   │   │   ├── ledger_transaction.py # Transaction headers (type, initiator, reason)
│   │   │   ├── ledger_entry.py     # Double-entry rows (amount_paise, running_balance, hashes)
│   │   │   ├── idempotency_key.py  # Dedupes requests with (user_id, key) unique constraint
│   │   │   ├── transaction_attempt.py # Durable records of accepted AND refused attempts
│   │   │   └── audit_log.py        # Append-only audit trail for administrative actions
│   │   ├── repositories/           # Data access layer (DB queries)
│   │   ├── schemas/                # Pydantic models for request validation & response formatting
│   │   ├── security/               # Cryptography & Authorization
│   │   │   └── password.py         # Argon2id password hashing and verification
│   │   ├── services/               # Core financial & business logic
│   │   └── main.py                 # FastAPI application entry point & CORS configuration
│   │
│   ├── tests/                      # Automated Pytest Test Suite
│   │   ├── conftest.py             # Reusable pytest fixtures (db_conn, db_session)
│   │   ├── test_db_immutability.py # Proves DB triggers reject UPDATE and DELETE on ledger
│   │   └── test_health.py          # Tests API liveness and database readiness endpoints
│   ├── requirements.txt            # Python dependencies (fastapi, sqlalchemy, psycopg, argon2-cffi, pytest)
│   └── .env                        # Local database credentials (Neon Cloud DB URLs) — NOT committed
│
├── frontend/                       # Vite + React + TypeScript Dashboard (Module 8)
│   ├── src/                        # React components, pages, hooks, services
│   ├── package.json                # Frontend dependencies
│   └── vite.config.ts              # Vite configuration
│
├── docs/                           # Architectural Documentation
│   ├── ARCHITECTURE.md             # System design and data flow
│   └── PROJECT_GUIDE.md            # This file!
│
├── THREATS.md                      # Security Threat Model (15 Marks in evaluation)
├── PROMPTS.md                      # AI Interaction & Decision Log (15 Marks in evaluation)
└── README.md                       # Project overview and run instructions
```

---

## 3. Module 1: What Was Built & Verified

1. **Neon Cloud PostgreSQL Setup**: Connected to cloud PostgreSQL 18.6 with pooling support.
2. **Database Models**: 9 SQLAlchemy models with integer paise arithmetic (`BigInteger`).
3. **Immutability Triggers**: Installed 3 PostgreSQL engine triggers (`trg_protect_ledger_entries`, `trg_protect_ledger_transactions`, `trg_protect_audit_logs`). Even direct raw SQL `UPDATE` or `DELETE` commands are rejected by the database.
4. **Seed Accounts & Users**:
   - `SYS-WORLD-001`: External world clearinghouse account.
   - `SYS-FEES-001`: Fee collection account.
   - Users:
     - Admin: `admin@ledgerline.io` / `Admin@12345!`
     - Auditor: `auditor@ledgerline.io` / `Auditor@12345!`
     - Holder: `holder@ledgerline.io` / `Holder@12345!` (linked to `ACC-DEMO-1001`)
5. **Automated Tests**: Pytest test suite verified with 100% pass rate.

---

## 4. Module 2: Authentication & Role-Based Access Control

### Objectives:
1. **Password Security**: Argon2id memory-hard hashing (`app/security/password.py`).
2. **Hashed Sessions**:
   - Random 256-bit entropy token generated on login.
   - SHA-256 hash stored in `user_sessions` table (`token_hash`).
   - The raw token is returned to the client (in `Authorization: Bearer <token>` or session cookie).
   - If the database is compromised, attackers cannot reconstruct user session tokens.
3. **Role-Based Access Control (RBAC)**:
   - **`admin`**: System configuration, account status changes, freezing.
   - **`holder`**: Deposits, withdrawals, internal transfers for permitted accounts.
   - **`auditor`**: Read-only inspection of ledger, verification of hash-chains, audit logs.
4. **API Endpoints**:
   - `POST /api/v1/auth/register`: Register new user (default role: `holder`).
   - `POST /api/v1/auth/login`: Authenticate email + password, issue session token.
   - `POST /api/v1/auth/logout`: Revoke active session token.
   - `GET /api/v1/auth/me`: Return authenticated user profile and roles.

---

## 5. Helpful Commands for Your Terminal

Run these from the workspace root `C:\Users\Saikiran\snovays`:

- **Run all automated tests**:
  ```powershell
  Push-Location backend; & ".\.venv\Scripts\python.exe" -m pytest tests/ -v; Pop-Location
  ```

- **Verify database schema & triggers**:
  ```powershell
  & "backend\.venv\Scripts\python.exe" backend\app\db\verify_db.py
  ```

- **Re-run database seeding**:
  ```powershell
  & "backend\.venv\Scripts\python.exe" backend\app\db\seed.py
  ```

- **Start the FastAPI Backend server**:
  ```powershell
  Push-Location backend; & ".\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000; Pop-Location
  ```
  Then visit Swagger UI in your browser at: **`http://localhost:8000/docs`**
