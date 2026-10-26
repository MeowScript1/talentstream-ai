"""add_external_jobs_feed

Jobs collected from other platforms' official APIs, per-source sync bookkeeping, and user reports.

Revision ID: 489a285af9b8
Revises: 816a46a57c8d
Create Date: 2026-10-26 21:30:45.526275

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '489a285af9b8'
down_revision: Union[str, Sequence[str], None] = '816a46a57c8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('external_jobs',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('source', sa.String(length=30), nullable=False),
    sa.Column('external_id', sa.String(length=255), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('company', sa.String(length=300), nullable=True),
    sa.Column('location', sa.String(length=300), nullable=True),
    sa.Column('remote', sa.Boolean(), nullable=True),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('url', sa.Text(), nullable=False),
    sa.Column('salary_text', sa.String(length=120), nullable=True),
    sa.Column('tags', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('posted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('kind', sa.String(length=10), nullable=False),
    sa.Column('walkin_date', sa.Date(), nullable=True),
    sa.Column('walkin_dates', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('walkin_time', sa.String(length=80), nullable=True),
    sa.Column('venue', sa.Text(), nullable=True),
    sa.Column('trust_score', sa.Integer(), nullable=False),
    sa.Column('trust_label', sa.String(length=20), nullable=False),
    sa.Column('trust_reasons', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('report_count', sa.Integer(), nullable=False),
    sa.Column('dedupe_key', sa.String(length=64), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('first_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('source', 'external_id', name='uq_external_job_source_id')
    )
    op.create_index('ix_external_jobs_dedupe', 'external_jobs', ['dedupe_key'], unique=False)
    op.create_index('ix_external_jobs_feed', 'external_jobs', ['is_active', 'kind', 'walkin_date'], unique=False)
    op.create_index('ix_external_jobs_posted_at', 'external_jobs', ['posted_at'], unique=False)
    op.create_table('feed_sync',
    sa.Column('source', sa.String(length=30), nullable=False),
    sa.Column('last_run_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_ok_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('last_count', sa.Integer(), nullable=False),
    sa.Column('last_error', sa.Text(), nullable=True),
    sa.PrimaryKeyConstraint('source')
    )
    op.create_table('job_reports',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('job_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('reason', sa.String(length=300), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['job_id'], ['external_jobs.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('job_id', 'user_id', name='uq_job_report_once')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('job_reports')
    op.drop_table('feed_sync')
    op.drop_index('ix_external_jobs_posted_at', table_name='external_jobs')
    op.drop_index('ix_external_jobs_feed', table_name='external_jobs')
    op.drop_index('ix_external_jobs_dedupe', table_name='external_jobs')
    op.drop_table('external_jobs')
