"""Validação de um nome de coluna digitado livremente (sem tabela de origem)."""

import re
from dataclasses import dataclass

from app.features.nomenclatura.conformidade import Avaliacao, avaliar_coluna
from app.features.nomenclatura.geracao import normalizar_termo
from app.features.nomenclatura.regras import Ambiguidade, carregar_regras

_ESPACOS = re.compile(r"\s+")


@dataclass(frozen=True)
class Validacao:
    nome: str
    avaliacao: Avaliacao
    ambiguidade: Ambiguidade | None
    dominios_candidatos: tuple[str, ...]


def _normalizar_nome(nome: str | None) -> str:
    """`" cód fornec "` -> `COD_FORNEC`."""
    return _ESPACOS.sub("_", normalizar_termo(nome or ""))


def _abre_com_termo(normalizado: str, ambiguidade: Ambiguidade) -> bool:
    """O nome é o termo ou começa por ele (termos de várias palavras incluídos)."""
    for termo in ambiguidade.termos:
        t = _normalizar_nome(termo)
        if normalizado == t or normalizado.startswith(t + "_"):
            return True
    return False


def validar_nome(
    nome: str, tipo: str | None = None, tamanho: int | None = None
) -> Validacao:
    regras = carregar_regras()
    normalizado = _normalizar_nome(nome)
    avaliacao = avaliar_coluna(normalizado, tipo, tamanho)
    prefixo = normalizado.partition("_")[0]

    ambiguidade = next(
        (a for a in regras.ambiguidades if _abre_com_termo(normalizado, a)), None
    )

    candidatos: tuple[str, ...] = ()
    # Só pergunta o domínio quando o nome já está válido e o tipo não foi dado.
    if tipo is None and avaliacao.resultado == "conforme":
        dominios = tuple(
            d for d in regras.prefixos[prefixo].dominios if d in regras.dominios_tipo
        )
        if len(dominios) > 1:
            candidatos = dominios

    return Validacao(normalizado, avaliacao, ambiguidade, candidatos)
