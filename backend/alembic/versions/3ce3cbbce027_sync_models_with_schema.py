"""sync_models_with_schema

The Interview model declares interview_verdict and candidate_consented_at, but the
initial migration never created them, so any query on interviews failed.

Revision ID: 3ce3cbbce027
Revises: 958c4830ae09
Create Date: 2026-10-26 15:49:44.500549

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3ce3cbbce027'
down_revision: Union[str, Sequence[str], None] = '958c4830ae09'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('interviews', sa.Column('interview_verdict', sa.String(length=20), nullable=True))
    op.add_column('interviews', sa.Column('candidate_consented_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('interviews', 'candidate_consented_at')
    op.drop_column('interviews', 'interview_verdict')
