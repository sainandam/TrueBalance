import sys
from pathlib import Path

# Add backend root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from app.db.session import engine, SessionLocal


@pytest.fixture
def db_session():
    """Provides a transactional SQLAlchemy session that closes cleanly."""
    session = SessionLocal()
    try:
        yield session
    finally:
        session.rollback()
        session.close()


@pytest.fixture
def db_conn():
    """Provides a direct database connection that rolls back and closes."""
    conn = engine.connect()
    try:
        yield conn
    finally:
        conn.rollback()
        conn.close()

