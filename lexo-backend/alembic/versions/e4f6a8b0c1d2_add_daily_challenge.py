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
    op.create_table(
        'daily_challenges',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('date', sa.Date(), unique=True, index=True, nullable=False),
        sa.Column('letter_pool', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
    )

    op.create_table(
        'daily_challenge_entries',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('challenge_date', sa.Date(), nullable=False, index=True),
        sa.Column('score', sa.Integer(), server_default='0'),
        sa.Column('words', sa.Text()),
        sa.Column('word_count', sa.Integer(), server_default='0'),
        sa.Column('completed_at', sa.DateTime(), server_default=sa.text('now()')),
    )
    op.create_index(
        'ix_dce_user_date',
        'daily_challenge_entries',
        ['user_id', 'challenge_date'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('ix_dce_user_date', table_name='daily_challenge_entries')
    op.drop_table('daily_challenge_entries')
    op.drop_table('daily_challenges')
