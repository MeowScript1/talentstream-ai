"""video_meetings_in_app

Video interviews now happen inside TalentStream, so the pasted meeting link is gone.

Revision ID: d5f9a2b4c6e7
Revises: c4e8f1a2b3d5
Create Date: 2026-11-02 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f9a2b4c6e7'
down_revision: Union[str, Sequence[str], None] = 'c4e8f1a2b3d5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('video_interviews', 'meeting_url')


def downgrade() -> None:
    op.add_column('video_interviews', sa.Column('meeting_url', sa.Text(), nullable=False, server_default=''))
