"""add friend system

Revision ID: c7f2e4a1b2d3
Revises: b24560f3d18a
Create Date: 2025-12-23 12:30:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'c7f2e4a1b2d3'
down_revision = 'b24560f3d18a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'friend_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('requester_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('addressee_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('responded_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_friend_requests_requester_id', 'friend_requests', ['requester_id'])
    op.create_index('ix_friend_requests_addressee_id', 'friend_requests', ['addressee_id'])
    op.create_index('ix_friend_requests_status', 'friend_requests', ['status'])
    op.create_index('ix_friend_requests_created_at', 'friend_requests', ['created_at'])
    op.create_index('ix_friend_request_pair', 'friend_requests', ['requester_id', 'addressee_id'], unique=True)

    op.create_table(
        'friends',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('friend_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
    )
    op.create_index('ix_friends_user_id', 'friends', ['user_id'])
    op.create_index('ix_friends_friend_id', 'friends', ['friend_id'])
    op.create_index('ix_friends_created_at', 'friends', ['created_at'])
    op.create_index('ix_friend_pair', 'friends', ['user_id', 'friend_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_friend_pair', table_name='friends')
    op.drop_index('ix_friends_created_at', table_name='friends')
    op.drop_index('ix_friends_friend_id', table_name='friends')
    op.drop_index('ix_friends_user_id', table_name='friends')
    op.drop_table('friends')

    op.drop_index('ix_friend_request_pair', table_name='friend_requests')
    op.drop_index('ix_friend_requests_created_at', table_name='friend_requests')
    op.drop_index('ix_friend_requests_status', table_name='friend_requests')
    op.drop_index('ix_friend_requests_addressee_id', table_name='friend_requests')
    op.drop_index('ix_friend_requests_requester_id', table_name='friend_requests')
    op.drop_table('friend_requests')
