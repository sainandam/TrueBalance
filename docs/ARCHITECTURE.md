# Architecture
React + TypeScript -> FastAPI -> validation -> services -> repositories -> PostgreSQL.

Planned domains: authentication, authorization, accounts, double-entry transactions, immutable ledger, and audit verification.

Money is stored in integer paise. Account balances are projections; the ledger remains the source of truth.
