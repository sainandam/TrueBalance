import sys
from pathlib import Path
from uuid import uuid4

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.db.session import SessionLocal
from app.models.account import Account
from app.models.account_member import AccountMember
from app.models.user import User
from app.security.password import hash_password


def seed_database():
    print("=== Seeding LedgerLine Database ===")
    db = SessionLocal()
    try:
        # 1. System Accounts
        world_account = db.query(Account).filter_by(account_number="SYS-WORLD-001").first()
        if not world_account:
            world_account = Account(
                id=uuid4(),
                account_number="SYS-WORLD-001",
                account_name="System Clearinghouse (World)",
                currency="INR",
                balance_paise=0,
                overdraft_limit_paise=9223372036854775807,  # Effectively unlimited for external clearing
                status="active",
                is_system=True,
            )
            db.add(world_account)
            print(" + Created System World Account: SYS-WORLD-001")
        else:
            print(" = System World Account already exists")

        fees_account = db.query(Account).filter_by(account_number="SYS-FEES-001").first()
        if not fees_account:
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
            print(" + Created System Fees Account: SYS-FEES-001")
        else:
            print(" = System Fees Account already exists")

        # 2. Seed Default Users
        users_to_seed = [
            ("admin@ledgerline.io", "System Administrator", "admin", "Admin@12345!"),
            ("auditor@ledgerline.io", "Independent Auditor", "auditor", "Auditor@12345!"),
            ("holder@ledgerline.io", "Demo Account Holder", "holder", "Holder@12345!"),
        ]

        seeded_users = {}
        for email, name, role, raw_pass in users_to_seed:
            user = db.query(User).filter_by(email=email).first()
            if not user:
                user = User(
                    id=uuid4(),
                    email=email,
                    full_name=name,
                    role=role,
                    status="active",
                    password_hash=hash_password(raw_pass),
                )
                db.add(user)
                print(f" + Created Seed User: {email} ({role})")
            else:
                print(f" = User already exists: {email}")
            seeded_users[role] = user

        db.commit()

        # 3. Seed Demo Holder Customer Account if not exists
        holder_user = seeded_users["holder"]
        holder_acc = db.query(Account).filter_by(account_number="ACC-DEMO-1001").first()
        if not holder_acc:
            holder_acc = Account(
                id=uuid4(),
                account_number="ACC-DEMO-1001",
                account_name="Demo Primary Savings",
                currency="INR",
                balance_paise=0,
                overdraft_limit_paise=0,
                status="active",
                is_system=False,
            )
            db.add(holder_acc)
            db.flush()

            # Add holder membership
            membership = AccountMember(
                account_id=holder_acc.id,
                user_id=holder_user.id,
                member_role="owner",
                can_view=True,
                can_deposit=True,
                can_withdraw=True,
                can_transfer=True,
            )
            db.add(membership)
            db.commit()
            print(" + Created Demo Holder Account: ACC-DEMO-1001 with Owner membership")
        else:
            print(" = Demo Holder Account already exists")

        print("=== Database Seeding Complete! ===")
    except Exception as e:
        db.rollback()
        print(f"ERROR during seeding: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()

