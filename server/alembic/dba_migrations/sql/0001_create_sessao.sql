-- Gerado por scripts/generate_dba_sql.py — NÃO EDITE À MÃO.
-- Alembic revision: 0001_create_sessao
-- Regenerar: veja alembic/dba_migrations/README.md

CREATE TABLE IF NOT EXISTS cur_iam.sessao (
    id_sessao VARCHAR(64) NOT NULL,
    cd_usuario VARCHAR(64) NOT NULL,
    nm_usuario VARCHAR(128),
    eml_usuario VARCHAR(128),
    ds_roles TEXT,
    ds_groups TEXT,
    ds_access_token TEXT,
    ds_refresh_token TEXT,
    id_token TEXT,
    dt_criado_em TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    dt_expira_em TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    CONSTRAINT sessao_pkey PRIMARY KEY (id_sessao)
);

UPDATE cur_gov.alembic_version_wgov0001_catalogo_dados SET version_num='0001_create_sessao' WHERE cur_gov.alembic_version_wgov0001_catalogo_dados.version_num = '0000_create_schema';
