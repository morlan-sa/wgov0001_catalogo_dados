import pytest

from app.features.nomenclatura.service import validar_nome


def test_normaliza_minusculas_acento_e_espaco():
    v = validar_nome(" cód fornec ")
    assert v.nome == "COD_FORNEC"
    assert v.avaliacao.resultado == "fora"
    assert v.avaliacao.sugestao is not None
    assert v.avaliacao.sugestao.nome == "CD_FORNEC"

    v = validar_nome("cd_fornec")
    assert v.nome == "CD_FORNEC"
    assert v.avaliacao.resultado == "conforme"


def test_numero_dispara_ambiguidade():
    v = validar_nome("NUMERO_NOTA")
    assert v.ambiguidade is not None
    assert "NR" in v.ambiguidade.opcoes
    assert "CD" in v.ambiguidade.opcoes


def test_cod_nao_dispara_ambiguidade():
    assert validar_nome("COD_FORNEC").ambiguidade is None
    assert validar_nome("NUM_NOTA").ambiguidade is None


def test_cd_sem_tipo_pergunta_dominio():
    v = validar_nome("CD_FORNEC")
    assert v.dominios_candidatos == ("CD_INT", "CD_VAR")


def test_cd_com_varchar_nao_pergunta():
    v = validar_nome("CD_FORNEC", "VARCHAR", 20)
    assert v.dominios_candidatos == ()


def test_entrada_estranha_nao_levanta():
    for nome in ("", "   ", "_", "___", "XYZ_ABC"):
        v = validar_nome(nome)
        assert v.ambiguidade is None
        assert v.dominios_candidatos == ()
    assert validar_nome("").avaliacao.resultado == "fora"


@pytest.mark.parametrize(
    ("nome", "opcoes"),
    [
        ("NUMERO_NOTA", ("NR", "CD")),
        ("número_nota", ("NR", "CD")),
        ("NOME_CLIENTE", ("NM", "DS")),
        ("descrição curta x", ("NM", "DS")),
        ("MARGEM_LUCRO", ("VL", "PC")),
        ("TAXA_JURO", ("VL", "PC")),
        ("INDICE_X", ("VL", "PC")),
    ],
)
def test_ambiguidade_por_termo(nome, opcoes):
    v = validar_nome(nome)
    assert v.ambiguidade is not None
    assert v.ambiguidade.opcoes == opcoes


@pytest.mark.parametrize("nome", ["DESCRICAO_X", "COD_X", "NUM_X"])
def test_sem_ambiguidade(nome):
    assert validar_nome(nome).ambiguidade is None


@pytest.mark.parametrize(
    "nome", ["NUMERO_NOTA", "CODIGO_X", "NOME_CLIENTE", "descrição curta x"]
)
def test_ambiguo_nao_assume_nome_sugerido(nome):
    # Spec 3.1: o validador pergunta, nunca assume — sem nome sugerido.
    v = validar_nome(nome)
    assert v.ambiguidade is not None
    assert v.avaliacao.resultado == "fora"
    assert v.avaliacao.problemas
    assert v.avaliacao.sugestao is None or v.avaliacao.sugestao.nome is None


@pytest.mark.parametrize(
    ("nome", "tipo", "tamanho", "resultado"),
    [
        ("CD_X", "VARCHAR(50)", None, "aviso"),  # CD_VAR é 20
        ("NM_X", "VARCHAR(100)", None, "aviso"),  # NM é 128
        ("NM_X", "VARCHAR(128)", None, "conforme"),
        ("CD_X", "VARCHAR(20)", None, "conforme"),
        ("CD_X", "varchar ( 50 )", None, "aviso"),
        ("NM_X", "DECIMAL(10,2)", None, "fora"),
        ("CD_X", "VARCHAR(abc)", None, None),
        ("CD_X", "VARCHAR()", None, None),
        ("CD_X", "VARCHAR(²)", None, None),  # dígito sobrescrito: isdigit() é True
        ("CD_X", "VARCHAR(" + "9" * 5000 + ")", None, None),  # > 4300 dígitos
        ("CD_X", "VARCHAR(99999999999)", None, None),  # absurdo: não é tamanho
        ("CD_X", "VARCHAR(50)", 20, "conforme"),  # tamanho explícito vence
    ],
)
def test_tipo_com_tamanho_embutido(nome, tipo, tamanho, resultado):
    v = validar_nome(nome, tipo, tamanho)
    if resultado is not None:
        assert v.avaliacao.resultado == resultado
