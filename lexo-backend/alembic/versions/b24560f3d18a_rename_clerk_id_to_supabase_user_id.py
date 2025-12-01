"""Rename clerk_id to supabase_user_id

Revision ID: b24560f3d18a
Revises: a15449e2c16f
Create Date: 2025-12-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b24560f3d18a'
down_revision: Union[str, None] = 'a15449e2c16f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Rename the column from clerk_id to supabase_user_id
    op.alter_column('users', 'clerk_id', new_column_name='supabase_user_id')
    
    # Drop the old index
    op.drop_index('ix_users_clerk_id', table_name='users')
    
    # Create new index with the new column name
    op.create_index('ix_users_supabase_user_id', 'users', ['supabase_user_id'], unique=True)


def downgrade() -> None:
    # Revert: rename supabase_user_id back to clerk_id
    op.alter_column('users', 'supabase_user_id', new_column_name='clerk_id')
    
    # Drop the new index
    op.drop_index('ix_users_supabase_user_id', table_name='users')
    
    # Recreate old index
    op.create_index('ix_users_clerk_id', 'users', ['clerk_id'], unique=True)
