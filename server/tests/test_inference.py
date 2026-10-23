"""Inferências puras de camada, domínio, classificação e completude — sem I/O."""

from __future__ import annotations

from app.features.catalog.inference import (
    infer_camada,
    infer_classificacao,
    infer_completude,
    infer_dominio,
    infer_prefix_domain,
    is_audit_column,
    list_dominios_negocio,
    round_half_up,
)


class TestCamadaEDominio:
    def test_camada_reconhece_prefixos_governados(self):
        assert infer_camada("STG_ERP") == "STG"
        assert infer_camada("CUR_COM") == "CUR"
        assert infer_camada("RPT_FIS") == "RPT"

    def test_camada_fora_do_padrao_e_legado(self):
        assert infer_camada("RCHUMANO") == "LEGADO"
        assert infer_camada("COMPRAS") == "LEGADO"

    def test_dominio_reconhece_sufixo_cadastrado(self):
        assert infer_dominio("CUR_COM") == {"code": "COM", "name": "Comercial"}
        assert infer_dominio("RPT_FIS") == {"code": "FIS", "name": "Fiscal"}

    def test_dominio_cai_em_nao_classificado_quando_sufixo_nao_bate(self):
        nc = {"code": "NC", "name": "Não classificado"}
        assert infer_dominio("STG_ERP") == nc
        assert infer_dominio("COMPRAS") == nc

    def test_lista_os_24_dominios_cadastrados(self):
        dominios = list_dominios_negocio()
        assert len(dominios) == 24
        assert {"code": "COM", "name": "Comercial"} in dominios
        assert {"code": "IAM", "name": "Identidade e Controle de Acesso"} in dominios


class TestClassificacao:
    def test_le_o_padrao_classificacao_no_remarks(self):
        assert infer_classificacao("Importador. Classificacao: RESTRITO") == "Restrito"
        assert infer_classificacao("NCM. Classificação: PUBLICO") == "Público"

    def test_tolera_encoding_corrompido_nos_acentos(self):
        assert infer_classificacao("Classifica��o: SIGILOSO") == "Sigiloso"

    def test_sem_remarks_ou_sem_padrao_nao_e_classificado(self):
        assert infer_classificacao(None) == "Não classificado"
        assert infer_classificacao("Uma tabela qualquer") == "Não classificado"


class TestColunaECompletude:
    def test_prefixo_de_coluna_cadastrado(self):
        assert infer_prefix_domain("ID_IMPORTADOR") == "Identificador"
        assert infer_prefix_domain("NR_CNPJ") == "Número"
        assert infer_prefix_domain("VR_TOTAL") == "Valor monetário"

    def test_rotulo_vem_das_regras_como_escrito_na_fonte(self):
        assert infer_prefix_domain("SG_UF") == "Não classificado"
        assert infer_prefix_domain("VL_PESO") == "Valor numérico"
        assert infer_prefix_domain("ST_PEDIDO") == "Situação/Status"
        assert infer_prefix_domain("pc_desconto") == "Porcentagem"

    def test_prefixos_novos_leg_e_vlx_sao_reconhecidos(self):
        assert infer_prefix_domain("LEG_CODIGO") == "Legado"
        assert infer_prefix_domain("VLX_MARGEM") == "Valor calculado"

    def test_prefixo_desconhecido_nao_e_classificado(self):
        assert infer_prefix_domain("FOOBAR_XYZ") == "Não classificado"
        assert infer_prefix_domain("SEMPREFIXO") == "Não classificado"

    def test_classes_de_completude(self):
        assert infer_completude(100) == "Excelente"
        assert infer_completude(90) == "Excelente"
        assert infer_completude(89) == "Bom"
        assert infer_completude(70) == "Bom"
        assert infer_completude(69) == "Atenção"
        assert infer_completude(0) == "Atenção"

    def test_colunas_de_auditoria(self):
        for nome in (
            "NM_ORIGEM_GRAVACAO",
            "DT_GRAV_DADOS",
            "NM_ORIGEM_ALTERACAO",
            "DT_ATU_DADOS",
            "IN_ATIVO",
            "DS_HASH_LINHA",
        ):
            assert is_audit_column(nome)
        assert not is_audit_column("ID_PAIS")
        assert not is_audit_column("NR_CNPJ")

    def test_arredondamento_meio_para_cima_como_o_math_round(self):
        assert round_half_up(12.5) == 13
        assert round_half_up(0.5) == 1
        assert round_half_up(98.41) == 98
        # round() do Python daria 12 (par mais próximo) — é o que se evita.
        assert round(12.5) == 12
