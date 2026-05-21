"""add daily challenge tables

Revision ID: e4f6a8b0c1d2
Revises: d3e5f7a8b9c0
Create Date: 2026-05-21 00:01:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'e4f6a8b0c1d2'
down_revision = 'd3e5f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use IF NOT EXISTS throughout so this migration is idempotent — safe to
    # re-run if a previous attempt applied the DDL but crashed before Alembic
    # could update alembic_version (e.g. due to a concurrent-worker race).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id         SERIAL PRIMARY KEY,
            date       DATE        NOT NULL UNIQUE,
            letter_pool VARCHAR    NOT NULL,
            created_at TIMESTAMP   DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenges_id   ON daily_challenges (id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenges_date ON daily_challenges (date)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_challenge_entries (
            id             SERIAL PRIMARY KEY,
            user_id        INTEGER   NOT NULL REFERENCES users(id),
            challenge_date DATE      NOT NULL,
            score          INTEGER   DEFAULT 0,
            words          TEXT,
            word_count     INTEGER   DEFAULT 0,
            completed_at   TIMESTAMP DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_id            ON daily_challenge_entries (id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_user_id       ON daily_challenge_entries (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_challenge_date ON daily_challenge_entries (challenge_date)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_dce_user_date "
        "ON daily_challenge_entries (user_id, challenge_date)"
    )


def downgrade() -> None:
    op.drop_index('ix_dce_user_date', table_name='daily_challenge_entries')
    op.drop_table('daily_challenge_entries')
    op.drop_table('daily_challenges')
