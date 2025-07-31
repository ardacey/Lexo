"""add viewer mode and room cleanup features

Revision ID: viewer_mode_cleanup
Revises: 11afebfa9378
Create Date: 2025-01-31 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'viewer_mode_cleanup'
down_revision = '11afebfa9378'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to rooms table
    op.add_column('rooms', sa.Column('created_at', sa.DateTime, server_default=sa.func.now()))
    op.add_column('rooms', sa.Column('max_players', sa.Integer, default=2))
    
    # Add new columns to players table
    op.add_column('players', sa.Column('is_viewer', sa.Boolean, default=False))
    op.add_column('players', sa.Column('created_at', sa.DateTime, server_default=sa.func.now()))


def downgrade():
    # Remove new columns
    op.drop_column('rooms', 'created_at')
    op.drop_column('rooms', 'max_players')
    op.drop_column('players', 'is_viewer')
    op.drop_column('players', 'created_at')
