"""Dashboard (resumo e saúde) e domínios, com `list_schemas`/catálogo falsos."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

from app.features.catalog.schemas import ColumnOut, SaudeOut, TableOut
from app.features.catalog.service import Completude
from app.features.dashboard import service as dashboard
from app.features.domains import service as domains
from app.features.schemas.schemas import DominioOut, SchemaOut


def _schema(nome: str, tabelas: int, views: int, camada: str, code: str, dominio: str):
    return SchemaOut(
        schema_name=nome,
        table_count=tabelas,
        view_count=views,
        camada=camada,
        dominio=DominioOut(code=code, name=dominio),
    )


SCHEMAS = [
    _schema("CUR_COM", 1, 0, "CUR", "COM", "Comercial"),
    _schema("RPT_COM", 2, 1, "RPT", "COM", "Comercial"),
    _schema("STG_ERP", 4, 0, "STG", "NC", "Não classificado"),
    _schema("COMPRAS", 428, 10, "LEGADO", "NC", "Não classificado"),
    _schema("BI", 3, 0, "LEGADO", "NC", "Não classificado"),
]


def _coluna(nome: str) -> ColumnOut:
    return ColumnOut(
        name=nome,
        type="BIGINT",
        length=8,
        scale=0,
        nullable=False,
        order=0,
        description=None,
        is_primary_key=False,
        domain="Identificador",
    )


def _completude(percentual: int) -> Completude:
    saude = SaudeOut(percentual=percentual, classificacao="x")
    return Completude(total_registros=10, por_coluna={}, saude=saude)


class TestSummary:
    async def test_contadores_e_tabelas_por_camada(self):
        with patch.object(dashboard, "list_schemas", AsyncMock(return_value=SCHEMAS)):
            summary = await dashboard.get_summary()

        assert summary.total_schemas == 5
        assert summary.total_tables == 438
        assert summary.total_views == 11
        assert summary.por_camada == {"CUR": 1, "RPT": 3, "STG": 4, "LEGADO": 441}


class TestSaudeGovernanca:
    async def test_media_so_dos_schemas_governados_ordenada_por_schema(self):
        percentual_por_tabela = {"IMPORTADOR": 100, "PEDIDO": 80, "ITEM": 60, "NCM": 50}
        tabelas_por_schema = {
            "CUR_COM": ["IMPORTADOR"],
            "RPT_COM": ["PEDIDO", "ITEM"],
            "STG_ERP": ["NCM"],
        }

        async def list_tables(schema_name):
            return [
                TableOut(name=n, type="Tabela", description=None, classification="x")
                for n in tabelas_por_schema[schema_name]
            ]

        async def get_completude(schema_name, table, columns):
            return _completude(percentual_por_tabela[table])

        with (
            patch.object(dashboard, "list_schemas", AsyncMock(return_value=SCHEMAS)),
            patch.object(dashboard, "list_tables", list_tables),
            patch.object(
                dashboard, "list_columns", AsyncMock(return_value=[_coluna("ID")])
            ),
            patch.object(dashboard, "get_completude", get_completude),
        ):
            saude = await dashboard.get_saude_governanca()

        assert saude.total_tabelas_avaliadas == 4
        assert saude.percentual == 73  # (100 + 80 + 60 + 50) / 4 = 72,5 → 73
        assert saude.classificacao == "Bom"
        assert [s.schema_name for s in saude.por_schema] == [
            "CUR_COM",
            "RPT_COM",
            "STG_ERP",
        ]
        rpt = saude.por_schema[1]
        assert (rpt.total_tabelas, rpt.percentual) == (2, 70)
        assert "COMPRAS" not in [s.schema_name for s in saude.por_schema]
        assert (
            sum(s.total_tabelas for s in saude.por_schema)
            == saude.total_tabelas_avaliadas
        )

    async def test_tabela_sem_permissao_e_descartada_sem_derrubar_o_painel(self):
        async def list_tables(schema_name):
            return [
                TableOut(name=n, type="Tabela", description=None, classification="x")
                for n in ("OK", "SEM_ACESSO")
            ]

        async def get_completude(schema_name, table, columns):
            if table == "SEM_ACESSO":
                raise PermissionError("permission denied for table")
            return _completude(80)

        governados = [s for s in SCHEMAS if s.schema_name == "CUR_COM"]
        with (
            patch.object(dashboard, "list_schemas", AsyncMock(return_value=governados)),
            patch.object(dashboard, "list_tables", list_tables),
            patch.object(
                dashboard, "list_columns", AsyncMock(return_value=[_coluna("ID")])
            ),
            patch.object(dashboard, "get_completude", get_completude),
        ):
            saude = await dashboard.get_saude_governanca()

        assert (saude.percentual, saude.total_tabelas_avaliadas) == (80, 1)

    async def test_sem_schemas_governados_devolve_100_por_cento(self):
        legados = [s for s in SCHEMAS if s.camada == "LEGADO"]
        with patch.object(dashboard, "list_schemas", AsyncMock(return_value=legados)):
            saude = await dashboard.get_saude_governanca()
        assert (saude.percentual, saude.total_tabelas_avaliadas, saude.por_schema) == (
            100,
            0,
            [],
        )


class TestSaudeLegado:
    async def test_amostra_menores_tabelas_e_reporta_schemas_sem_acesso(self):
        async def candidatas(schema_name):
            return {"COMPRAS": ["A", "B", "C", "D", "E", "F", "G"], "BI": ["X"]}[
                schema_name
            ]

        async def get_completude(schema_name, table, columns):
            if schema_name == "BI":
                raise PermissionError("SQL0551N sem privilégio SELECT")
            return _completude({"A": 100, "B": 90, "C": 80}.get(table, 70))

        with (
            patch.object(dashboard, "list_schemas", AsyncMock(return_value=SCHEMAS)),
            patch.object(dashboard, "_listar_candidatas_menores_tabelas", candidatas),
            patch.object(
                dashboard, "list_columns", AsyncMock(return_value=[_coluna("ID")])
            ),
            patch.object(dashboard, "get_completude", get_completude),
        ):
            saude = await dashboard.get_saude_legado()

        assert saude.metrica == "completude_dados"
        assert saude.amostra_por_schema == 5
        compras = saude.por_schema[0]
        assert compras.schema_name == "COMPRAS"
        assert compras.total_tabelas == 5  # para ao completar a amostra de 5
        assert compras.percentual == 82  # (100 + 90 + 80 + 70 + 70) / 5
        assert saude.schemas_sem_acesso == ["BI"]
        assert saude.total_tabelas_avaliadas == 5
        assert "CUR_COM" not in [s.schema_name for s in saude.por_schema]

    async def test_candidata_que_falha_e_descartada_e_a_proxima_e_tentada(self):
        async def get_completude(schema_name, table, columns):
            if table == "A":
                raise PermissionError("sem acesso")
            return _completude(100)

        with (
            patch.object(
                dashboard,
                "_listar_candidatas_menores_tabelas",
                AsyncMock(return_value=["A", "B"]),
            ),
            patch.object(
                dashboard, "list_columns", AsyncMock(return_value=[_coluna("ID")])
            ),
            patch.object(dashboard, "get_completude", get_completude),
        ):
            amostra = await dashboard._amostrar_schema_legado("COMPRAS")

        assert [(r.table, r.percentual) for r in amostra] == [("B", 100)]


class TestDominios:
    async def test_lista_os_24_dominios_com_uso_real(self):
        with patch.object(domains, "list_schemas", AsyncMock(return_value=SCHEMAS)):
            result = await domains.list_domains_with_usage()

        assert len(result) == 24
        comercial = next(d for d in result if d.code == "COM")
        assert (comercial.name, comercial.schema_count, comercial.object_count) == (
            "Comercial",
            2,
            4,
        )
        financeiro = next(d for d in result if d.code == "FIN")
        assert (financeiro.schema_count, financeiro.object_count) == (0, 0)

    async def test_ordena_alfabeticamente_ignorando_acento(self):
        with patch.object(domains, "list_schemas", AsyncMock(return_value=[])):
            result = await domains.list_domains_with_usage()
        nomes = [d.name for d in result]
        # "Contábil" tem de vir logo antes de "Controladoria", não no fim da lista.
        assert nomes.index("Contábil") < nomes.index("Controladoria")
        assert nomes[0] == "Auditoria"
