"""add elo rating to user_stats

Revision ID: d3e5f7a8b9c0
Revises: c7f2e4a1b2d3
Create Date: 2026-05-21 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'd3e5f7a8b9c0'
down_revision = 'c7f2e4a1b2d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS so this migration is idempotent — safe to re-run if a
    # previous attempt applied the DDL but crashed before updating alembic_version.
    op.execute(
        "ALTER TABLE user_stats "
        "ADD COLUMN IF NOT EXISTS elo_rating INTEGER NOT NULL DEFAULT 1000"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stats_elo_rating_desc "
        "ON user_stats (elo_rating)"
    )


def downgrade() -> None:
    op.drop_index('ix_stats_elo_rating_desc', table_name='user_stats')
    op.drop_column('user_stats', 'elo_rating')
