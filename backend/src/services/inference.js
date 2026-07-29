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

export function listDominiosNegocio() {
  return Object.entries(DOMINIOS_NEGOCIO).map(([code, name]) => ({ code, name }));
}

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

const PREFIXO_DOMINIOS = {
  CD: 'Código',
  ID: 'Identificador',
  NM: 'Nome',
  DS: 'Descrição',
  DT: 'Data',
  HR: 'Hora',
  NR: 'Número',
  VL: 'Valor',
  VR: 'Valor Monetário',
  QT: 'Quantidade',
  IN: 'Indicador',
  TP: 'Tipo',
  ST: 'Situação',
  PC: 'Percentual',
  TEL: 'Telefone',
  EML: 'Email',
  CEP: 'CEP',
  UF: 'UF',
};

export function inferPrefixDomain(columnName) {
  const prefix = columnName.split('_')[0];
  return PREFIXO_DOMINIOS[prefix] || 'Não classificado';
}

export function inferCompletude(percentual) {
  if (percentual >= 90) return 'Excelente';
  if (percentual >= 70) return 'Bom';
  return 'Atenção';
}

const AUDIT_COLUMNS = new Set([
  'NM_ORIGEM_GRAVACAO',
  'DT_GRAV_DADOS',
  'NM_ORIGEM_ALTERACAO',
  'DT_ATU_DADOS',
  'IN_ATIVO',
  'DS_HASH_LINHA',
]);

export function isAuditColumn(columnName) {
  return AUDIT_COLUMNS.has(columnName.toUpperCase());
}
