import pytest

from app.config import settings
from app.features.nomenclatura.conformidade import (
    Avaliacao,
    avaliar_coluna,
    familia_do_tipo,
    resumir,
    resumo_nao_aplicavel,
)


@pytest.mark.parametrize(
    ("tipo", "familia"),
    [
        ("VARCHAR", "texto"),
        ("character varying", "texto"),
        ("CHARACTER", "texto"),
        ("VARCHAR(20)", "texto"),
        ("INTEGER", "inteiro"),
        ("bigint", "inteiro"),
        ("SMALLINT", "inteiro"),
        ("DECIMAL", "decimal"),
        ("numeric", "decimal"),
        ("DATE", "data"),
        ("TIME", "hora"),
        ("time without time zone", "hora"),
        ("TIMESTAMP", "data_hora"),
        ("timestamp without time zone", "data_hora"),
        ("boolean", "booleano"),
        ("INTERVAL", "outro"),
        ("BLOB", "outro"),
        ("", "outro"),
    ],
)
def test_familia_do_tipo(tipo: str, familia: str):
    assert familia_do_tipo(tipo) == familia


def test_codigo_texto_com_tamanho_do_dominio_e_conforme():
    r = avaliar_coluna("CD_FORNECEDOR", "VARCHAR", 20)
    assert r.resultado == "conforme"
    assert r.problemas == ()
    assert r.sugestao is None


def test_tamanho_diferente_do_dominio_e_aviso():
    r = avaliar_coluna("CD_FORNECEDOR", "VARCHAR", 10)
    assert r.resultado == "aviso"
    assert len(r.problemas) == 1
    assert r.sugestao is not None
    assert r.sugestao.dominio == "CD_VAR"
    assert r.sugestao.tipo == "VARCHAR(20)"
    assert r.sugestao.nulo is False


def test_tamanho_nao_informado_nao_gera_aviso():
    assert avaliar_coluna("CD_FORNECEDOR", "VARCHAR").resultado == "conforme"


def test_prefixo_nao_reconhecido_sugere_prefixo_padrao():
    r = avaliar_coluna("COD_FORNEC", "VARCHAR", 10)
    assert r.resultado == "fora"
    assert r.sugestao is not None
    assert r.sugestao.nome == "CD_FORNEC"


def test_prefixo_desconhecido_sem_termo_nao_sugere_nome():
    r = avaliar_coluna("XYZ_ALGO", "VARCHAR", 10)
    assert r.resultado == "fora"
    assert r.sugestao is None


def test_nome_em_minusculas_e_avaliado_sem_diferenciar_caixa():
    assert (
        avaliar_coluna("cd_fornecedor", "character varying", 20).resultado == "conforme"
    )


def test_codigo_inteiro_casa_com_o_primeiro_dominio():
    assert avaliar_coluna("CD_PRODUTO", "INTEGER").resultado == "conforme"


def test_tipo_de_outra_familia_e_fora_com_sugestao_do_dominio():
    r = avaliar_coluna("NM_CLIENTE", "INTEGER")
    assert r.resultado == "fora"
    assert r.sugestao is not None
    assert r.sugestao.dominio == "NM"
    assert r.sugestao.tipo == "VARCHAR(128)"


def test_tipo_nulo_valida_so_o_prefixo():
    assert avaliar_coluna("NM_CLIENTE", None).resultado == "conforme"
    assert avaliar_coluna("COD_X", None).resultado == "fora"


def test_prefixo_sem_dominio_de_tipo_valida_so_o_prefixo():
    assert avaliar_coluna("VL_TOTAL", "DECIMAL").resultado == "conforme"
    assert avaliar_coluna("NR_NOTA", "VARCHAR", 5).resultado == "conforme"


@pytest.mark.parametrize("nome", ["", "   ", "CD_", "CD", "_X"])
def test_nomes_degenerados_sao_fora_sem_excecao(nome: str):
    r = avaliar_coluna(nome, "VARCHAR")
    assert r.resultado == "fora"
    assert r.problemas


def test_indicador_char1_no_db2_e_conforme():
    assert avaliar_coluna("IN_ATIVO", "CHARACTER", 1).resultado == "conforme"


def test_indicador_boolean_no_postgres_e_conforme():
    assert avaliar_coluna("IN_ATIVO", "boolean").resultado == "conforme"


def test_indicador_texto_maior_que_1_e_fora():
    assert avaliar_coluna("IN_ATIVO", "VARCHAR", 10).resultado == "fora"


def test_data_e_timestamp_distinguem_dominios():
    assert avaliar_coluna("DT_NASC", "DATE").resultado == "conforme"
    assert avaliar_coluna("DT_GRAV", "TIMESTAMP").resultado == "conforme"
    assert avaliar_coluna("DT_NASC", "INTEGER").resultado == "fora"


def test_id_com_escala_nao_numerica_nao_quebra():
    assert avaliar_coluna("ID_CLIENTE", "INTEGER", 4).resultado == "conforme"


def _av(resultado: str) -> Avaliacao:
    return Avaliacao(resultado=resultado, problemas=(), sugestao=None)  # type: ignore[arg-type]


def test_resumir_pondera_aviso_e_arredonda_para_cima():
    resumo = resumir([_av("conforme"), _av("conforme"), _av("aviso"), _av("fora")])
    assert (resumo.conformes, resumo.avisos, resumo.fora, resumo.total) == (2, 1, 1, 4)
    assert resumo.aplicavel is True
    assert resumo.percentual == 63


def test_resumir_usa_peso_configurado(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(settings, "CONFORMIDADE_PESO_AVISO", 0.0)
    assert resumir([_av("conforme"), _av("aviso")]).percentual == 50


def test_resumir_vazio_nao_divide_por_zero():
    resumo = resumir([])
    assert resumo.total == 0
    assert resumo.percentual is None


def test_resumo_nao_aplicavel():
    resumo = resumo_nao_aplicavel()
    assert resumo.aplicavel is False
    assert resumo.total == 0
    assert resumo.percentual is None


@pytest.mark.parametrize("tamanho", [256, 1500])
def test_descricao_varchar_com_tamanho_de_algum_dominio_e_conforme(tamanho: int):
    assert avaliar_coluna("DS_OBS", "VARCHAR", tamanho).resultado == "conforme"


@pytest.mark.parametrize("tamanho", [50, 300])
def test_descricao_varchar_com_tamanho_fora_dos_dominios_e_aviso(tamanho: int):
    r = avaliar_coluna("DS_OBS", "VARCHAR", tamanho)
    assert r.resultado == "aviso"
    assert r.sugestao is not None
    assert r.sugestao.dominio in {"DS_C", "DS_L"}
    assert "256" in r.problemas[0] or "1500" in r.problemas[0]


def test_descricao_varchar_aviso_aponta_dominio_mais_proximo():
    assert avaliar_coluna("DS_OBS", "VARCHAR", 300).sugestao.dominio == "DS_C"  # type: ignore[union-attr]
    assert avaliar_coluna("DS_OBS", "VARCHAR", 1400).sugestao.dominio == "DS_L"  # type: ignore[union-attr]


@pytest.mark.parametrize("tamanho", [None, 0])
@pytest.mark.parametrize("tipo", ["TEXT", "text", "CLOB"])
def test_descricao_texto_ilimitado_e_conforme(tipo: str, tamanho: int | None):
    assert avaliar_coluna("DS_OBS", tipo, tamanho).resultado == "conforme"


@pytest.mark.parametrize("tipo", ["text", "character varying"])
def test_tamanho_zero_do_postgres_nao_e_comparado(tipo: str):
    r = avaliar_coluna("NM_X", tipo, 0)
    assert r.resultado == "conforme"
    assert r.problemas == ()
