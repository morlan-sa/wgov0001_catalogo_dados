"""Avaliação de colunas contra a convenção de nomenclatura (funções puras, sem I/O).

O tipo da coluna é comparado por *família* (texto, inteiro, ...), nunca pelo
nome exato do tipo, para servir tanto ao DB2 (`VARCHAR`, `CHARACTER`) quanto ao
Postgres (`character varying`, `timestamp without time zone`)."""

from collections.abc import Iterable
from dataclasses import dataclass
from typing import Literal

from app.config import settings
from app.features.catalog.inference import round_half_up
from app.features.nomenclatura.regras import DominioTipo, carregar_regras

Familia = Literal[
    "texto", "inteiro", "decimal", "data", "hora", "data_hora", "booleano", "outro"
]
Resultado = Literal["conforme", "aviso", "fora"]

_TEXTO = frozenset(
    {"char", "character", "varchar", "character varying", "char varying", "text",
     "bpchar", "long varchar", "clob", "string", "graphic", "vargraphic"}
)  # fmt: skip
_INTEIRO = frozenset(
    {"smallint", "integer", "int", "bigint", "int2", "int4", "int8",
     "serial", "bigserial", "smallserial"}
)  # fmt: skip
_DECIMAL = frozenset(
    {"decimal", "dec", "numeric", "number", "real", "float", "double",
     "double precision", "decfloat", "money"}
)  # fmt: skip
_BOOLEANO = frozenset({"boolean", "bool"})

_FAMILIA_DO_DOMINIO: dict[str, Familia] = {
    "INTEGER": "inteiro",
    "VARCHAR": "texto",
    "TEXT": "texto",
    "DATE": "data",
    "TIME": "hora",
    "TIMESTAMP": "data_hora",
    "BOOLEAN": "booleano",
}


def familia_do_tipo(tipo: str) -> Familia:
    t = tipo.strip().lower().split("(")[0].strip()
    if t in _TEXTO:
        return "texto"
    if t in _INTEIRO:
        return "inteiro"
    if t in _DECIMAL:
        return "decimal"
    if t in _BOOLEANO:
        return "booleano"
    if t == "date":
        return "data"
    if t.startswith("timestamp"):
        return "data_hora"
    if t == "time" or t.startswith("time "):
        return "hora"
    return "outro"


@dataclass(frozen=True)
class Sugestao:
    nome: str | None = None
    dominio: str | None = None
    tipo: str | None = None
    nulo: bool | None = None


@dataclass(frozen=True)
class Avaliacao:
    resultado: Resultado
    problemas: tuple[str, ...]
    sugestao: Sugestao | None


@dataclass(frozen=True)
class Resumo:
    aplicavel: bool
    conformes: int
    avisos: int
    fora: int
    total: int
    percentual: int | None


def _familia_dominio(dominio: DominioTipo) -> Familia:
    return _FAMILIA_DO_DOMINIO.get(dominio.tipo.upper(), "outro")


def _escala_numerica(dominio: DominioTipo) -> int | None:
    escala = dominio.escala
    return int(escala) if escala is not None and escala.isdigit() else None


def _tipo_do_dominio(dominio: DominioTipo) -> str:
    escala = _escala_numerica(dominio)
    return f"{dominio.tipo}({escala})" if escala is not None else dominio.tipo


def _sugestao_do_dominio(dominio: DominioTipo) -> Sugestao:
    return Sugestao(
        dominio=dominio.codigo, tipo=_tipo_do_dominio(dominio), nulo=dominio.nulo
    )


def _casa_familia(familia: Familia, tamanho: int | None, dominio: DominioTipo) -> bool:
    alvo = _familia_dominio(dominio)
    if familia == alvo:
        return True
    # DB2 não tem tipo booleano: indicador é CHAR(1).
    return alvo == "booleano" and familia == "texto" and tamanho == 1


def _fora(problema: str, sugestao: Sugestao | None = None) -> Avaliacao:
    return Avaliacao("fora", (problema,), sugestao)


def avaliar_coluna(
    nome: str, tipo: str | None, tamanho: int | None = None
) -> Avaliacao:
    regras = carregar_regras()
    normalizado = (nome or "").strip().upper()
    if not normalizado:
        return _fora("O nome da coluna está vazio.")

    prefixo, _, resto = normalizado.partition("_")

    if prefixo not in regras.prefixos:
        termo = regras.termos.get(prefixo)
        sugestao = Sugestao(nome=f"{termo}_{resto}") if termo and resto else None
        return _fora(f"O prefixo '{prefixo}' não faz parte da convenção.", sugestao)

    if not resto:
        return _fora(
            f"O nome só tem o prefixo '{prefixo}', falta o complemento "
            f"(ex.: {prefixo}_NOME)."
        )

    if tipo is None:
        return Avaliacao("conforme", (), None)

    candidatos = [
        regras.dominios_tipo[codigo]
        for codigo in regras.prefixos[prefixo].dominios
        if codigo in regras.dominios_tipo
    ]
    if not candidatos:
        return Avaliacao("conforme", (), None)

    familia = familia_do_tipo(tipo)
    mesma_familia = [d for d in candidatos if _casa_familia(familia, tamanho, d)]
    if not mesma_familia:
        esperado = candidatos[0]
        return _fora(
            f"O tipo '{tipo}' não é compatível com o prefixo '{prefixo}' "
            f"(esperado {_tipo_do_dominio(esperado)}).",
            _sugestao_do_dominio(esperado),
        )

    if familia != "texto" or tamanho is None:
        return Avaliacao("conforme", (), None)

    for dominio in mesma_familia:
        escala = _escala_numerica(dominio)
        if escala is None or escala == tamanho:
            return Avaliacao("conforme", (), None)

    esperado = mesma_familia[0]
    return Avaliacao(
        "aviso",
        (
            f"O tamanho {tamanho} difere do definido no domínio {esperado.codigo} "
            f"({_escala_numerica(esperado)}).",
        ),
        _sugestao_do_dominio(esperado),
    )


def resumir(avaliacoes: Iterable[Avaliacao]) -> Resumo:
    conformes = avisos = fora = 0
    for avaliacao in avaliacoes:
        if avaliacao.resultado == "conforme":
            conformes += 1
        elif avaliacao.resultado == "aviso":
            avisos += 1
        else:
            fora += 1
    total = conformes + avisos + fora
    percentual = (
        round_half_up(
            (conformes + settings.CONFORMIDADE_PESO_AVISO * avisos) / total * 100
        )
        if total
        else None
    )
    return Resumo(True, conformes, avisos, fora, total, percentual)


def resumo_nao_aplicavel() -> Resumo:
    return Resumo(False, 0, 0, 0, 0, None)
