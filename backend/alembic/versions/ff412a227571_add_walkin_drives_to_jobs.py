"""add_walkin_drives_to_jobs

Employers can post walk-in drives (date range, time, venue, notes); existing jobs stay kind="apply".

Revision ID: ff412a227571
Revises: 489a285af9b8
Create Date: 2026-10-26 21:58:42.674137

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ff412a227571'
down_revision: Union[str, Sequence[str], None] = '489a285af9b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('jobs', sa.Column('kind', sa.String(length=10), server_default='apply', nullable=False))
    op.add_column('jobs', sa.Column('walkin_date', sa.Date(), nullable=True))
    op.add_column('jobs', sa.Column('walkin_end_date', sa.Date(), nullable=True))
    op.add_column('jobs', sa.Column('walkin_start_time', sa.Time(), nullable=True))
    op.add_column('jobs', sa.Column('walkin_end_time', sa.Time(), nullable=True))
    op.add_column('jobs', sa.Column('venue', sa.Text(), nullable=True))
    op.add_column('jobs', sa.Column('walkin_notes', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('jobs', 'walkin_notes')
    op.drop_column('jobs', 'venue')
    op.drop_column('jobs', 'walkin_end_time')
    op.drop_column('jobs', 'walkin_start_time')
    op.drop_column('jobs', 'walkin_end_date')
    op.drop_column('jobs', 'walkin_date')
    op.drop_column('jobs', 'kind')
