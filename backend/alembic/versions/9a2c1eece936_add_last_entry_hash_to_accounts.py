"""add last_entry_hash to accounts

Revision ID: 9a2c1eece936
Revises: e6acf3cc1d11
Create Date: 2026-11-08 09:28:27.608829

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a2c1eece936'
down_revision: Union[str, None] = 'e6acf3cc1d11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('accounts', sa.Column('last_entry_hash', sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column('accounts', 'last_entry_hash')

