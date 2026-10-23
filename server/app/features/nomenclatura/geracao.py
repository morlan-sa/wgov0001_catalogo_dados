"""Gera o dicionário de regras de nomenclatura a partir dos markdowns da skill.

Lê as tabelas de `prefixos.md`, `dominios.md` e `convencao-nomenclatura.md`
(cópia das referências da skill SKTIARQ0001) e devolve um dicionário pronto
para virar `regras.json`. Versão e data da fonte vêm de quem chama — nada
disso é fixo no código.
"""

import re
import unicodedata
from pathlib import Path

FONTE = "SKTIARQ0001"

_CRASES = re.compile(r"`([^`]+)`")


def normalizar_termo(texto: str) -> str:
    """Maiúsculas e sem acento — `Descrição` -> `DESCRICAO`."""
    sem_acento = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return sem_acento.strip().upper()


def _celulas(linha: str) -> list[str]:
    return [c.strip() for c in linha.strip().strip("|").split("|")]


def _tabelas(texto: str) -> list[list[list[str]]]:
    """Cada tabela markdown vira uma lista de linhas; a primeira é o cabeçalho."""
    tabelas: list[list[list[str]]] = []
    atual: list[list[str]] = []
    for linha in texto.splitlines():
        if linha.lstrip().startswith("|"):
            celulas = _celulas(linha)
            if all(set(c) <= set("-: ") for c in celulas):
                continue  # linha separadora `|---|---|`
            atual.append(celulas)
        elif atual:
            tabelas.append(atual)
            atual = []
    if atual:
        tabelas.append(atual)
    return tabelas


def _tabela(texto: str, primeira_coluna: str) -> list[list[str]]:
    """Linhas de dados da tabela cujo cabeçalho começa por `primeira_coluna`."""
    for tabela in _tabelas(texto):
        if tabela[0][0] == primeira_coluna:
            return tabela[1:]
    raise ValueError(f"tabela com cabeçalho '{primeira_coluna}' não encontrada")


def _sem_crases(texto: str) -> str:
    return texto.replace("`", "").strip()


def _codigo_prefixo(celula: str) -> str:
    return _sem_crases(celula).rstrip("_")


def gerar_regras(pasta_fonte: Path, versao: str, data_fonte: str) -> dict:
    prefixos_md = (pasta_fonte / "prefixos.md").read_text(encoding="utf-8")
    dominios_md = (pasta_fonte / "dominios.md").read_text(encoding="utf-8")
    convencao_md = (pasta_fonte / "convencao-nomenclatura.md").read_text(
        encoding="utf-8"
    )

    dominios_tipo: dict[str, dict] = {}
    for codigo, descricao, tipo, escala, nulo, exemplo in _tabela(
        dominios_md, "Domínio"
    ):
        codigo = _sem_crases(codigo)
        dominios_tipo[codigo] = {
            "codigo": codigo,
            "descricao": descricao,
            "tipo": tipo,
            "escala": None if escala == "—" else escala,
            "nulo": nulo == "S",
            "exemplo": _sem_crases(exemplo),
        }

    prefixos: dict[str, dict] = {}
    for celula, significado, exemplo in _tabela(prefixos_md, "Prefixo"):
        codigo = _codigo_prefixo(celula)
        prefixos[codigo] = {
            "codigo": codigo,
            "significado": significado,
            "exemplo": exemplo,
            "dominios": [
                d for d in dominios_tipo if d == codigo or d.startswith(codigo + "_")
            ],
        }

    termos: dict[str, str] = {}
    for termo, celula in _tabela(prefixos_md, "Termo comum"):
        if "(" in termo:
            continue
        for parte in termo.split(","):
            termos[normalizar_termo(parte)] = _codigo_prefixo(celula)

    ambiguidades = []
    for termo, opcoes, pergunta in _tabela(prefixos_md, "Termo ambíguo"):
        ambiguidades.append(
            {
                "termos": [
                    normalizar_termo(t) for t in re.split(r"[,/]", termo) if t.strip()
                ],
                "opcoes": [_codigo_prefixo(o) for o in _CRASES.findall(opcoes)],
                "pergunta": pergunta.strip().strip('"'),
            }
        )

    dominios_negocio = {
        codigo: area for codigo, area in _tabela(convencao_md, "Código")
    }

    return {
        "fonte": FONTE,
        "versao": versao,
        "data_fonte": data_fonte,
        "prefixos": prefixos,
        "dominios_tipo": dominios_tipo,
        "dominios_negocio": dominios_negocio,
        "termos": termos,
        "ambiguidades": ambiguidades,
    }
