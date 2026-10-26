"""add_saved_resume_to_users

Revision ID: 816a46a57c8d
Revises: 3ce3cbbce027
Create Date: 2026-10-26 19:26:33.301510

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '816a46a57c8d'
down_revision: Union[str, Sequence[str], None] = '3ce3cbbce027'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('resume_url', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('resume_filename', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('resume_text', sa.Text(), nullable=True))
    op.add_column('users', sa.Column('resume_updated_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'resume_updated_at')
    op.drop_column('users', 'resume_text')
    op.drop_column('users', 'resume_filename')
    op.drop_column('users', 'resume_url')
