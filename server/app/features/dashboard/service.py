import asyncio
import logging
import re
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import TypeVar

from app.config import settings
from app.db.catalog_db import query
from app.features.catalog.cache import ttl_cache
from app.features.catalog.dialect import get_dialect
from app.features.catalog.inference import infer_completude, round_half_up
from app.features.catalog.reference import CAMADA_LEGADO
from app.features.catalog.service import get_completude, list_columns, list_tables
from app.features.dashboard.schemas import (
    SaudeDashboardOut,
    SaudeLegadoOut,
    SchemaSaudeOut,
    SummaryOut,
)
from app.features.schemas.service import list_schemas

logger = logging.getLogger(__name__)

_METRICA = "completude_dados"
_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_]+$")

T = TypeVar("T")
R = TypeVar("R")


@dataclass
class _ResultadoTabela:
    schema_name: str
    table: str
    percentual: int


async def _map_with_concurrency(
    items: Iterable[T], limit: int, fn: Callable[[T], Awaitable[R]]
) -> list[R]:
    semaphore = asyncio.Semaphore(limit)

    async def run(item: T) -> R:
        async with semaphore:
            return await fn(item)

    return list(await asyncio.gather(*(run(item) for item in items)))


def _media(percentuais: list[int]) -> int:
    return round_half_up(sum(percentuais) / len(percentuais))


def _agrupar_por_schema(resultados: list[_ResultadoTabela]) -> list[SchemaSaudeOut]:
    grupos: dict[str, list[int]] = {}
    for r in resultados:
        grupos.setdefault(r.schema_name, []).append(r.percentual)
    return [
        SchemaSaudeOut(
            schema_name=schema_name,
            percentual=_media(percentuais),
            classificacao=infer_completude(_media(percentuais)),
            total_tabelas=len(percentuais),
        )
        for schema_name, percentuais in sorted(grupos.items())
    ]


async def get_summary() -> SummaryOut:
    schemas = await list_schemas()
    por_camada: dict[str, int] = {}
    for s in schemas:
        por_camada[s.camada] = (
            por_camada.get(s.camada, 0) + s.table_count + s.view_count
        )
    return SummaryOut(
        total_schemas=len(schemas),
        total_tables=sum(s.table_count for s in schemas),
        total_views=sum(s.view_count for s in schemas),
        por_camada=por_camada,
    )


@ttl_cache("CATALOG_HEALTH_CACHE_TTL_SECONDS")
async def get_saude_governanca() -> SaudeDashboardOut:
    """Saúde só dos schemas governados (STG_/CUR_/RPT_): "saúde da governança"
    só faz sentido sobre o que de fato passou pelo processo de governança —
    tabelas legadas nunca seguiram essas convenções."""
    schemas = await list_schemas()
    governados = [s for s in schemas if s.camada != CAMADA_LEGADO]

    tabelas_por_schema = await _map_with_concurrency(
        governados,
        settings.HEALTH_CONCURRENCY,
        lambda s: _tabelas_do_schema(s.schema_name),
    )
    todas = [t for grupo in tabelas_por_schema for t in grupo]

    if not todas:
        return SaudeDashboardOut(
            percentual=100,
            classificacao=infer_completude(100),
            total_tabelas_avaliadas=0,
            por_schema=[],
        )

    async def avaliar(par: tuple[str, str]) -> _ResultadoTabela | None:
        # Uma tabela sem permissão de leitura (ou que falha) não pode derrubar
        # o painel inteiro — é descartada, como na amostra do legado.
        schema_name, table = par
        try:
            columns = await list_columns(schema_name, table)
            completude = await get_completude(schema_name, table, columns)
        except Exception as exc:
            logger.warning(
                "Tabela %s.%s fora da saúde da governança: %s",
                schema_name,
                table,
                str(exc).splitlines()[0][:200],
            )
            return None
        return _ResultadoTabela(schema_name, table, completude.saude.percentual)

    avaliadas = await _map_with_concurrency(todas, settings.HEALTH_CONCURRENCY, avaliar)
    resultados = [r for r in avaliadas if r is not None]
    if not resultados:
        return SaudeDashboardOut(
            percentual=100,
            classificacao=infer_completude(100),
            total_tabelas_avaliadas=0,
            por_schema=[],
        )
    media = _media([r.percentual for r in resultados])
    return SaudeDashboardOut(
        percentual=media,
        classificacao=infer_completude(media),
        total_tabelas_avaliadas=len(resultados),
        metrica=_METRICA,
        por_schema=_agrupar_por_schema(resultados),
    )


async def _tabelas_do_schema(schema_name: str) -> list[tuple[str, str]]:
    return [(schema_name, t.name) for t in await list_tables(schema_name)]


@ttl_cache("CATALOG_HEALTH_CACHE_TTL_SECONDS")
async def _listar_candidatas_menores_tabelas(schema_name: str) -> list[str]:
    """Candidatas às MENORES tabelas (CARD/reltuples) primeiro — permite
    amostrar tabelas pequenas/rápidas em vez de arriscar uma de milhões de
    linhas. CARD < 0 = sem estatística coletada, tratado como grande (vai
    para o fim). Só TYPE='T': views legadas costumam ser objetos de
    monitoração/BI sem permissão de SELECT e não representam dado de
    negócio. Busca um POOL (não só o tamanho da amostra) porque algumas
    candidatas falham por permissão."""
    if not _IDENTIFIER_RE.match(schema_name):
        raise ValueError(f"Schema inválido: {schema_name}")
    sql = get_dialect().candidatas_sql(settings.LEGACY_CANDIDATE_POOL)
    rows = await query(sql, [schema_name])
    return [row["TABNAME"].strip() for row in rows]


async def _amostrar_schema_legado(schema_name: str) -> list[_ResultadoTabela]:
    """Tenta as candidatas em ordem até completar a amostra ou esgotar o
    pool. A que falha (permissão negada, timeout…) é descartada e a próxima é
    tentada — o schema só fica sem amostra se TODAS falharem."""
    timeout = settings.LEGACY_QUERY_TIMEOUT_SECONDS
    candidatas = await _listar_candidatas_menores_tabelas(schema_name)
    amostra: list[_ResultadoTabela] = []
    for table in candidatas:
        if len(amostra) >= settings.LEGACY_SAMPLE_SIZE:
            break
        try:
            columns = await asyncio.wait_for(list_columns(schema_name, table), timeout)
            completude = await asyncio.wait_for(
                get_completude(schema_name, table, columns), timeout
            )
            amostra.append(
                _ResultadoTabela(schema_name, table, completude.saude.percentual)
            )
        except Exception:
            logger.debug(
                "Candidata %s.%s descartada da amostra do legado",
                schema_name,
                table,
                exc_info=True,
            )
    return amostra


@ttl_cache("CATALOG_HEALTH_CACHE_TTL_SECONDS")
async def get_saude_legado() -> SaudeLegadoOut:
    """Mesma métrica dos schemas governados (% real de preenchimento), mas
    sobre uma amostra das menores tabelas de cada schema legado: escanear
    todas as tabelas dos ~3000 objetos legados é inviável (uma só de 8,5M de
    linhas levou ~13 s). O timeout por consulta é a rede de segurança."""
    schemas = await list_schemas()
    legados = [s for s in schemas if s.camada == CAMADA_LEGADO]

    amostras = await _map_with_concurrency(
        legados,
        settings.LEGACY_HEALTH_CONCURRENCY,
        lambda s: _amostrar_schema_legado(s.schema_name),
    )
    resultados = [r for amostra in amostras for r in amostra]

    com_amostra = {r.schema_name for r in resultados}
    sem_acesso = sorted(
        s.schema_name for s in legados if s.schema_name not in com_amostra
    )

    if not resultados:
        return SaudeLegadoOut(
            percentual=100,
            classificacao=infer_completude(100),
            total_tabelas_avaliadas=0,
            metrica=_METRICA,
            amostra_por_schema=settings.LEGACY_SAMPLE_SIZE,
            por_schema=[],
            schemas_sem_acesso=sem_acesso,
        )

    media = _media([r.percentual for r in resultados])
    return SaudeLegadoOut(
        percentual=media,
        classificacao=infer_completude(media),
        total_tabelas_avaliadas=len(resultados),
        metrica=_METRICA,
        amostra_por_schema=settings.LEGACY_SAMPLE_SIZE,
        por_schema=_agrupar_por_schema(resultados),
        schemas_sem_acesso=sem_acesso,
    )
