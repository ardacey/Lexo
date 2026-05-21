"""ensure elo_rating column and daily challenge tables actually exist

Revision ID: f5a7c9e1b3d5
Revises: e4f6a8b0c1d2
Create Date: 2026-05-21 14:00:00.000000

Recovery migration: a previous deploy updated alembic_version to e4f6a8b0c1d2
but the DDL transaction was rolled back (concurrent-worker race on Render free
tier).  This migration re-applies every piece of DDL idempotently so the schema
matches the ORM models regardless of prior state.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = 'f5a7c9e1b3d5'
down_revision = 'e4f6a8b0c1d2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── user_stats.elo_rating ─────────────────────────────────────────────────
    op.execute(
        "ALTER TABLE user_stats "
        "ADD COLUMN IF NOT EXISTS elo_rating INTEGER NOT NULL DEFAULT 1000"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_stats_elo_rating_desc "
        "ON user_stats (elo_rating)"
    )

    # ── daily_challenges ──────────────────────────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS daily_challenges (
            id          SERIAL PRIMARY KEY,
            date        DATE      NOT NULL UNIQUE,
            letter_pool VARCHAR   NOT NULL,
            created_at  TIMESTAMP DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenges_date "
        "ON daily_challenges (date)"
    )

    # ── daily_challenge_entries ───────────────────────────────────────────────
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
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_user_id "
        "ON daily_challenge_entries (user_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_daily_challenge_entries_challenge_date "
        "ON daily_challenge_entries (challenge_date)"
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_dce_user_date "
        "ON daily_challenge_entries (user_id, challenge_date)"
    )


def downgrade() -> None:
    # Intentionally a no-op: the previous migrations already define the
    # downgrade path; this migration only ensures DDL is present.
    pass
