"""add_alerts_and_decision_dates

Walk-in alerts per user and city, and the date an employer decided on an application
(so a response rate can be measured instead of guessed).

Revision ID: b7c2d9e4a1f0
Revises: ff412a227571
Create Date: 2026-10-31 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b7c2d9e4a1f0'
down_revision: Union[str, Sequence[str], None] = 'ff412a227571'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('applications', sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        'walkin_alerts',
        sa.Column('id', postgresql.UUID(as_uuid=True), server_default=sa.text('gen_random_uuid()'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'city', name='uq_walkin_alert_user_city'),
    )
    op.create_index(op.f('ix_walkin_alerts_user_id'), 'walkin_alerts', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_walkin_alerts_user_id'), table_name='walkin_alerts')
    op.drop_table('walkin_alerts')
    op.drop_column('applications', 'decided_at')
