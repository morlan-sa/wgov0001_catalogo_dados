-- Gerado por scripts/generate_dba_sql.py — NÃO EDITE À MÃO.
-- Alembic revision: 0000_create_schema
-- Regenerar: veja alembic/dba_migrations/README.md

CREATE SCHEMA IF NOT EXISTS "cur_gov";

CREATE TABLE cur_gov.alembic_version_wgov0001_catalogo_dados (
    version_num VARCHAR(32) NOT NULL,
    CONSTRAINT alembic_version_wgov0001_catalogo_dados_pkc PRIMARY KEY (version_num)
);

INSERT INTO cur_gov.alembic_version_wgov0001_catalogo_dados (version_num) VALUES ('0000_create_schema') RETURNING cur_gov.alembic_version_wgov0001_catalogo_dados.version_num;
