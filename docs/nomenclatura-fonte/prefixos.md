# Prefixos de Atributo — Padrão Morlan

| Prefixo | Significado | Exemplo / uso |
|---|---|---|
| `CD_` | Código | Código único ou referência numérica/alfa para uma entidade |
| `CEP_` | CEP | Campo destinado ao código de endereçamento postal |
| `DS_` | Descrição | Texto explicativo ou complementar |
| `DT_` | Data | Representa datas |
| `EML_` | E-mail | Endereço eletrônico de contato |
| `HR_` | Hora | Representa apenas a hora |
| `ID_` | Identificador | Identificador único interno (registro) |
| `IN_` | Indicador | Responde a uma condição binária: S ou N, V ou F, 1 ou 0 |
| `LEG_` | Legado | Prefixo ref. a colunas do legado |
| `NM_` | Nome | Nome próprio ou fantasia de pessoas, empresas, produtos etc. |
| `NR_` | Número | Número identificável |
| `PC_` | Porcentagem | Representa percentuais (%) |
| `QT_` | Quantidade | Indica quantidade física, contável ou planejada |
| `ST_` | Situação/Status | Informa uma situação ou status |
| `TEL_` | Telefone | Número de telefone |
| `TP_` | Tipo | Informa um tipo de classificação |
| `UF_` | UF | Unidade federativa (estado brasileiro) |
| `VL_` | Valor numérico | Valores numéricos gerais, não monetário |
| `VR_` | Valor monetário | Valores financeiros em moeda |
| `VLX_` | Valor calculado | Valores de um cálculo, envolvendo 2 ou mais colunas |

**Mapeamento semântico → prefixo (quando o termo não vem já padronizado):**

| Termo comum | Prefixo |
|---|---|
| CODIGO, COD | `CD_` |
| IDENTIFICADOR, ID | `ID_` |
| NOME | `NM_` |
| DESCRICAO | `DS_` |
| DATA | `DT_` |
| HORA | `HR_` |
| NUMERO, NUM | `NR_` |
| VALOR (não monetário) | `VL_` |
| VALOR (monetário) | `VR_` |
| VALOR CALCULADO (2+ colunas) | `VLX_` |
| QUANTIDADE, QTD | `QT_` |
| INDICADOR, FLAG | `IN_` |
| TIPO, TP | `TP_` |
| SITUACAO, STATUS | `ST_` |
| PERCENTUAL, PERC | `PC_` |
| TELEFONE, TEL | `TEL_` |
| EMAIL | `EML_` |
| CEP | `CEP_` |
| UF, ESTADO | `UF_` |
| CAMPO DO SISTEMA LEGADO | `LEG_` |

**Termos ambíguos entre dois prefixos — sempre perguntar, nunca assumir:**

| Termo ambíguo | Opções | Pergunta a fazer |
|---|---|---|
| número, código | `NR_` (identificável, ex.: nº de nota/OS) ou `CD_` (código de entidade) | "É um número de documento ou um código de cadastro?" |
| margem, taxa, índice | `VL_` (valor absoluto) ou `PC_` (percentual) | "É um valor absoluto ou um percentual?" |
| nome/descrição curta | `NM_` (nome próprio) ou `DS_` (descrição) | "É o nome de algo (pessoa/produto) ou uma descrição livre?" |
