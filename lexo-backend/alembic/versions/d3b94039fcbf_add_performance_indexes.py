"""add_performance_indexes

Revision ID: d3b94039fcbf
Revises: d70aa98b1908
Create Date: 2025-07-31 16:10:52.919704

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd3b94039fcbf'
down_revision: Union[str, Sequence[str], None] = 'd70aa98b1908'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
