"""SQL de metadados por fonte do catálogo (`Settings.CATALOG_SOURCE`).

Os dois dialetos devolvem o MESMO formato de linha (chaves em maiúsculas:
TABSCHEMA, TABNAME, TYPE 'T'/'V', REMARKS, COLNAME, TYPENAME, LENGTH, SCALE,
NULLS 'Y'/'N', COLNO…), então os serviços não sabem qual banco consultam.

Identificadores: o DB2 guarda tudo em maiúsculas, então a API normaliza para
maiúsculas; o Postgres é sensível à caixa (e os schemas são minúsculos), então
a API preserva o que o usuário informou.
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.config import settings

_PG_SCHEMAS_DE_SISTEMA = (
    "LEFT(n.nspname, 3) <> 'pg_' AND n.nspname <> 'information_schema'"
)
# Só tabelas/views "de verdade": exclui partições, que repetem a tabela mãe.
_PG_OBJETOS = "c.relkind IN ('r', 'p', 'v', 'm') AND NOT c.relispartition"


@dataclass(frozen=True)
class Dialect:
    name: str
    schemas_sql: str
    tables_sql: str
    columns_sql: str
    # Colunas de TODAS as tabelas/views de um schema numa consulta só (param:
    # schema; linhas TABNAME, COLNAME, TYPENAME, LENGTH, SCALE).
    colunas_do_schema_sql: str
    pk_sql: str
    normalize: Callable[[str], str]
    # Expressão que conta uma coluna de texto só quando não é vazia/em branco.
    texto_preenchido: Callable[[str], str]
    # SQL das candidatas às menores tabelas de um schema (param: schema).
    candidatas_sql: Callable[[int], str]
    # SQL da busca de colunas (params: termo, *schemas); recebe nº de schemas
    # do filtro e o limite de linhas.
    busca_colunas_sql: Callable[[int, int], str]


def _db2_candidatas(pool: int) -> str:
    return f"""
        SELECT TABNAME
        FROM SYSCAT.TABLES
        WHERE TABSCHEMA = ? AND TYPE = 'T'
        ORDER BY CASE WHEN CARD < 0 THEN 999999999 ELSE CARD END ASC
        FETCH FIRST {int(pool)} ROWS ONLY
    """


def _db2_busca_colunas(n_schemas: int, limite: int) -> str:
    conditions = [
        "T.TYPE IN ('T', 'V')",
        "T.TABSCHEMA NOT LIKE 'SYS%'",
        "UPPER(C.COLNAME) LIKE ?",
    ]
    if n_schemas:
        conditions.append(f"T.TABSCHEMA IN ({','.join('?' for _ in range(n_schemas))})")
    return f"""
        SELECT C.TABSCHEMA, C.TABNAME, C.COLNAME, C.TYPENAME, C.REMARKS
        FROM SYSCAT.COLUMNS C
        JOIN SYSCAT.TABLES T ON T.TABSCHEMA = C.TABSCHEMA AND T.TABNAME = C.TABNAME
        WHERE {" AND ".join(conditions)}
        ORDER BY C.TABSCHEMA, C.TABNAME, C.COLNAME
        FETCH FIRST {int(limite)} ROWS ONLY
    """


def _pg_candidatas(pool: int) -> str:
    # reltuples < 0 = tabela nunca analisada, tratada como grande (vai pro fim).
    return f"""
        SELECT c.relname AS "TABNAME"
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ? AND c.relkind IN ('r', 'p') AND NOT c.relispartition
        ORDER BY CASE WHEN c.reltuples < 0 THEN 999999999 ELSE c.reltuples END ASC
        FETCH FIRST {int(pool)} ROWS ONLY
    """


def _pg_busca_colunas(n_schemas: int, limite: int) -> str:
    conditions = [
        _PG_OBJETOS,
        _PG_SCHEMAS_DE_SISTEMA,
        "a.attnum > 0",
        "NOT a.attisdropped",
        "UPPER(a.attname) LIKE ?",
    ]
    if n_schemas:
        conditions.append(f"n.nspname IN ({','.join('?' for _ in range(n_schemas))})")
    return f"""
        SELECT n.nspname AS "TABSCHEMA", c.relname AS "TABNAME",
               a.attname AS "COLNAME", format_type(a.atttypid, NULL) AS "TYPENAME",
               col_description(c.oid, a.attnum) AS "REMARKS"
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE {" AND ".join(conditions)}
        ORDER BY n.nspname, c.relname, a.attname
        FETCH FIRST {int(limite)} ROWS ONLY
    """


DB2 = Dialect(
    name="db2",
    schemas_sql="""
    SELECT
      TABSCHEMA,
      COUNT(CASE WHEN TYPE = 'T' THEN 1 END) AS QTD_TABELAS,
      COUNT(CASE WHEN TYPE = 'V' THEN 1 END) AS QTD_VIEWS
    FROM SYSCAT.TABLES
    WHERE TYPE IN ('T', 'V') AND TABSCHEMA NOT LIKE 'SYS%'
    GROUP BY TABSCHEMA
    ORDER BY TABSCHEMA
""",
    tables_sql="""
    SELECT TABNAME, TYPE, REMARKS
    FROM SYSCAT.TABLES
    WHERE TABSCHEMA = ? AND TYPE IN ('T', 'V')
    ORDER BY TABNAME
""",
    columns_sql="""
    SELECT COLNAME, TYPENAME, LENGTH, SCALE, NULLS, COLNO, REMARKS
    FROM SYSCAT.COLUMNS
    WHERE TABSCHEMA = ? AND TABNAME = ?
    ORDER BY COLNO
""",
    colunas_do_schema_sql="""
    SELECT C.TABNAME, C.COLNAME, C.TYPENAME, C.LENGTH, C.SCALE
    FROM SYSCAT.COLUMNS C
    JOIN SYSCAT.TABLES T ON T.TABSCHEMA = C.TABSCHEMA AND T.TABNAME = C.TABNAME
    WHERE C.TABSCHEMA = ? AND T.TYPE IN ('T', 'V')
    ORDER BY C.TABNAME, C.COLNO
""",
    pk_sql="""
    SELECT K.COLNAME
    FROM SYSCAT.TABCONST T
    JOIN SYSCAT.KEYCOLUSE K
      ON T.CONSTNAME = K.CONSTNAME
     AND T.TABSCHEMA = K.TABSCHEMA
     AND T.TABNAME = K.TABNAME
    WHERE T.TABSCHEMA = ? AND T.TABNAME = ? AND T.TYPE = 'P'
""",
    normalize=str.upper,
    texto_preenchido=lambda col: f"COUNT(NULLIF(TRIM({col}), ''))",
    candidatas_sql=_db2_candidatas,
    busca_colunas_sql=_db2_busca_colunas,
)

POSTGRES = Dialect(
    name="postgres",
    schemas_sql=f"""
    SELECT
      n.nspname AS "TABSCHEMA",
      COUNT(*) FILTER (WHERE c.relkind IN ('r', 'p')) AS "QTD_TABELAS",
      COUNT(*) FILTER (WHERE c.relkind IN ('v', 'm')) AS "QTD_VIEWS"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE {_PG_OBJETOS} AND {_PG_SCHEMAS_DE_SISTEMA}
    GROUP BY n.nspname
    ORDER BY n.nspname
""",
    tables_sql=f"""
    SELECT
      c.relname AS "TABNAME",
      CASE WHEN c.relkind IN ('v', 'm') THEN 'V' ELSE 'T' END AS "TYPE",
      obj_description(c.oid, 'pg_class') AS "REMARKS"
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = ? AND {_PG_OBJETOS}
    ORDER BY c.relname
""",
    columns_sql="""
    SELECT
      a.attname AS "COLNAME",
      format_type(a.atttypid, NULL) AS "TYPENAME",
      CASE
        WHEN a.atttypmod > 0 AND t.typname IN ('varchar', 'bpchar')
          THEN a.atttypmod - 4
        WHEN a.atttypmod > 0 AND t.typname = 'numeric'
          THEN ((a.atttypmod - 4) >> 16) & 65535
        ELSE 0
      END AS "LENGTH",
      CASE
        WHEN a.atttypmod > 0 AND t.typname = 'numeric' THEN (a.atttypmod - 4) & 65535
        ELSE 0
      END AS "SCALE",
      CASE WHEN a.attnotnull THEN 'N' ELSE 'Y' END AS "NULLS",
      ROW_NUMBER() OVER (ORDER BY a.attnum) - 1 AS "COLNO",
      col_description(a.attrelid, a.attnum) AS "REMARKS"
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = ? AND c.relname = ? AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY a.attnum
""",
    colunas_do_schema_sql=f"""
    SELECT
      c.relname AS "TABNAME",
      a.attname AS "COLNAME",
      format_type(a.atttypid, NULL) AS "TYPENAME",
      CASE
        WHEN a.atttypmod > 0 AND t.typname IN ('varchar', 'bpchar')
          THEN a.atttypmod - 4
        WHEN a.atttypmod > 0 AND t.typname = 'numeric'
          THEN ((a.atttypmod - 4) >> 16) & 65535
        ELSE 0
      END AS "LENGTH",
      CASE
        WHEN a.atttypmod > 0 AND t.typname = 'numeric' THEN (a.atttypmod - 4) & 65535
        ELSE 0
      END AS "SCALE"
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_type t ON t.oid = a.atttypid
    WHERE n.nspname = ? AND {_PG_OBJETOS} AND a.attnum > 0 AND NOT a.attisdropped
    ORDER BY c.relname, a.attnum
""",
    pk_sql="""
    SELECT a.attname AS "COLNAME"
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
    WHERE k.contype = 'p' AND n.nspname = ? AND c.relname = ?
""",
    normalize=lambda name: name,
    texto_preenchido=lambda col: f"COUNT(NULLIF(TRIM(CAST({col} AS TEXT)), ''))",
    candidatas_sql=_pg_candidatas,
    busca_colunas_sql=_pg_busca_colunas,
)

_DIALECTS = {DB2.name: DB2, POSTGRES.name: POSTGRES}


def get_dialect() -> Dialect:
    """Dialeto da fonte configurada — lido a cada chamada (não no import)."""
    return _DIALECTS[settings.CATALOG_SOURCE]
