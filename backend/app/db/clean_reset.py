import sys
from pathlib import Path
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.db.session import SessionLocal, engine
from sqlalchemy import text
from app.models.account import Account
from app.models.account_member import AccountMember
from app.models.user import User
from app.security.password import hash_password
from app.services.transaction_service import TransactionService


def clean_reset_database():
    print("=== [CLEAN RESET] Wiping Test Artifacts from LedgerLine Database ===")
    
    # 1. Truncate all tables in cascade order
    with engine.begin() as conn:
        print(" -> Truncating test records across all 9 tables...")
        conn.execute(
            text(
                """
                TRUNCATE TABLE 
                    audit_logs, 
                    ledger_entries, 
                    ledger_transactions, 
                    transaction_attempts, 
                    idempotency_keys, 
                    account_members, 
                    user_sessions, 
                    accounts, 
                    users 
                CASCADE;
                """
            )
        )
        print(" ✓ Tables truncated successfully.")

    db = SessionLocal()
    try:
        # 2. Re-create System Accounts
        print(" -> Initializing System Accounts...")
        world_account = Account(
            id=uuid4(),
            account_number="SYS-WORLD-001",
            account_name="System Clearinghouse (World)",
            currency="INR",
            balance_paise=0,
            overdraft_limit_paise=9223372036854775807,
            status="active",
            is_system=True,
        )
        db.add(world_account)

        fees_account = Account(
            id=uuid4(),
            account_number="SYS-FEES-001",
            account_name="System Fees & Commission",
            currency="INR",
            balance_paise=0,
            overdraft_limit_paise=0,
            status="active",
            is_system=True,
        )
        db.add(fees_account)
        db.commit()
        print(" ✓ System World & Fees Accounts initialized.")

        # 3. Re-create Official Seed Users
        print(" -> Creating Official Seed Users...")
        admin_user = User(
            id=uuid4(),
            email="admin@ledgerline.io",
            full_name="System Administrator",
            role="admin",
            status="active",
            password_hash=hash_password("Admin@12345!"),
        )
        auditor_user = User(
            id=uuid4(),
            email="auditor@ledgerline.io",
            full_name="Independent Auditor",
            role="auditor",
            status="active",
            password_hash=hash_password("Auditor@12345!"),
        )
        holder_user = User(
            id=uuid4(),
            email="holder@ledgerline.io",
            full_name="Demo Account Holder",
            role="holder",
            status="active",
            password_hash=hash_password("Holder@12345!"),
        )
        db.add_all([admin_user, auditor_user, holder_user])
        db.commit()
        print(" ✓ Seed users created (admin, auditor, holder).")

        # 4. Create Clean Professional Customer Accounts for Holder
        print(" -> Creating Clean Demo Customer Accounts...")
        accounts_to_create = [
            ("ACC-DEMO-1001", "Primary Savings Vault", 100000, "Initial Founder Equity Deposit"),       # ₹1,000.00
            ("ACC-DEMO-1002", "Treasury Operations Vault", 500000, "Initial Operating Capital"),       # ₹5,000.00
            ("ACC-DEMO-1003", "Corporate Reserve Vault", 250000, "Emergency Liquidity Reserve"),       # ₹2,500.00
        ]

        created_accs = []
        for acc_num, acc_name, init_balance, reason in accounts_to_create:
            acc = Account(
                id=uuid4(),
                account_number=acc_num,
                account_name=acc_name,
                currency="INR",
                balance_paise=0,
                overdraft_limit_paise=0,
                status="active",
                is_system=False,
            )
            db.add(acc)
            db.flush()

            # Assign Holder as Owner
            membership = AccountMember(
                account_id=acc.id,
                user_id=holder_user.id,
                member_role="owner",
                can_view=True,
                can_deposit=True,
                can_withdraw=True,
                can_transfer=True,
            )
            db.add(membership)
            db.commit()

            # Execute official initial double-entry deposit from System World
            from app.schemas.transaction import DepositRequest
            print(f" -> Funding {acc_num} ({acc_name}) with {init_balance} paise...")
            TransactionService.deposit(
                db=db,
                caller=holder_user,
                req=DepositRequest(
                    target_account_id=acc.id,
                    amount_paise=init_balance,
                    reason=reason,
                ),
                idempotency_key=str(uuid4()),
            )
            created_accs.append(acc)

        print("\n=== [CLEAN RESET COMPLETE] Database is in Pristine Demo State! ===")
        print("Summary of Active Demo Accounts:")
        for a in created_accs:
            db.refresh(a)
            print(f" • {a.account_number}: {a.account_name} — ₹{(a.balance_paise / 100):,.2f} ({a.balance_paise:,} paise)")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    clean_reset_database()
