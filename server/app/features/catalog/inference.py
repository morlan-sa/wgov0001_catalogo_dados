"""Inferências puras (string in → string out, sem banco) sobre os nomes e
comentários da fonte do catálogo (DB2 ou Postgres): camada, domínio de negócio,
classificação da informação, domínio de coluna e classe de completude. Nada é
gravado — tudo é inferido em memória a cada requisição.
"""

import math
import re

from app.config import settings
from app.features.catalog.reference import (
    CAMADA_LEGADO,
    CAMADAS_GOVERNADAS,
    CLASSIFICACAO_LABELS,
    DOMINIO_NAO_CLASSIFICADO_CODE,
    DOMINIOS_NEGOCIO,
    NAO_CLASSIFICADO,
)
from app.features.nomenclatura.regras import carregar_regras

# `CLASSIFICA[^:]*` tolera acento corrompido (mojibake) em "Classificação".
_CLASSIFICACAO_RE = re.compile(
    r"CLASSIFICA[^:]*:?\s*(PUBLICO|CORPORATIVO|RESTRITO|SIGILOSO)", re.IGNORECASE
)


def round_half_up(value: float) -> int:
    """Arredonda .5 para cima (como o `Math.round` do app original); o
    `round()` do Python arredondaria para o par mais próximo."""
    return math.floor(value + 0.5)


def list_dominios_negocio() -> list[dict[str, str]]:
    return [{"code": code, "name": name} for code, name in DOMINIOS_NEGOCIO.items()]


def infer_camada(schema_name: str) -> str:
    prefix = schema_name.upper().split("_")[0]
    return prefix if prefix in CAMADAS_GOVERNADAS else CAMADA_LEGADO


def infer_dominio(schema_name: str) -> dict[str, str]:
    parts = schema_name.upper().split("_")
    suffix = "_".join(parts[1:]) if len(parts) > 1 else None
    if suffix and suffix in DOMINIOS_NEGOCIO:
        return {"code": suffix, "name": DOMINIOS_NEGOCIO[suffix]}
    return {"code": DOMINIO_NAO_CLASSIFICADO_CODE, "name": NAO_CLASSIFICADO}


def infer_classificacao(remarks: str | None) -> str:
    if not remarks:
        return NAO_CLASSIFICADO
    match = _CLASSIFICACAO_RE.search(remarks.upper())
    if not match:
        return NAO_CLASSIFICADO
    return CLASSIFICACAO_LABELS.get(match.group(1), NAO_CLASSIFICADO)


def infer_prefix_domain(column_name: str) -> str:
    prefixo = carregar_regras().prefixos.get(column_name.upper().split("_")[0])
    return prefixo.significado if prefixo else NAO_CLASSIFICADO


def infer_completude(percentual: int) -> str:
    if percentual >= settings.COMPLETUDE_LIMIAR_EXCELENTE:
        return "Excelente"
    if percentual >= settings.COMPLETUDE_LIMIAR_BOM:
        return "Bom"
    return "Atenção"


def is_audit_column(column_name: str) -> bool:
    return column_name.upper() in settings.AUDIT_COLUMNS
