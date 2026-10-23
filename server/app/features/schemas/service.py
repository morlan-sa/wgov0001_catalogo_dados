from app.db.catalog_db import query
from app.features.catalog.cache import ttl_cache
from app.features.catalog.dialect import get_dialect
from app.features.catalog.inference import infer_camada, infer_dominio
from app.features.schemas.schemas import DominioOut, SchemaOut


@ttl_cache("CATALOG_CACHE_TTL_SECONDS")
async def list_schemas() -> list[SchemaOut]:
    rows = await query(get_dialect().schemas_sql)
    result: list[SchemaOut] = []
    for row in rows:
        schema_name = row["TABSCHEMA"].strip()
        result.append(
            SchemaOut(
                schema_name=schema_name,
                table_count=int(row["QTD_TABELAS"]),
                view_count=int(row["QTD_VIEWS"]),
                camada=infer_camada(schema_name),
                dominio=DominioOut(**infer_dominio(schema_name)),
            )
        )
    return result
