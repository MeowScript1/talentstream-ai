"""video_attendance

Record when the candidate and the employer first joined a video interview, so a no-show can be told apart.

Revision ID: e6a1b3c5d7f9
Revises: d5f9a2b4c6e7
Create Date: 2026-11-03 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e6a1b3c5d7f9'
down_revision: Union[str, Sequence[str], None] = 'd5f9a2b4c6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('video_interviews', sa.Column('candidate_joined_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('video_interviews', sa.Column('employer_joined_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('video_interviews', 'employer_joined_at')
    op.drop_column('video_interviews', 'candidate_joined_at')
