"""create sessao (morlan_access session store)

Cria a tabela `sessao` que `morlan_access` (BFF/OIDC) usa como session store
server-side (session_store="rds", o default da lib — ver BffAuthConfig).
Colunas espelham `morlan_access.models.Sessao` exatamente (notação húngara,
morlan-access-lib>=2.1.0); a lib é dona deste modelo, então mudanças de
schema aqui devem seguir uma atualização de versão da lib, não o contrário.

Ao contrário de toda outra tabela deste projeto, `sessao` não vive em
`Settings.DATABASE_SCHEMA` (o schema deste app) — vive em `Settings.
IAM_SCHEMA` (`cur_iam`), o schema da própria Morlan Access/IAM. Essa escolha
centraliza a sessão SSO sob o domínio que a possui de verdade, em vez de
duplicar uma `sessao` por app espalhada pela Postgres compartilhada.
`cur_iam` é infra pré-existente (criado pelas próprias migrações da Morlan
Access, não por esta) — por isso, ao contrário de `0000_create_schema.py`,
esta migração NÃO faz `CREATE SCHEMA IF NOT EXISTS`: só cria a tabela dentro
de um schema que já deve existir. `app/db/auth_engine.py` compensa a falta
de `schema=` no model da lib via `search_path` na conexão.

Revision ID: 0001_create_sessao
Revises: 0000_create_schema
Create Date: 2026-10-16

"""

import sqlalchemy as sa

from alembic import op
from app.config import settings

# identificadores de revisão, usados pelo Alembic.
revision = "0001_create_sessao"
down_revision = "0000_create_schema"
branch_labels = None
depends_on = None

_SCHEMA = settings.IAM_SCHEMA


def upgrade() -> None:
    op.create_table(
        "sessao",
        sa.Column("id_sessao", sa.String(length=64), nullable=False),
        sa.Column("cd_usuario", sa.String(length=64), nullable=False),
        sa.Column("nm_usuario", sa.String(length=128), nullable=True),
        sa.Column("eml_usuario", sa.String(length=128), nullable=True),
        sa.Column("ds_roles", sa.Text(), nullable=True),
        sa.Column("ds_groups", sa.Text(), nullable=True),
        sa.Column("ds_access_token", sa.Text(), nullable=True),
        sa.Column("ds_refresh_token", sa.Text(), nullable=True),
        sa.Column("id_token", sa.Text(), nullable=True),
        sa.Column("dt_criado_em", sa.DateTime(), nullable=False),
        sa.Column("dt_expira_em", sa.DateTime(), nullable=False),
        # `name="sessao_pkey"` fixado explicitamente (em vez de deixar o
        # `naming_convention` de `Base.metadata` — app/db/engine.py — nomear
        # como faria por padrão, `pk_sessao`): esta tabela é dona de
        # `morlan_access`, não nossa, então fica de fora da convenção de
        # nomes deste app, igual ao próprio rnc2/server exclui sua
        # `sessao` equivalente do catch-up de nomes em
        # `0024_named_pk_constraints.py`. O valor fixado aqui é o mesmo
        # nome implícito que o Postgres já dava antes desta convenção
        # existir — comportamento idêntico, só que explícito agora.
        sa.PrimaryKeyConstraint("id_sessao", name="sessao_pkey"),
        schema=_SCHEMA,
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_table("sessao", schema=_SCHEMA)
