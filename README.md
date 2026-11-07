# LedgerLine
Secure Financial Transaction Platform.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI
- ORM: SQLAlchemy 2.x
- Database: PostgreSQL
- Migrations: Alembic
- Tests: Pytest

## Architecture
React frontend -> FastAPI REST API -> validation -> service layer -> repository/data layer -> PostgreSQL.

## Core rules
- Store money as integer paise, never floating-point values.
- Use a double-entry ledger as the source of truth.
- Enforce authorization in the backend.
- Use a restricted database role for the running application.
- Run ledger and concurrency tests against PostgreSQL.
