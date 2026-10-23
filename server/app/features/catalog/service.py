import asyncio
import re
from dataclasses import dataclass, field

from fastapi import HTTPException

from app.config import settings
from app.db.catalog_db import CatalogPermissionError, query
from app.features.catalog.cache import ttl_cache
from app.features.catalog.dialect import get_dialect
from app.features.catalog.inference import (
    infer_camada,
    infer_classificacao,
    infer_completude,
    infer_prefix_domain,
    is_audit_column,
    round_half_up,
)
from app.features.catalog.schemas import (
    ColumnOut,
    ColumnSearchOut,
    ConformidadeOut,
    DocumentacaoOut,
    SaudeOut,
    TableDetailOut,
    TableOut,
    TableSaudeOut,
)
from app.features.nomenclatura.conformidade import (
    Avaliacao,
    Resumo,
    avaliar_coluna,
    resumir,
    resumo_nao_aplicavel,
)
from app.features.nomenclatura.schemas import AvaliacaoOut, SugestaoOut

_IDENTIFIER_RE = re.compile(r"^[A-Za-z0-9_]+$")
_TEXT_TYPE_RE = re.compile(r"CHAR|CLOB|GRAPHIC|TEXT", re.IGNORECASE)


@dataclass
class Completude:
    total_registros: int
    por_coluna: dict[str, SaudeOut] = field(default_factory=dict)
    saude: SaudeOut = field(default_factory=lambda: _saude_cheia())


def _saude_cheia() -> SaudeOut:
    return SaudeOut(percentual=100, classificacao=infer_completude(100))


def _strip(value: str | None) -> str | None:
    return value.strip() if value else None


@ttl_cache("CATALOG_CACHE_TTL_SECONDS")
async def list_tables(schema_name: str) -> list[TableOut]:
    rows = await query(get_dialect().tables_sql, [schema_name])
    result: list[TableOut] = []
    for row in rows:
        remarks = _strip(row["REMARKS"])
        result.append(
            TableOut(
                name=row["TABNAME"].strip(),
                type="View" if row["TYPE"].strip() == "V" else "Tabela",
                description=remarks,
                classification=infer_classificacao(remarks),
            )
        )
    return result


@ttl_cache("CATALOG_CACHE_TTL_SECONDS")
async def list_columns(schema_name: str, table: str) -> list[ColumnOut]:
    column_rows, pk_rows = await asyncio.gather(
        query(get_dialect().columns_sql, [schema_name, table]),
        query(get_dialect().pk_sql, [schema_name, table]),
    )
    pk_names = {row["COLNAME"].strip() for row in pk_rows}

    result: list[ColumnOut] = []
    for row in column_rows:
        name = row["COLNAME"].strip()
        result.append(
            ColumnOut(
                name=name,
                type=row["TYPENAME"].strip(),
                length=row["LENGTH"],
                scale=row["SCALE"],
                nullable=row["NULLS"].strip() == "Y",
                order=row["COLNO"],
                description=_strip(row["REMARKS"]),
                is_primary_key=name in pk_names,
                domain=infer_prefix_domain(name),
            )
        )
    return result


def _build_completude_sql(
    schema_name: str, table: str, columns: list[ColumnOut]
) -> str:
    count_exprs: list[str] = []
    for column in columns:
        if not _IDENTIFIER_RE.match(column.name):
            raise ValueError(f"Nome de coluna inválido: {column.name}")
        col = f'"{column.name}"'
        if _TEXT_TYPE_RE.search(column.type):
            count_exprs.append(f"{get_dialect().texto_preenchido(col)} AS {col}")
        else:
            count_exprs.append(f"COUNT({col}) AS {col}")
    select_list = ", ".join(['COUNT(*) AS "TOTAL_REGISTROS"', *count_exprs])
    return f'SELECT {select_list} FROM "{schema_name}"."{table}"'


def _calcular_saude(por_coluna: dict[str, SaudeOut]) -> SaudeOut:
    percentuais = [c.percentual for c in por_coluna.values()]
    if not percentuais:
        return _saude_cheia()
    media = round_half_up(sum(percentuais) / len(percentuais))
    return SaudeOut(percentual=media, classificacao=infer_completude(media))


@ttl_cache(
    "CATALOG_HEALTH_CACHE_TTL_SECONDS",
    key=lambda schema_name, table, columns: (
        schema_name,
        table,
        tuple(c.name for c in columns),
    ),
)
async def get_completude(
    schema_name: str, table: str, columns: list[ColumnOut]
) -> Completude:
    if not _IDENTIFIER_RE.match(schema_name) or not _IDENTIFIER_RE.match(table):
        raise ValueError(f"Schema ou tabela inválidos: {schema_name}.{table}")
    if not columns:
        return Completude(total_registros=0)

    # Colunas de auditoria (NM_ORIGEM_GRAVACAO, DT_ATU_DADOS etc.) ficam de
    # fora: são metadados de controle do ETL, não dado de negócio — um
    # registro nunca atualizado ter DT_ATU_DADOS vazio é normal, não é
    # problema de qualidade.
    relevant = [c for c in columns if not is_audit_column(c.name)]

    rows = await query(_build_completude_sql(schema_name, table, relevant))
    row = rows[0]
    total = int(row["TOTAL_REGISTROS"])

    por_coluna: dict[str, SaudeOut] = {}
    for column in relevant:
        preenchidos = int(row[column.name])
        percentual = 100 if total == 0 else round_half_up(preenchidos / total * 100)
        por_coluna[column.name] = SaudeOut(
            percentual=percentual, classificacao=infer_completude(percentual)
        )
    return Completude(
        total_registros=total, por_coluna=por_coluna, saude=_calcular_saude(por_coluna)
    )


def _validar_identificadores(schema_name: str, table: str) -> None:
    if not _IDENTIFIER_RE.match(schema_name) or not _IDENTIFIER_RE.match(table):
        raise HTTPException(status_code=400, detail="Schema ou tabela inválidos")


async def get_table_saude(schema_name: str, table: str) -> TableSaudeOut:
    _validar_identificadores(schema_name, table)
    columns = await list_columns(schema_name, table)
    completude = await get_completude(schema_name, table, columns)
    return TableSaudeOut(
        total_registros=completude.total_registros, saude=completude.saude
    )


def _avaliacao_out(avaliacao: Avaliacao) -> AvaliacaoOut:
    sugestao = avaliacao.sugestao
    return AvaliacaoOut(
        resultado=avaliacao.resultado,
        problemas=list(avaliacao.problemas),
        sugestao=(
            SugestaoOut(
                nome=sugestao.nome,
                dominio=sugestao.dominio,
                tipo=sugestao.tipo,
                nulo=sugestao.nulo,
            )
            if sugestao
            else None
        ),
    )


def _conformidade_out(resumo: Resumo) -> ConformidadeOut:
    return ConformidadeOut(
        aplicavel=resumo.aplicavel,
        conformes=resumo.conformes,
        avisos=resumo.avisos,
        fora=resumo.fora,
        total=resumo.total,
        percentual=resumo.percentual,
    )


def _avaliar_conformidade(
    schema_name: str, columns: list[ColumnOut]
) -> ConformidadeOut:
    """Preenche `conformidade` de cada coluna de negócio e devolve o resumo da
    tabela. Schema LEGADO não segue a convenção: nada é avaliado."""
    if infer_camada(schema_name) == "LEGADO":
        return _conformidade_out(resumo_nao_aplicavel())
    avaliacoes: list[Avaliacao] = []
    for column in columns:
        if is_audit_column(column.name):
            continue
        avaliacao = avaliar_coluna(column.name, column.type, column.length)
        column.conformidade = _avaliacao_out(avaliacao)
        avaliacoes.append(avaliacao)
    return _conformidade_out(resumir(avaliacoes))


@ttl_cache("CATALOG_CACHE_TTL_SECONDS")
async def list_tables_com_conformidade(schema_name: str) -> list[TableOut]:
    """`list_tables` + o resumo de conformidade de cada tabela, com UMA consulta
    extra para as colunas do schema inteiro (não uma por tabela)."""
    tables = await list_tables(schema_name)
    if infer_camada(schema_name) == "LEGADO":
        nao_aplicavel = _conformidade_out(resumo_nao_aplicavel())
        for table in tables:
            table.conformidade = nao_aplicavel
        return tables

    rows = await query(get_dialect().colunas_do_schema_sql, [schema_name])
    avaliacoes: dict[str, list[Avaliacao]] = {}
    for row in rows:
        nome = row["COLNAME"].strip()
        if is_audit_column(nome):
            continue
        avaliacoes.setdefault(row["TABNAME"].strip(), []).append(
            avaliar_coluna(nome, row["TYPENAME"].strip(), row["LENGTH"])
        )
    for table in tables:
        table.conformidade = _conformidade_out(resumir(avaliacoes.get(table.name, [])))
    return tables


def _calcular_documentacao(columns: list[ColumnOut]) -> DocumentacaoOut:
    negocio = [c for c in columns if not is_audit_column(c.name)]
    documentadas = sum(1 for c in negocio if c.description and c.description.strip())
    percentual = round_half_up(documentadas / len(negocio) * 100) if negocio else None
    return DocumentacaoOut(
        percentual=percentual, documentadas=documentadas, total=len(negocio)
    )


async def get_table_detail(schema_name: str, table: str) -> TableDetailOut:
    _validar_identificadores(schema_name, table)
    tables = await list_tables(schema_name)
    table_info = next((t for t in tables if t.name == table), None)
    if table_info is None:
        raise HTTPException(
            status_code=404, detail=f"Tabela {schema_name}.{table} não encontrada"
        )

    columns = await list_columns(schema_name, table)
    conformidade = _avaliar_conformidade(schema_name, columns)
    documentacao = _calcular_documentacao(columns)
    try:
        completude = await get_completude(schema_name, table, columns)
    except CatalogPermissionError:
        # Metadados são legíveis mesmo sem SELECT na tabela: mostra a
        # estrutura e só marca que a saúde não pôde ser medida.
        return TableDetailOut(
            **table_info.model_dump(exclude={"conformidade"}),
            schema_name=schema_name,
            total_registros=None,
            saude=None,
            leitura_negada=True,
            conformidade=conformidade,
            documentacao=documentacao,
            columns=columns,
        )
    for column in columns:
        column.completude = completude.por_coluna.get(column.name)

    return TableDetailOut(
        **table_info.model_dump(exclude={"conformidade"}),
        schema_name=schema_name,
        total_registros=completude.total_registros,
        saude=completude.saude,
        conformidade=conformidade,
        documentacao=documentacao,
        columns=columns,
    )


@ttl_cache(
    "CATALOG_CACHE_TTL_SECONDS",
    key=lambda term, schemas: (term.strip().upper(), tuple(schemas or ())),
)
async def search_columns(term: str, schemas: list[str] | None) -> list[ColumnSearchOut]:
    trimmed = term.strip()
    if not trimmed:
        return []

    params: list[str] = [f"%{trimmed.upper()}%"]
    if schemas:
        params.extend(schemas)
    sql = get_dialect().busca_colunas_sql(
        len(schemas or []), settings.CATALOG_COLUMN_SEARCH_LIMIT
    )
    rows = await query(sql, params)
    return [
        ColumnSearchOut(
            schema_name=row["TABSCHEMA"].strip(),
            table=row["TABNAME"].strip(),
            column=row["COLNAME"].strip(),
            type=row["TYPENAME"].strip(),
            description=_strip(row["REMARKS"]),
        )
        for row in rows
    ]
