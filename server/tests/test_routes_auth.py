"""Toda rota de negócio exige sessão: o par 401-sem-sessão / 200-com-sessão
(`Depends(get_current_user)` não é automático — esquecer de pôr numa rota a
deixaria pública). Os serviços são mocados: aqui só interessa o contrato HTTP
e a proteção."""

from __future__ import annotations

from contextlib import nullcontext
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.features.catalog.schemas import (
    ColumnSearchOut,
    SaudeOut,
    TableDetailOut,
    TableOut,
    TableSaudeOut,
)
from app.features.dashboard.schemas import SaudeDashboardOut, SaudeLegadoOut, SummaryOut
from app.features.domains.schemas import DomainOut
from app.features.schemas.schemas import DominioOut, SchemaOut
from tests.helpers import anonymous_client, authenticated_client

SAUDE = SaudeOut(percentual=100, classificacao="Excelente")
SCHEMA_COM = SchemaOut(
    schema_name="CUR_COM",
    table_count=1,
    view_count=0,
    camada="CUR",
    dominio=DominioOut(code="COM", name="Comercial"),
)
SCHEMA_REF = SCHEMA_COM.model_copy(update={"schema_name": "CUR_REF"})

# (caminho, serviço mocado ou None se a rota não faz I/O, valor devolvido)
ROTAS = [
    ("/api/schemas", "app.features.schemas.service.list_schemas", [SCHEMA_COM]),
    ("/api/catalog/schemas", "app.features.schemas.service.list_schemas", [SCHEMA_COM]),
    (
        "/api/catalog/schemas/CUR_COM/tables",
        "app.features.catalog.service.list_tables",
        [
            TableOut(
                name="IMPORTADOR",
                type="Tabela",
                description=None,
                classification="Restrito",
            )
        ],
    ),
    (
        "/api/catalog/schemas/CUR_REF/tables/PAIS/saude",
        "app.features.catalog.service.get_table_saude",
        TableSaudeOut(total_registros=252, saude=SAUDE),
    ),
    (
        "/api/catalog/schemas/CUR_REF/tables/PAIS",
        "app.features.catalog.service.get_table_detail",
        TableDetailOut(
            name="PAIS",
            type="Tabela",
            description=None,
            classification="Restrito",
            schema_name="CUR_REF",
            total_registros=252,
            saude=SAUDE,
            columns=[],
        ),
    ),
    (
        "/api/catalog/columns/search?q=CNPJ",
        "app.features.catalog.service.search_columns",
        [
            ColumnSearchOut(
                schema_name="CUR_COM",
                table="IMPORTADOR",
                column="NR_CNPJ",
                type="VARCHAR",
                description=None,
            )
        ],
    ),
    (
        "/api/dashboard/summary",
        "app.features.dashboard.service.get_summary",
        SummaryOut(
            total_schemas=1, total_tables=1, total_views=0, por_camada={"CUR": 1}
        ),
    ),
    (
        "/api/dashboard/saude",
        "app.features.dashboard.service.get_saude_governanca",
        SaudeDashboardOut(
            percentual=100,
            classificacao="Excelente",
            total_tabelas_avaliadas=0,
            por_schema=[],
        ),
    ),
    (
        "/api/dashboard/saude-legado",
        "app.features.dashboard.service.get_saude_legado",
        SaudeLegadoOut(
            percentual=100,
            classificacao="Excelente",
            total_tabelas_avaliadas=0,
            por_schema=[],
            amostra_por_schema=5,
            schemas_sem_acesso=[],
        ),
    ),
    (
        "/api/domains",
        "app.features.domains.service.list_domains_with_usage",
        [DomainOut(code="COM", name="Comercial", schema_count=2, object_count=4)],
    ),
    # Regras em memória (sem I/O): nada a mocar.
    ("/api/nomenclatura", None, None),
]


@pytest.mark.parametrize("caminho", [r[0] for r in ROTAS])
async def test_sem_sessao_retorna_401(caminho):
    async with anonymous_client() as client:
        r = await client.get(caminho)
    assert r.status_code == 401


@pytest.mark.parametrize(("caminho", "alvo", "retorno"), ROTAS)
async def test_com_sessao_retorna_200(caminho, alvo, retorno):
    mock = patch(alvo, AsyncMock(return_value=retorno)) if alvo else nullcontext()
    with mock:
        async with authenticated_client() as client:
            r = await client.get(caminho)
    assert r.status_code == 200


async def test_filtro_de_schemas_no_catalogo():
    with patch(
        "app.features.schemas.service.list_schemas",
        AsyncMock(return_value=[SCHEMA_COM, SCHEMA_REF]),
    ):
        async with authenticated_client() as client:
            r = await client.get("/api/catalog/schemas?filter=cur_com")
    assert [s["schema_name"] for s in r.json()] == ["CUR_COM"]


async def test_busca_repassa_termo_e_filtro_normalizado():
    fake = AsyncMock(return_value=[])
    with patch("app.features.catalog.service.search_columns", fake):
        async with authenticated_client() as client:
            r = await client.get(
                "/api/catalog/columns/search?q=cnpj&filter=cur_com, cur_ref"
            )
    assert r.status_code == 200
    fake.assert_awaited_once_with("cnpj", ["CUR_COM", "CUR_REF"])


async def test_busca_sem_termo_devolve_lista_vazia():
    async with authenticated_client() as client:
        r = await client.get("/api/catalog/columns/search")
    assert r.status_code == 200
    assert r.json() == []


async def test_path_params_chegam_em_maiusculas_ao_servico():
    fake = AsyncMock(return_value=TableSaudeOut(total_registros=1, saude=SAUDE))
    with patch("app.features.catalog.service.get_table_saude", fake):
        async with authenticated_client() as client:
            await client.get("/api/catalog/schemas/cur_ref/tables/pais/saude")
    fake.assert_awaited_once_with("CUR_REF", "PAIS")


async def test_tabela_inexistente_e_404_com_detail():
    erro = HTTPException(status_code=404, detail="Tabela CUR_REF.X não encontrada")
    with patch(
        "app.features.catalog.service.get_table_detail", AsyncMock(side_effect=erro)
    ):
        async with authenticated_client() as client:
            r = await client.get("/api/catalog/schemas/CUR_REF/tables/X")
    assert r.status_code == 404
    assert r.json() == {"detail": "Tabela CUR_REF.X não encontrada"}
