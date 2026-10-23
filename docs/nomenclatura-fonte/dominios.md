# Domínios de Tipo de Dado — Padrão Morlan

| Domínio | Descrição | Tipo | Escala | Nulo | Exemplo |
|---|---|---|---|---|---|
| `CD_INT` | Código inteiro | INTEGER | — | N | `CD_PRODUTO = 1000256` |
| `CD_VAR` | Código varchar (alfanumérico) | VARCHAR | 20 | N | `CD_TRANSACAO = CX25006X` |
| `CEP` | CEP | VARCHAR | 8 | N | `CEP_CLIENTE = 14622210` |
| `CNPJ` | CNPJ | VARCHAR | 14 | N | `NR_CNPJ = 53999999000199` |
| `CPF` | CPF | VARCHAR | 11 | N | `NR_CPF = 12345678901` |
| `DS_C` | Descrição curta | VARCHAR | 256 | S | "descrição curta" |
| `DS_L` | Descrição longa | VARCHAR | 1500 | S | "descrição longa" |
| `DS_T` | Descrição texto (longuíssima) | TEXT | — | S | "descrição texto" |
| `DT` | Data | DATE | — | S | `DT_APONTAMENTO = 03/03/2026` |
| `DT_AM` | Data ano/mês | VARCHAR | 6 | S | `DT_ANO_MES_CIVIL = 202602` |
| `DT_TST` | Data/hora (timestamp) | TIMESTAMP | — | S | `DT_ATU_DADOS = 2026-02-27-14.04.27` |
| `EML` | E-mail | VARCHAR | 80 | S | `EML_CLIENTE = agostinho@empresa.com.br` |
| `HR` | Hora | TIME | — | S | `HR_APONTAMENTO = 11:30:00` |
| `ID` | Identificador único auto-incremento | INTEGER | AUTOINCREMENT | N | `ID_DOMINIO = 9999` |
| `IN` | Indicador de condição binária | BOOLEAN | — | N | `IN_CLIENTE_ATIVO = S` |
| `INS_UF` | Inscrição estadual | VARCHAR | 14 | N | `NR_INSC_ESTADUAL = 12345678901234 / ISENTO` |
| `NM` | Nome | VARCHAR | 128 | N | `NM_CLIENTE = CENTER MALHAS METALICAS` |
| `ST` | Situação ou status | VARCHAR | 20 | S | `ST_PAGAMENTO = APROVADO` |
| `TEL` | Telefone | VARCHAR | 11 | N | `TEL_FORNECEDOR = 16999999999` |
| `TP` | Tipo / classificação | VARCHAR | 20 | S | `TP_CLIENTE = PJ` |
| `UF` | Unidade federativa | VARCHAR | 2 | N | `UF_ENTREGA_MERCADORIA = SP` |

**Prefixos com mais de um domínio possível (perguntar qual variação antes de decidir):**

| Prefixo | Domínios candidatos | Critério de escolha |
|---|---|---|
| `CD_` | `CD_INT` (numérico puro) ou `CD_VAR` (alfanumérico) | O código tem letras/símbolos, ou é só número? |
| `DS_` | `DS_C` (256) / `DS_L` (1500) / `DS_T` (TEXT, sem limite) | Tamanho esperado do texto: curto, médio ou longo/livre? |
| `DT_` | `DT` (só data) / `DT_AM` (ano/mês, ex.: competência) / `DT_TST` (data + hora) | Precisa de hora? É uma competência (ano/mês) só? |

**Nota:** `ID_` (prefixo) e `ID` (domínio) não são a mesma coisa — o domínio `ID` define o tipo
físico (`INTEGER AUTOINCREMENT`) que normalmente acompanha uma coluna com prefixo `ID_`.
