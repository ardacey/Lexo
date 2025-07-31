"""add game_start_time column

Revision ID: d70aa98b1908
Revises: viewer_mode_cleanup
Create Date: 2025-07-31 14:36:36.752794

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd70aa98b1908'
down_revision: Union[str, Sequence[str], None] = 'viewer_mode_cleanup'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
