"""Regras de nomenclatura geradas dos markdowns da skill SKTIARQ0001."""

import json
from pathlib import Path

import pytest

from app.features.nomenclatura.geracao import gerar_regras
from app.features.nomenclatura.regras import carregar_regras

PASTA_FONTE = Path(__file__).resolve().parents[2] / "docs" / "nomenclatura-fonte"
JSON_REGRAS = (
    Path(__file__).resolve().parents[1]
    / "app"
    / "features"
    / "nomenclatura"
    / "regras.json"
)

pytestmark = pytest.mark.skipif(
    not PASTA_FONTE.is_dir(), reason="docs/nomenclatura-fonte não existe"
)


def test_conta_itens_da_fonte():
    regras = carregar_regras()
    assert len(regras.prefixos) == 20
    assert "LEG" in regras.prefixos
    assert "VLX" in regras.prefixos
    assert len(regras.dominios_tipo) == 21
    assert len(regras.dominios_negocio) == 24


def test_prefixo_cd_tem_dois_dominios():
    assert carregar_regras().prefixos["CD"].dominios == ("CD_INT", "CD_VAR")


def test_prefixo_ds_tem_tres():
    assert carregar_regras().prefixos["DS"].dominios == ("DS_C", "DS_L", "DS_T")


@pytest.mark.parametrize("codigo", ["NR", "VL", "VR", "PC", "QT", "LEG", "VLX"])
def test_prefixos_sem_dominio(codigo):
    assert carregar_regras().prefixos[codigo].dominios == ()


def test_termo_cod_aponta_para_cd():
    termos = carregar_regras().termos
    assert termos["COD"] == "CD"
    assert termos["DESCRICAO"] == "DS"


def test_json_esta_em_dia():
    atual = json.loads(JSON_REGRAS.read_text(encoding="utf-8"))
    gerado = gerar_regras(PASTA_FONTE, atual["versao"], atual["data_fonte"])
    assert gerado == atual
