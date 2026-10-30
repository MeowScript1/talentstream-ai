"""add_video_interviews

Revision ID: c4e8f1a2b3d5
Revises: b7c2d9e4a1f0
Create Date: 2026-11-01 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'c4e8f1a2b3d5'
down_revision: Union[str, Sequence[str], None] = 'b7c2d9e4a1f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'video_interviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('application_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('meeting_url', sa.Text(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['application_id'], ['applications.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_video_interviews_application_id'), 'video_interviews', ['application_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_video_interviews_application_id'), table_name='video_interviews')
    op.drop_table('video_interviews')
