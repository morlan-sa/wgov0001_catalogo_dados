"""Serviço do catálogo contra um `query` falso — mesmos cenários dos testes de
repositório do app Node original, só que offline e determinísticos."""

from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.features.catalog import service
from app.features.catalog.schemas import ColumnOut

_TABLES = [
    {
        "TABNAME": "IMPORTADOR  ",
        "TYPE": "T ",
        "REMARKS": "Importador - dado sensível. Classificacao: RESTRITO",
    },
    {"TABNAME": "V_IMP", "TYPE": "V", "REMARKS": None},
]


def _col(name: str, type_: str = "BIGINT") -> ColumnOut:
    return ColumnOut(
        name=name,
        type=type_,
        length=8,
        scale=0,
        nullable=True,
        order=1,
        description=None,
        is_primary_key=False,
        domain="x",
    )


def _db2(**por_trecho_de_sql):
    """`query` falso: devolve a primeira resposta cujo trecho aparece no SQL."""

    async def fake(sql, params=()):
        for trecho, resposta in por_trecho_de_sql.items():
            if trecho in sql:
                return resposta
        raise AssertionError(f"SQL inesperado: {sql}")

    return patch.object(service, "query", side_effect=fake)


class TestListTables:
    async def test_classifica_pelo_remarks_e_distingue_tabela_de_view(self):
        with _db2(**{"SYSCAT.TABLES": _TABLES}):
            tables = await service.list_tables("CUR_COM")

        assert [t.name for t in tables] == ["IMPORTADOR", "V_IMP"]
        assert tables[0].type == "Tabela"
        assert tables[0].classification == "Restrito"
        assert tables[0].description and "sensível" in tables[0].description
        assert tables[1].type == "View"
        assert tables[1].classification == "Não classificado"
        assert tables[1].description is None

    async def test_schema_sem_tabelas_devolve_lista_vazia(self):
        with _db2(**{"SYSCAT.TABLES": []}):
            assert await service.list_tables("NAO_EXISTE") == []


class TestListColumns:
    async def test_marca_chave_primaria_e_infere_dominio(self):
        colunas = [
            {
                "COLNAME": "ID_PAIS ",
                "TYPENAME": "BIGINT",
                "LENGTH": 8,
                "SCALE": 0,
                "NULLS": "N",
                "COLNO": 0,
                "REMARKS": "Chave",
            },
            {
                "COLNAME": "CD_PAIS",
                "TYPENAME": "VARCHAR",
                "LENGTH": 3,
                "SCALE": 0,
                "NULLS": "Y",
                "COLNO": 1,
                "REMARKS": None,
            },
        ]
        with _db2(
            **{"SYSCAT.COLUMNS": colunas, "SYSCAT.TABCONST": [{"COLNAME": "ID_PAIS"}]}
        ):
            result = await service.list_columns("CUR_REF", "PAIS")

        id_pais, cd_pais = result
        assert id_pais.is_primary_key and not id_pais.nullable
        assert id_pais.domain == "Identificador"
        assert id_pais.description == "Chave"
        assert not cd_pais.is_primary_key and cd_pais.nullable
        assert cd_pais.domain == "Código"
        assert [c.order for c in result] == [0, 1]

    async def test_tabela_inexistente_devolve_lista_vazia(self):
        with _db2(**{"SYSCAT.COLUMNS": [], "SYSCAT.TABCONST": []}):
            assert await service.list_columns("CUR_REF", "NAO_EXISTE") == []


class TestCompletude:
    async def test_percentual_real_e_exclui_colunas_de_auditoria(self):
        columns = [
            _col("ID_PAIS"),
            _col("CD_PAIS_ISO", "VARCHAR"),
            _col("DT_ATU_DADOS", "TIMESTAMP"),
            _col("NM_ORIGEM_GRAVACAO", "VARCHAR"),
        ]
        row = {"TOTAL_REGISTROS": 252, "ID_PAIS": 252, "CD_PAIS_ISO": 248}
        fake = AsyncMock(return_value=[row])
        with patch.object(service, "query", fake):
            result = await service.get_completude("CUR_REF", "PAIS", columns)

        assert result.total_registros == 252
        assert result.por_coluna["ID_PAIS"].percentual == 100
        assert result.por_coluna["ID_PAIS"].classificacao == "Excelente"
        assert result.por_coluna["CD_PAIS_ISO"].percentual == round(248 / 252 * 100)
        assert "DT_ATU_DADOS" not in result.por_coluna
        assert "NM_ORIGEM_GRAVACAO" not in result.por_coluna
        # saúde = média das colunas relevantes: (100 + 98) / 2 = 99
        assert result.saude.percentual == 99
        assert result.saude.classificacao == "Excelente"

        sql = fake.await_args_list[0].args[0]
        assert 'COUNT(NULLIF(TRIM("CD_PAIS_ISO"), \'\')) AS "CD_PAIS_ISO"' in sql
        assert 'COUNT("ID_PAIS") AS "ID_PAIS"' in sql
        assert "DT_ATU_DADOS" not in sql
        assert sql.endswith('FROM "CUR_REF"."PAIS"')

    async def test_tabela_vazia_conta_como_100_por_cento(self):
        row = {"TOTAL_REGISTROS": 0, "ID_PAIS": 0}
        with patch.object(service, "query", AsyncMock(return_value=[row])):
            result = await service.get_completude("CUR_REF", "VAZIA", [_col("ID_PAIS")])
        assert result.por_coluna["ID_PAIS"].percentual == 100

    @pytest.mark.parametrize(
        ("schema", "table"),
        [("CUR_REF; DROP TABLE X", "PAIS"), ("CUR_REF", "PAIS'; DROP TABLE X; --")],
    )
    async def test_rejeita_identificador_fora_do_padrao(self, schema, table):
        fake = AsyncMock()
        with patch.object(service, "query", fake):
            with pytest.raises(ValueError):
                await service.get_completude(schema, table, [_col("ID_PAIS")])
        fake.assert_not_called()

    async def test_rejeita_nome_de_coluna_fora_do_padrao(self):
        with patch.object(service, "query", AsyncMock()):
            with pytest.raises(ValueError, match="Nome de coluna inválido"):
                await service.get_completude("CUR_REF", "PAIS", [_col('X"; DROP')])

    async def test_sem_colunas_devolve_vazio_sem_consultar(self):
        fake = AsyncMock()
        with patch.object(service, "query", fake):
            result = await service.get_completude("CUR_REF", "PAIS", [])
        assert result.total_registros == 0
        assert result.por_coluna == {}
        assert (result.saude.percentual, result.saude.classificacao) == (
            100,
            "Excelente",
        )
        fake.assert_not_called()


class TestDetalheESaude:
    async def test_detalhe_junta_tabela_colunas_e_completude(self):
        columns = [_col("ID_PAIS"), _col("DT_ATU_DADOS", "TIMESTAMP")]
        completude = service.Completude(
            total_registros=252,
            por_coluna={
                "ID_PAIS": service.SaudeOut(percentual=100, classificacao="Excelente")
            },
            saude=service.SaudeOut(percentual=100, classificacao="Excelente"),
        )
        with (
            patch.object(
                service, "list_tables", AsyncMock(return_value=[_table("PAIS")])
            ),
            patch.object(service, "list_columns", AsyncMock(return_value=columns)),
            patch.object(service, "get_completude", AsyncMock(return_value=completude)),
        ):
            detail = await service.get_table_detail("CUR_REF", "PAIS")

        assert detail.schema_name == "CUR_REF"
        assert detail.total_registros == 252
        by_name = {c.name: c for c in detail.columns}
        assert by_name["ID_PAIS"].completude is not None
        assert by_name["ID_PAIS"].completude.percentual == 100
        # coluna de auditoria: sem completude calculada
        assert by_name["DT_ATU_DADOS"].completude is None

    async def test_detalhe_de_tabela_inexistente_e_404(self):
        with patch.object(
            service, "list_tables", AsyncMock(return_value=[_table("PAIS")])
        ):
            with pytest.raises(HTTPException) as exc:
                await service.get_table_detail("CUR_REF", "NAO_EXISTE_XYZ")
        assert exc.value.status_code == 404

    async def test_identificador_invalido_e_400_antes_de_consultar(self):
        fake = AsyncMock()
        with patch.object(service, "query", fake):
            with pytest.raises(HTTPException) as exc:
                await service.get_table_detail("CUR REF", "PAIS")
        assert exc.value.status_code == 400
        fake.assert_not_called()


class TestBuscaDeColunas:
    async def test_termo_vazio_devolve_lista_vazia_sem_consultar(self):
        fake = AsyncMock()
        with patch.object(service, "query", fake):
            assert await service.search_columns("", None) == []
            assert await service.search_columns("   ", None) == []
        fake.assert_not_called()

    async def test_busca_parcial_em_maiusculas_e_respeita_o_filtro_de_schemas(self):
        rows = [
            {
                "TABSCHEMA": "CUR_COM ",
                "TABNAME": "IMPORTADOR",
                "COLNAME": "NR_CNPJ",
                "TYPENAME": "VARCHAR",
                "REMARKS": None,
            }
        ]
        fake = AsyncMock(return_value=rows)
        with patch.object(service, "query", fake):
            result = await service.search_columns(" cnpj ", ["CUR_COM", "CUR_REF"])

        assert result[0].schema_name == "CUR_COM"
        assert (result[0].table, result[0].column) == ("IMPORTADOR", "NR_CNPJ")
        sql, params = fake.await_args_list[0].args
        assert params == ["%CNPJ%", "CUR_COM", "CUR_REF"]
        assert "T.TABSCHEMA IN (?,?)" in sql
        assert "FETCH FIRST 200 ROWS ONLY" in sql


def _table(name: str):
    from app.features.catalog.schemas import TableOut

    return TableOut(
        name=name, type="Tabela", description=None, classification="Restrito"
    )
