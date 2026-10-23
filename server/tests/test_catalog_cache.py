"""Cache TTL das leituras do catálogo: reaproveita, deduplica chamadas
simultâneas, não guarda falhas e entrega cópias independentes."""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest

from app.config import settings
from app.features.catalog import cache


@pytest.fixture(autouse=True)
def cache_ligado():
    cache.limpar()
    with patch.object(settings, "CATALOG_CACHE_TTL_SECONDS", 60.0):
        yield
    cache.limpar()


def _contador():
    chamadas: list[tuple] = []

    @cache.ttl_cache("CATALOG_CACHE_TTL_SECONDS")
    async def busca(x, y=0):
        chamadas.append((x, y))
        await asyncio.sleep(0)
        return {"x": x, "lista": [x]}

    return busca, chamadas


async def test_segunda_chamada_igual_vem_do_cache():
    busca, chamadas = _contador()
    await busca(1)
    await busca(1)
    await busca(2)
    assert chamadas == [(1, 0), (2, 0)]


async def test_chamadas_simultaneas_compartilham_uma_execucao():
    busca, chamadas = _contador()
    await asyncio.gather(*(busca(1) for _ in range(5)))
    assert chamadas == [(1, 0)]


async def test_falha_nao_e_guardada():
    chamadas = 0

    @cache.ttl_cache("CATALOG_CACHE_TTL_SECONDS")
    async def instavel():
        nonlocal chamadas
        chamadas += 1
        if chamadas == 1:
            raise RuntimeError("sem permissão")
        return "ok"

    with pytest.raises(RuntimeError):
        await instavel()
    assert await instavel() == "ok"
    assert chamadas == 2


async def test_cada_chamador_recebe_a_sua_copia():
    busca, _ = _contador()
    primeiro = await busca(1)
    primeiro["lista"].append("mutado")
    assert (await busca(1))["lista"] == [1]


async def test_ttl_zero_desliga_o_cache():
    busca, chamadas = _contador()
    with patch.object(settings, "CATALOG_CACHE_TTL_SECONDS", 0.0):
        await busca(1)
        await busca(1)
    assert len(chamadas) == 2


async def test_ttl_expirado_busca_de_novo():
    busca, chamadas = _contador()
    await busca(1)
    with patch.object(cache.time, "monotonic", return_value=10**9):
        await busca(1)
    assert len(chamadas) == 2


async def test_chave_personalizada_aceita_argumentos_nao_hashaveis():
    chamadas = 0

    @cache.ttl_cache(
        "CATALOG_CACHE_TTL_SECONDS", key=lambda itens: tuple(i["n"] for i in itens)
    )
    async def soma(itens):
        nonlocal chamadas
        chamadas += 1
        return sum(i["n"] for i in itens)

    assert await soma([{"n": 1}, {"n": 2}]) == 3
    assert await soma([{"n": 1}, {"n": 2}]) == 3
    assert chamadas == 1
