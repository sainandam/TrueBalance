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
  All 10 tables and 6 protection triggers verified in Neon Cloud DB via `verify_db.py`. Pytest suite passed with 3/3 tests passing against real PostgreSQL.
