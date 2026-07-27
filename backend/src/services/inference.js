const DOMINIOS_NEGOCIO = {
  COM: 'Comercial',
  FAT: 'Faturamento',
  FIN: 'Financeiro',
  CST: 'Custos',
  CTB: 'Contábil',
  FIS: 'Fiscal',
  CPR: 'Compras',
  SUP: 'Suprimentos',
  EST: 'Estoque',
  PRD: 'Produção',
  QUA: 'Qualidade',
  ENG: 'Engenharia',
  MAN: 'Manutenção',
  LOG: 'Logística',
  TRN: 'Transporte',
  EXP: 'Expedição',
  RHU: 'Recursos Humanos',
  SST: 'Segurança do Trabalho',
  CTR: 'Controladoria',
  AUD: 'Auditoria',
  GOV: 'Governança de Dados',
  TIN: 'Tecnologia da Informação',
  MKT: 'Marketing',
  IAM: 'Identidade e Controle de Acesso',
};

const CAMADA_PREFIXOS = ['STG', 'CUR', 'RPT'];

export function inferCamada(schemaName) {
  const prefix = schemaName.split('_')[0];
  return CAMADA_PREFIXOS.includes(prefix) ? prefix : 'LEGADO';
}

export function inferDominio(schemaName) {
  const parts = schemaName.split('_');
  const suffix = parts.length > 1 ? parts.slice(1).join('_') : null;
  if (suffix && DOMINIOS_NEGOCIO[suffix]) {
    return { code: suffix, name: DOMINIOS_NEGOCIO[suffix] };
  }
  return { code: 'NC', name: 'Não classificado' };
}

const CLASSIFICACAO_REGEX = /CLASSIFICA[^:]*:?\s*(PUBLICO|CORPORATIVO|RESTRITO|SIGILOSO)/i;

const CLASSIFICACAO_LABELS = {
  PUBLICO: 'Público',
  CORPORATIVO: 'Corporativo',
  RESTRITO: 'Restrito',
  SIGILOSO: 'Sigiloso',
};

export function inferClassificacao(remarks) {
  if (!remarks) return 'Não classificado';
  const match = remarks.toUpperCase().match(CLASSIFICACAO_REGEX);
  if (!match) return 'Não classificado';
  return CLASSIFICACAO_LABELS[match[1]] ?? 'Não classificado';
}
