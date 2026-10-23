# Catálogo de Dados — documentação de negócio

**Projeto:** `wgov0001_catalogo_dados` · **Domínio:** Governança de Dados (GOV) · **Origem:** PoC `WGOV0001`
(Node/Express + React), convertido para o padrão BFF da Morlan.

> **Como este documento foi produzido.** Não há especificação de negócio escrita para o PoC além do
> desenho de 27/07/2026 (`docs/superpowers/` do repositório de origem). As regras abaixo foram
> **extraídas do código** e dos testes do PoC e conferidas contra o código novo. Cada regra aponta
> onde vive. **Precisam ser validadas por quem responde pela governança de dados** — onde a
> regra é uma escolha de implementação, e não uma decisão de negócio, está dito.

## 1. Para que serve

Dar à Governança de Dados e às áreas uma forma de **navegar o catálogo do DB2 sem pedir ao DBA**:
quais schemas existem, quais tabelas e colunas, o que cada uma significa (comentários cadastrados),
a que domínio de negócio pertencem, qual a classificação da informação e **quão bem preenchidos
estão os dados**. É uma consulta ao vivo: nada é copiado nem gravado.

## 2. Regras de negócio

### 2.1 Origem e escopo dos dados

| # | Regra | Onde vive |
|---|---|---|
| **N1** | O catálogo é lido **ao vivo** das tabelas de sistema do DB2 (`SYSCAT.TABLES`, `SYSCAT.COLUMNS`, `SYSCAT.TABCONST`/`KEYCOLUSE`). O app **nunca grava** nada — nem no DB2, nem em tabela própria. | `server/app/db/db2.py` |
| **N2** | Schemas de sistema (nome começando com `SYS`) **não aparecem** no catálogo. Só tabelas (`T`) e views (`V`) são catalogadas. | `schemas/service.py`, `catalog/service.py` |
| **N3** | Qualquer comando que não seja `SELECT`/`WITH` é **recusado antes** de abrir conexão com o DB2. | `db2.py` (`Db2ReadOnlyError`) |
| **N4** | A descrição de uma tabela/coluna é o **comentário (`REMARKS`) já cadastrado no DB2**. Sem comentário, a tela mostra "Sem descrição cadastrada" — o app não inventa descrição. | `catalog/service.py` |

### 2.2 Camada, domínio e classificação (inferidos, nunca gravados)

| # | Regra | Exemplo |
|---|---|---|
| **N5 — Camada** | Schema que começa com `STG_`, `CUR_` ou `RPT_` pertence à camada **STG**, **CUR** ou **RPT** (schemas *governados*). Qualquer outro é **LEGADO**. | `CUR_COM` → CUR · `COMPRAS` → LEGADO |
| **N6 — Domínio de negócio** | O **sufixo** do schema (o que vem depois do primeiro `_`) é procurado nos 24 domínios corporativos. Se bate, o schema é daquele domínio; se não, é **"Não classificado" (NC)**. | `CUR_COM` → Comercial · `STG_ERP` → NC |
| **N7 — Classificação da informação** | Procura no comentário da tabela o texto `Classificação: X`, com X ∈ {PÚBLICO, CORPORATIVO, RESTRITO, SIGILOSO}. Tolera falta de acento e acento corrompido. Sem o padrão, é **"Não classificado"** — nunca se assume uma classificação. | `…Classificacao: RESTRITO` → Restrito |
| **N8 — Domínio da coluna** | O **prefixo** do nome da coluna indica seu domínio: `CD` Código, `ID` Identificador, `NM` Nome, `DS` Descrição, `DT` Data, `HR` Hora, `NR` Número, `VL` Valor, `VR` Valor Monetário, `QT` Quantidade, `IN` Indicador, `TP` Tipo, `ST` Situação, `PC` Percentual, `TEL` Telefone, `EML` Email, `CEP`, `UF`. Prefixo desconhecido → "Não classificado". | `NR_CNPJ` → Número |

**Os 24 domínios corporativos:** Comercial (COM), Faturamento (FAT), Financeiro (FIN), Custos (CST),
Contábil (CTB), Fiscal (FIS), Compras (CPR), Suprimentos (SUP), Estoque (EST), Produção (PRD),
Qualidade (QUA), Engenharia (ENG), Manutenção (MAN), Logística (LOG), Transporte (TRN), Expedição
(EXP), Recursos Humanos (RHU), Segurança do Trabalho (SST), Controladoria (CTR), Auditoria (AUD),
Governança de Dados (GOV), Tecnologia da Informação (TIN), Marketing (MKT), Identidade e Controle de
Acesso (IAM).

> **Atenção (N6):** o sufixo é comparado ao código do domínio **em maiúsculas e exato**. Um schema
> legado cujo nome termina por acaso em, por exemplo, `_LOG` seria lido como Logística. É uma
> consequência da regra, não um erro de implementação — mas vale a Governança saber.

### 2.3 Saúde dos dados (completude)

| # | Regra |
|---|---|
| **N9 — Completude de uma coluna** | `registros preenchidos ÷ total de registros`, em %, **arredondado de .5 para cima**. Em coluna de texto, **texto vazio ou só espaços conta como não preenchido**. Tabela sem registros conta como **100 %**. |
| **N10 — Colunas de auditoria ficam de fora** | `NM_ORIGEM_GRAVACAO`, `DT_GRAV_DADOS`, `NM_ORIGEM_ALTERACAO`, `DT_ATU_DADOS`, `IN_ATIVO` e `DS_HASH_LINHA` são metadados de controle do ETL, não dado de negócio. Um registro nunca atualizado ter `DT_ATU_DADOS` vazio é normal. **Não entram** no cálculo e mostram "-" na tela. |
| **N11 — Saúde da tabela** | **Média simples** da completude das colunas de negócio, arredondada. Tabela só com colunas de auditoria → 100 %. |
| **N12 — Classe de saúde** | **Excelente** ≥ 90 % · **Bom** de 70 % a 89 % · **Atenção** < 70 %. *(Os limiares 90 e 70 são parâmetro de configuração, não regra fixa.)* |
| **N13 — Saúde da governança (dashboard)** | Calculada **só sobre os schemas governados (STG/CUR/RPT)**, todas as suas tabelas e views, sem amostragem. Mostra a média geral e a média por schema. Legado **não entra**: nunca seguiu as convenções de governança. |
| **N14 — Saúde do legado (dashboard)** | A mesma métrica, mas sobre uma **amostra das menores tabelas** (por cardinalidade estatística do DB2; tabela sem estatística vale como grande) de cada schema legado — no máximo 5 por schema, tentando até 20 candidatas. Existe porque uma única tabela legada pode ter milhões de linhas e varrer todas é inviável. Só tabelas reais (não views). Uma candidata que falha (sem permissão, ou mais de 5 s) é **descartada** e a próxima é tentada. |
| **N15 — Schemas sem acesso** | Schema legado em que o usuário do DB2 não consegue ler **nenhuma** tabela da amostra não aparece no gráfico; é listado à parte como "sem acesso". É um limite de permissão, não falha. |

> **Escolha de implementação (N14), não regra de negócio:** "menores tabelas" amostra tabelas
> pequenas, que podem ser tabelas de apoio e **não representar** a qualidade do schema inteiro. A
> saúde do legado é uma **indicação**, não uma medida censitária. A Governança deve decidir se isso
> basta.

### 2.4 Navegação e acesso

| # | Regra |
|---|---|
| **N16** | A navegação é **Catálogo → Schema → Tabela**, com busca de schema, busca de tabela/descrição e **busca de coluna em todas as tabelas** (máx. 200 resultados; acima disso a tela pede para refinar). |
| **N17 — Scanner** | Escolhe quais schemas explorar: *governados* (tudo que não é legado), *todos* ou *manual*. "Escanear" aqui é **consultar agora** — não grava nada. |
| **N18** | **Domínios** mostra os 24 domínios com quantos schemas e objetos do DB2 usam cada um; só domínios em uso abrem o detalhe. A lista é ordenada alfabeticamente, ignorando acento. |
| **N19 — Acesso** | Só entra quem **tem sessão** (SSO corporativo) **e** acesso a esta aplicação no portal Morlan Access (funcionalidade `ACESSO_APP`). Ter o link não basta. |
| **N20 — Listagens** | Listagens com volume são **paginadas e pesquisáveis**, em vez de rolagem longa. |

## 3. Mensagens ao usuário

| Mensagem | Quando aparece |
|---|---|
| "Sem descrição cadastrada" | tabela ou coluna sem `REMARKS` no DB2 |
| "Não classificado" | classificação/domínio/camada não inferível pelas regras N6–N8 |
| "calculando…" / "Calculando (pode levar alguns segundos)…" | saúde sendo apurada no DB2 |
| "saúde: -" | a saúde daquela tabela não pôde ser calculada (ex.: sem permissão de leitura) |
| "Nenhuma coluna/tabela/schema encontrado" | busca sem resultado |
| "Tabela X.Y não encontrada" (404) | tabela inexistente no schema |
| "Schema ou tabela inválidos" (400) | nome com caracteres fora de `A–Z`, `0–9`, `_` |
| "Erro interno do servidor" | falha inesperada (o detalhe técnico fica só no log) |

## 4. Regras que mudaram na conversão para o padrão Morlan

| # | Antes (PoC) | Agora | Por quê |
|---|---|---|---|
| **M1** | Sem autenticação (uso em rede local; AD "em outro projeto"). | SSO Keycloak + gate de acesso por aplicação (N19). | Padrão Morlan para toda aplicação web; segregação de acesso. |
| **M2** | Credenciais do DB2 lidas de um caminho fixo (`C:/Morlan_Python/Explorar/.env`). | Credenciais só em `server/.env` / Secrets Manager. | Zero hardcode; o caminho era específico de uma máquina. |
| **M3** | Cards roláveis. | Tabelas **paginadas com pesquisa** (N20). | Norma de telas: paginação em vez de rolagem longa. |
| **M4** | Saúde de **todas** as tabelas do schema disparada de uma vez pelo navegador (com fila de 6). | Só das **linhas da página visível** (≈ 10). | A paginação limita sozinha a carga de varreduras no DB2. |
| **M5** | Limites e limiares fixos no código (200, 90/70, concorrências, colunas de auditoria). | Parâmetros de configuração (`server/.env`). | Zero hardcode. |
| **M6** | Teste de integração contra o DB2 real. | Testes unitários offline (DB2 simulado). | Reprodutíveis; não dependem de dados que mudam. |
| **M7** | Descontinuado: marcador "🔑" para chave primária. | Texto "Sim" na coluna PK. | Acessibilidade (não depende de emoji). |

## 5. Pontos para a Governança validar

1. **N6** — a regra do sufixo gera falso positivo em schema legado (aviso acima). Aceita-se ou exige-se lista de exceções?
2. **N14** — a amostra das menores tabelas serve como "saúde do legado"?
3. **N12** — 90 % / 70 % são os limiares corporativos?
4. **N7** — o texto `Classificação: X` no comentário é o padrão oficial de classificação?
5. **N10** — a lista das 6 colunas de auditoria está completa (há outras colunas de controle)?
