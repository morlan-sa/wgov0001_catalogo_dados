"""Tabelas de referência da governança de dados da Morlan, usadas para inferir
camada, domínio de negócio e domínio de coluna a partir dos nomes — sem I/O.

São a taxonomia corporativa (24 domínios de negócio e os prefixos de coluna da
convenção de nomenclatura), não parâmetros de execução: por isso vivem aqui e
não em `Settings`. Os parâmetros (limiares de saúde, colunas de auditoria,
limites) ficam em `app/config.py`.
"""

DOMINIOS_NEGOCIO: dict[str, str] = {
    "COM": "Comercial",
    "FAT": "Faturamento",
    "FIN": "Financeiro",
    "CST": "Custos",
    "CTB": "Contábil",
    "FIS": "Fiscal",
    "CPR": "Compras",
    "SUP": "Suprimentos",
    "EST": "Estoque",
    "PRD": "Produção",
    "QUA": "Qualidade",
    "ENG": "Engenharia",
    "MAN": "Manutenção",
    "LOG": "Logística",
    "TRN": "Transporte",
    "EXP": "Expedição",
    "RHU": "Recursos Humanos",
    "SST": "Segurança do Trabalho",
    "CTR": "Controladoria",
    "AUD": "Auditoria",
    "GOV": "Governança de Dados",
    "TIN": "Tecnologia da Informação",
    "MKT": "Marketing",
    "IAM": "Identidade e Controle de Acesso",
}

# Prefixos de schema que seguem o padrão de governança (STG_/CUR_/RPT_);
# qualquer outro schema é LEGADO.
CAMADAS_GOVERNADAS: tuple[str, ...] = ("STG", "CUR", "RPT")
CAMADA_LEGADO = "LEGADO"

DOMINIO_NAO_CLASSIFICADO_CODE = "NC"
NAO_CLASSIFICADO = "Não classificado"

PREFIXO_DOMINIOS: dict[str, str] = {
    "CD": "Código",
    "ID": "Identificador",
    "NM": "Nome",
    "DS": "Descrição",
    "DT": "Data",
    "HR": "Hora",
    "NR": "Número",
    "VL": "Valor",
    "VR": "Valor Monetário",
    "QT": "Quantidade",
    "IN": "Indicador",
    "TP": "Tipo",
    "ST": "Situação",
    "PC": "Percentual",
    "TEL": "Telefone",
    "EML": "Email",
    "CEP": "CEP",
    "UF": "UF",
}

CLASSIFICACAO_LABELS: dict[str, str] = {
    "PUBLICO": "Público",
    "CORPORATIVO": "Corporativo",
    "RESTRITO": "Restrito",
    "SIGILOSO": "Sigiloso",
}
