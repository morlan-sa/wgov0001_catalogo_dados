"""API de nomenclatura: contrato HTTP, proteção por sessão e validação de nome."""

from __future__ import annotations

import pytest

from tests.helpers import anonymous_client, authenticated_client


async def test_get_nomenclatura_traz_20_prefixos_e_versao():
    async with authenticated_client() as client:
        r = await client.get("/api/nomenclatura")
    assert r.status_code == 200
    corpo = r.json()
    assert set(corpo) == {
        "fonte",
        "versao",
        "data_fonte",
        "prefixos",
        "dominios_tipo",
        "dominios_negocio",
        "camadas",
        "ambiguidades",
    }
    assert corpo["versao"]
    assert len(corpo["prefixos"]) == 20
    assert {"LEG", "VLX"} <= {p["codigo"] for p in corpo["prefixos"]}
    assert set(corpo["prefixos"][0]) == {"codigo", "significado", "exemplo", "dominios"}
    assert set(corpo["dominios_tipo"][0]) == {
        "codigo",
        "descricao",
        "tipo",
        "escala",
        "nulo",
        "exemplo",
    }
    assert {"codigo": "COM", "nome": "Comercial"} in corpo["dominios_negocio"]
    assert corpo["camadas"] == ["STG", "CUR", "RPT"]
    assert set(corpo["ambiguidades"][0]) == {"termos", "opcoes", "pergunta"}


async def test_validar_cod_fornec_sugere_cd():
    async with authenticated_client() as client:
        r = await client.post("/api/nomenclatura/validar", json={"nome": "cod_fornec"})
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["nome"] == "COD_FORNEC"
    assert corpo["resultado"] == "fora"
    assert corpo["problemas"]
    assert corpo["sugestao"]["nome"].startswith("CD_")
    assert set(corpo["sugestao"]) == {"nome", "dominio", "tipo", "nulo"}
    assert "ambiguidade" in corpo
    assert corpo["dominios_candidatos"] == []


async def test_validar_nome_conforme_sem_tipo_pergunta_o_dominio():
    async with authenticated_client() as client:
        r = await client.post(
            "/api/nomenclatura/validar", json={"nome": "CD_FORNECEDOR"}
        )
    corpo = r.json()
    assert corpo["resultado"] == "conforme"
    assert corpo["sugestao"] is None
    assert corpo["dominios_candidatos"] == ["CD_INT", "CD_VAR"]


async def test_validar_devolve_ambiguidade():
    async with authenticated_client() as client:
        r = await client.post("/api/nomenclatura/validar", json={"nome": "numero"})
    ambiguidade = r.json()["ambiguidade"]
    assert ambiguidade["opcoes"] == ["NR", "CD"]
    assert set(ambiguidade) == {"termos", "opcoes", "pergunta"}


async def test_validar_exige_nome():
    async with authenticated_client() as client:
        r = await client.post("/api/nomenclatura/validar", json={"tipo": "INTEGER"})
    assert r.status_code == 422


@pytest.mark.parametrize("tipo", ["VARCHAR(²)", "VARCHAR(" + "9" * 5000 + ")"])
async def test_validar_tipo_absurdo_nao_gera_500(tipo):
    async with authenticated_client() as client:
        r = await client.post(
            "/api/nomenclatura/validar", json={"nome": "CD_X", "tipo": tipo}
        )
    assert r.status_code == 200


async def test_validar_sem_sessao_retorna_401():
    async with anonymous_client() as client:
        r = await client.post("/api/nomenclatura/validar", json={"nome": "CD_X"})
    assert r.status_code == 401


async def test_validar_com_sessao_retorna_200():
    async with authenticated_client() as client:
        r = await client.post(
            "/api/nomenclatura/validar",
            json={"nome": "CD_X", "tipo": "INTEGER", "tamanho": 4},
        )
    assert r.status_code == 200
