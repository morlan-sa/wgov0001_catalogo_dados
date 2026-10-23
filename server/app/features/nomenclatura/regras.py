"""Regras de nomenclatura carregadas de `regras.json` (gerado por
`scripts/gerar_regras_nomenclatura.py` a partir da skill SKTIARQ0001)."""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

ARQUIVO_REGRAS = Path(__file__).with_name("regras.json")


@dataclass(frozen=True)
class Prefixo:
    codigo: str
    significado: str
    exemplo: str
    dominios: tuple[str, ...]


@dataclass(frozen=True)
class DominioTipo:
    codigo: str
    descricao: str
    tipo: str
    escala: str | None
    nulo: bool
    exemplo: str


@dataclass(frozen=True)
class Ambiguidade:
    termos: tuple[str, ...]
    opcoes: tuple[str, ...]
    pergunta: str


@dataclass(frozen=True)
class Regras:
    fonte: str
    versao: str
    data_fonte: str
    prefixos: dict[str, Prefixo]
    dominios_tipo: dict[str, DominioTipo]
    dominios_negocio: dict[str, str]
    termos: dict[str, str]
    ambiguidades: tuple[Ambiguidade, ...]


@cache
def carregar_regras() -> Regras:
    dados = json.loads(ARQUIVO_REGRAS.read_text(encoding="utf-8"))
    return Regras(
        fonte=dados["fonte"],
        versao=dados["versao"],
        data_fonte=dados["data_fonte"],
        prefixos={
            codigo: Prefixo(
                codigo=p["codigo"],
                significado=p["significado"],
                exemplo=p["exemplo"],
                dominios=tuple(p["dominios"]),
            )
            for codigo, p in dados["prefixos"].items()
        },
        dominios_tipo={
            codigo: DominioTipo(**d) for codigo, d in dados["dominios_tipo"].items()
        },
        dominios_negocio=dict(dados["dominios_negocio"]),
        termos=dict(dados["termos"]),
        ambiguidades=tuple(
            Ambiguidade(
                termos=tuple(a["termos"]),
                opcoes=tuple(a["opcoes"]),
                pergunta=a["pergunta"],
            )
            for a in dados["ambiguidades"]
        ),
    )
