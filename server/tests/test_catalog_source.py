"""Fonte do catálogo configurável (db2 | postgres): despacho do `query`,
somente leitura, dialetos e validação da config. Nenhum banco é contatado."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest

from app.config import Settings, settings
from app.db import catalog_db
from app.features.catalog import dialect, service
from app.features.catalog.schemas import ColumnOut


@pytest.fixture
def fonte_postgres():
    with patch.object(settings, "CATALOG_SOURCE", "postgres"):
        yield


class TestQuery:
    async def test_rejeita_escrita_sem_abrir_conexao(self, fonte_postgres):
        with patch.object(catalog_db, "_query_postgres") as pg:
            with pytest.raises(catalog_db.CatalogReadOnlyError):
                await catalog_db.query("DELETE FROM cur_gov.x")
        pg.assert_not_called()

    async def test_postgres_usa_o_engine_do_app(self, fonte_postgres):
        with patch.object(
            catalog_db, "_query_postgres", AsyncMock(return_value=[{"A": 1}])
        ) as pg:
            assert await catalog_db.query("SELECT 1 WHERE ? = ?", ["a", "b"]) == [
                {"A": 1}
            ]
        pg.assert_awaited_once_with("SELECT 1 WHERE ? = ?", ["a", "b"])

    async def test_db2_continua_indo_para_o_driver_db2(self):
        from app.db import db2

        with patch.object(db2, "query", AsyncMock(return_value=[{"B": 2}])) as q:
            assert await catalog_db.query("SELECT 1") == [{"B": 2}]
        q.assert_awaited_once()

    def test_converte_interrogacao_em_parametro_nomeado(self):
        sql, bind = catalog_db._to_named_params(
            "SELECT 1 WHERE a = ? AND b LIKE ?", ["x", "%y%"]
        )
        assert sql == "SELECT 1 WHERE a = :p0 AND b LIKE :p1"
        assert bind == {"p0": "x", "p1": "%y%"}

    def test_recusa_quantidade_de_parametros_diferente(self):
        with pytest.raises(ValueError, match="Quantidade de parâmetros"):
            catalog_db._to_named_params("SELECT ?", [])


class TestDialeto:
    def test_get_dialect_segue_a_configuracao(self, fonte_postgres):
        assert dialect.get_dialect() is dialect.POSTGRES

    def test_get_dialect_padrao_e_db2(self):
        assert dialect.get_dialect() is dialect.DB2

    def test_db2_normaliza_para_maiusculo_e_postgres_preserva(self):
        assert dialect.DB2.normalize("cur_com") == "CUR_COM"
        assert dialect.POSTGRES.normalize("cur_com") == "cur_com"

    def test_busca_de_colunas_tem_um_placeholder_por_schema_filtrado(self):
        for d in (dialect.DB2, dialect.POSTGRES):
            assert d.busca_colunas_sql(3, 200).count("?") == 1 + 3
            assert d.busca_colunas_sql(0, 200).count("?") == 1

    def test_sql_postgres_nomeia_as_colunas_fixas_em_maiusculas(self):
        for sql in (
            dialect.POSTGRES.schemas_sql,
            dialect.POSTGRES.tables_sql,
            dialect.POSTGRES.columns_sql,
            dialect.POSTGRES.pk_sql,
        ):
            assert "SYSCAT" not in sql
        assert '"TABSCHEMA"' in dialect.POSTGRES.schemas_sql
        assert '"COLNO"' in dialect.POSTGRES.columns_sql


class TestServicoComPostgres:
    async def test_completude_usa_identificadores_na_caixa_original(
        self, fonte_postgres
    ):
        colunas = [
            ColumnOut(
                name=nome,
                type=tipo,
                length=0,
                scale=0,
                nullable=True,
                order=0,
                description=None,
                is_primary_key=False,
                domain="x",
            )
            for nome, tipo in [("id_x", "bigint"), ("nm_x", "character varying")]
        ]
        capturado: list[str] = []

        async def fake(sql, params=()):
            capturado.append(sql)
            return [{"TOTAL_REGISTROS": 10, "id_x": 10, "nm_x": 5}]

        with patch.object(service, "query", side_effect=fake):
            r = await service.get_completude("cur_crm", "rd_x", colunas)

        assert 'FROM "cur_crm"."rd_x"' in capturado[0]
        assert 'COUNT("id_x") AS "id_x"' in capturado[0]
        assert 'CAST("nm_x" AS TEXT)' in capturado[0]
        assert r.por_coluna["nm_x"].percentual == 50


class TestConfig:
    def _settings(self, **env):
        base = dict(
            DATABASE_URL="postgresql+asyncpg://t:t@h/d",
            DATABASE_SCHEMA="s",
            APP_NAME="t",
            FRONTEND_URL="http://x",
            KEYCLOAK_ISSUER="http://k",
            KEYCLOAK_CLIENT_ID="c",
            KEYCLOAK_CLIENT_SECRET="s",
            OIDC_REDIRECT_URI="http://x",
            SESSION_SECRET="x" * 40,
            DEBUG=True,
        )
        sem_db2 = dict(
            DB2_HOST="", DB2_PORT=0, DB2_DATABASE="", DB2_USER="", DB2_PASSWORD=""
        )
        return Settings(
            _env_file=None,  # pyright: ignore[reportCallIssue]
            **{**base, **sem_db2, **env},
        )

    def test_postgres_dispensa_as_credenciais_db2(self):
        s = self._settings(CATALOG_SOURCE="postgres")
        assert s.DB2_HOST == ""

    def test_db2_exige_as_credenciais_db2(self):
        with pytest.raises(ValueError, match="DB2_HOST"):
            self._settings(CATALOG_SOURCE="db2")

    def test_fonte_invalida_e_recusada(self):
        with pytest.raises(ValueError):
            self._settings(CATALOG_SOURCE="oracle")

    def test_app_name_maior_que_a_coluna_do_log_e_recusado(self):
        with pytest.raises(ValueError, match="APP_NAME"):
            self._settings(CATALOG_SOURCE="postgres", APP_NAME="x" * 21)
