"""create schema

Migração baseline para uma Postgres compartilhada (ver
Settings.DATABASE_SCHEMA): toda outra migração deste projeto cria suas
tabelas sob esse único schema, então o schema em si precisa existir
primeiro. Espelha o `0000_baseline_cur_qua.py` do rnc2/server — mesmo
raciocínio, só que com um nome configurável em vez de um fixo, já que este
template não é dono de um nome de schema fixo como um app específico seria.

Revision ID: 0000_create_schema
Revises:
Create Date: 2026-07-30

"""

from alembic import op
from app.config import settings

# identificadores de revisão, usados pelo Alembic.
revision = "0000_create_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(f'CREATE SCHEMA IF NOT EXISTS "{settings.DATABASE_SCHEMA}"')


def downgrade() -> None:
    # Não faz DROP SCHEMA: outras migrações deste mesmo app já criaram
    # tabelas dentro dele por essa altura, e a Postgres é compartilhada com
    # outros apps — um downgrade nunca deveria arriscar levar o schema
    # inteiro, só reverter o que as migrações posteriores adicionaram.
    pass
