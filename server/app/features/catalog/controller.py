from fastapi import APIRouter, Depends, Query

from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.catalog import service as catalog_service
from app.features.catalog.dialect import get_dialect
from app.features.catalog.schemas import (
    ColumnSearchOut,
    TableDetailOut,
    TableOut,
    TableSaudeOut,
)
from app.features.schemas import service as schemas_service
from app.features.schemas.schemas import SchemaOut

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _parse_filter(value: str | None) -> list[str] | None:
    """`filter=CUR_COM,STG_ERP` → ['CUR_COM', 'STG_ERP']; vazio → None."""
    if not value:
        return None
    parsed = [get_dialect().normalize(s.strip()) for s in value.split(",") if s.strip()]
    return parsed or None


# `/columns/search` precisa vir antes das rotas com parâmetro de caminho.
@router.get("/columns/search", response_model=list[ColumnSearchOut])
async def buscar_colunas(
    q: str = Query(""),
    filtro: str | None = Query(None, alias="filter"),
    _: CurrentUser = Depends(get_current_user),
):
    return await catalog_service.search_columns(q, _parse_filter(filtro))


@router.get("/schemas", response_model=list[SchemaOut])
async def listar_schemas(
    filtro: str | None = Query(None, alias="filter"),
    _: CurrentUser = Depends(get_current_user),
):
    schemas = await schemas_service.list_schemas()
    selecionados = _parse_filter(filtro)
    if selecionados is None:
        return schemas
    return [s for s in schemas if s.schema_name in selecionados]


@router.get("/schemas/{schema_name}/tables", response_model=list[TableOut])
async def listar_tabelas(schema_name: str, _: CurrentUser = Depends(get_current_user)):
    return await catalog_service.list_tables_com_conformidade(
        get_dialect().normalize(schema_name)
    )


@router.get("/schemas/{schema_name}/tables/{table}/saude", response_model=TableSaudeOut)
async def saude_da_tabela(
    schema_name: str, table: str, _: CurrentUser = Depends(get_current_user)
):
    normalize = get_dialect().normalize
    return await catalog_service.get_table_saude(
        normalize(schema_name), normalize(table)
    )


@router.get("/schemas/{schema_name}/tables/{table}", response_model=TableDetailOut)
async def detalhe_da_tabela(
    schema_name: str, table: str, _: CurrentUser = Depends(get_current_user)
):
    normalize = get_dialect().normalize
    return await catalog_service.get_table_detail(
        normalize(schema_name), normalize(table)
    )
