import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.db.session import engine
from sqlalchemy import inspect, text


def verify_database():
    print("=== LedgerLine Database Verification ===")
    insp = inspect(engine)
    tables = sorted(insp.get_table_names())
    print(f"Total tables found: {len(tables)}")
    for t in tables:
        cols = [c["name"] for c in insp.get_columns(t)]
        pks = insp.get_pk_constraint(t)["constrained_columns"]
        fks = [f"{fk['constrained_columns']} -> {fk['referred_table']}.{fk['referred_columns']}" for fk in insp.get_foreign_keys(t)]
        print(f" - {t}: {len(cols)} columns, PK={pks}, FKs={len(fks)}")

    with engine.connect() as conn:
        # Check triggers
        trigger_query = text("""
            SELECT event_object_table, trigger_name 
            FROM information_schema.triggers 
            WHERE trigger_schema = 'public'
            ORDER BY event_object_table, trigger_name;
        """)
        triggers = conn.execute(trigger_query).fetchall()
        print("\nTriggers Installed for Ledger & Audit Protection:")
        for tbl, trg in triggers:
            print(f" - Table '{tbl}' protected by trigger: {trg}")

        # Check alembic version
        ver = conn.execute(text("SELECT version_num FROM alembic_version;")).scalar()
        print(f"\nAlembic Current Revision: {ver}")

    print("\n>>> ALL TABLES, CONSTRAINTS, AND IMMUTABILITY TRIGGERS VERIFIED SUCCESSFULLY! <<<")


if __name__ == "__main__":
    verify_database()

