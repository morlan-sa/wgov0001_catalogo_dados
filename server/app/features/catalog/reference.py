"""Tabelas de referência da governança de dados da Morlan, usadas para inferir
camada, domínio de negócio e classificação a partir dos nomes — sem I/O.

São a taxonomia corporativa (24 domínios de negócio; os prefixos de coluna vêm de
`nomenclatura/regras.json`), não parâmetros de execução: por isso vivem aqui e
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

CLASSIFICACAO_LABELS: dict[str, str] = {
    "PUBLICO": "Público",
    "CORPORATIVO": "Corporativo",
    "RESTRITO": "Restrito",
    "SIGILOSO": "Sigiloso",
}
