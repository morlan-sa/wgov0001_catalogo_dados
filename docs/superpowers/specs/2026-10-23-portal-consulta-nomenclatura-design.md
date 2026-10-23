# Catálogo de Dados como portal de consulta: nomenclatura, conformidade, filtros e busca por semelhança

Data: 2026-10-23 · Projeto: `wgov0001_catalogo_dados` · Status: **rascunho para aprovação**

Convenção deste documento: o que **você decidiu** vem marcado como *(decisão)*. O que foi **escolha minha**
vem marcado como *(minha escolha)* e pode ser trocado.

## 1. Intenção

Hoje o catálogo permite navegar schema → tabela → coluna, mas não ajuda a responder as perguntas
do dia a dia: "isso já existe?", "posso reaproveitar?", "está no padrão da Morlan?". O objetivo é
transformá-lo em um portal de consulta que responde a essas três perguntas, tanto para pessoas
quanto para uma skill que consulta o catálogo antes de criar um campo ou uma tabela nova.

Quem usa *(decisão)*:

| Quem | O que quer resolver |
|---|---|
| Analista de BI | Existe um dado sobre X? Posso confiar nele? |
| Quem desenvolve | Essa coluna ou tabela já existe? Que nome e tipo devo usar? |
| Dono do dado | O que publiquei está documentado, classificado e saudável? |
| Auditoria | O que está fora do padrão? Onde se criou duplicado? |
| Skill (programática) | Antes de criar campo ou tabela: já existe? Dá para reaproveitar? Está no padrão? |

## 2. Objetivos, não objetivos e anti-objetivos

**Prioridades da primeira entrega** *(decisão)*: (1) conformidade de nomenclatura, (2) filtros,
(3) busca por semelhança.

**Objetivos**
- Uma única fonte de regras de nomenclatura, usada pela tela, pela conformidade e pela API da skill, para que nunca divirjam.
- Página "Padrões de Nomenclatura" com validador interativo e consulta aos padrões.
- Selo de conformidade por coluna, por tabela e por schema.
- Home do catálogo com busca global, filtros facetados e busca por semelhança.
- API de consulta para a skill (existe? reaproveitar? está no padrão?).

**Não objetivos desta entrega**
- Dono/steward, linhagem, amostra de dados e marcação de dado pessoal (LGPD): o catálogo não tem essas informações e não há onde guardá-las hoje.
- Baixar DDL e favoritar: aparecem no mockup, mas ficam para uma fase posterior *(minha escolha)*. A geração de DDL já é de uma skill própria (SKTIGEN0007) e não deve ser duplicada aqui.
- Criar prefixo ou domínio novo: é decisão de governança (TI-Governança de Dados). O portal só informa que o termo não está cadastrado.
- Alterar a skill geradora de DDL: ela fica fora deste repositório.

**Anti-objetivos (seria fracasso mesmo que tecnicamente funcione)**
- A skill ou o portal gravarem algo no banco de dados corporativo (DB2/Postgres do catálogo). O catálogo continua somente leitura.
- Mostrar número ou sugestão inventada. Se não há dado, a tela diz que não há.
- Divergência entre o que a tela diz estar "no padrão" e o que a API diz à skill.

## 3. Regras de comportamento

### 3.1 Nomenclatura (fonte: skill SKTIARQ0001) *(decisão: consultar sempre a skill para atualizações)*
- Prefixos (20, incluindo `LEG_` e `VLX_`), domínios de tipo (21) e domínios de negócio (24).
- Termo ambíguo (`NR_`/`CD_`, `VL_`/`PC_`, `NM_`/`DS_`) ou prefixo com mais de um domínio (`CD_`, `DS_`, `DT_`): o validador **pergunta**, nunca assume. Termo sem prefixo ou domínio compatível: informa que não está cadastrado e sugere o mais próximo.
- O código atual ([reference.py](../../../server/app/features/catalog/reference.py)) tem 18 prefixos e nenhum domínio de tipo. Essa tabela passa a ser alimentada pelo módulo novo.
- *(minha escolha)* A fonte é um arquivo JSON versionado no repositório, gerado a partir das referências da skill, com campo de versão e data. Atualizar é um PR. O motivo: a skill vive na máquina de quem usa Claude, e o servidor em produção não a enxerga. A tela mostra "Fonte: SKTIARQ0001 vX.Y (data)".

### 3.2 Conformidade
- Por coluna: prefixo reconhecido; tipo e tamanho compatíveis com o domínio de tipo. Resultados: conforme, aviso (ex.: tamanho diferente do padrão) ou fora do padrão, sempre com a sugestão de correção.
- Por tabela e schema: percentual de colunas conformes.
- Colunas de auditoria (`AUDIT_COLUMNS`) ficam fora do cálculo, como já ficam na saúde dos dados.
- *(minha escolha)* Schemas e tabelas **LEGADO** aparecem como "não aplicável" no percentual, porque o legado não nasceu no padrão. A busca continua mostrando a sugestão de nome.
- *(minha escolha)* Mostrar também o indicador "documentação" (colunas com descrição), porque é barato e responde a pergunta do dono do dado.

### 3.3 Busca e filtros *(decisão: layout C)*
- Home do catálogo: busca grande no topo, filtros laterais recolhíveis, resultados em lista com selo de conformidade e, quando há busca, a similaridade com o termo.
- Filtros: camada, domínio de negócio, classificação, faixa de conformidade, só com descrição. O estado fica na URL, para compartilhar uma busca.
- Atalho Ctrl+K abre a busca de qualquer página.
- Busca por semelhança: normaliza o termo (maiúsculas, sem acento), expande abreviações e prefixos conhecidos ("cód", "cod" → `CD_`) e compara com nomes e descrições. "cód. fornecedor" deve achar `CD_FORNECEDOR`.
- *(minha escolha)* A semelhança é calculada no próprio servidor sobre a lista de colunas já em cache, sem extensão de banco, porque o catálogo pode vir de DB2 ou de Postgres.

### 3.4 API para a skill *(decisão sobre o comportamento)*
Fluxo da skill: valida o nome e o tipo, procura candidatos de reaproveitamento. Se houver candidato forte, **recomenda reaproveitar**. Se quem pediu recusar, a skill **pede uma justificativa**, e essa justificativa **vai documentada no cabeçalho do DDL**.

O que o portal entrega para isso:
- Validação de nome e tipo, com a pergunta de desambiguação quando houver.
- Busca de reuso para coluna e para tabela (sobreposição de colunas), com identificação completa do candidato (schema, tabela, coluna, tipo, descrição, similaridade, completude, classificação, link) e a data/hora da consulta, em formato pronto para citar no cabeçalho.
- Somente leitura.
- Rotas previstas (nomes podem mudar): `POST /api/nomenclatura/validar`, `GET /api/nomenclatura`, `GET /api/catalog/reuso`, `POST /api/catalog/reuso/tabela`. A busca global da home usa `GET /api/catalog/search`.

## 4. Restrições

- Segue o padrão BFF da Morlan descrito em [CLAUDE.md](../../../CLAUDE.md): vertical slices em `server/app/features/`, componentes do `@morlan/ui` antes de criar os próprios, JSON em snake_case mapeado para camelCase no front, testes offline com a consulta ao catálogo simulada, mesmas regras para DB2 e Postgres.
- Desempenho: a latência até o banco domina o custo (~130 ms por consulta). A lista completa de tabelas e colunas para busca e semelhança deve vir de poucas consultas, com o cache TTL já existente.
- Autenticação: hoje toda rota exige sessão de navegador (cookie Keycloak). A skill não consegue isso. *(minha escolha)* Aceitar também `Authorization: Bearer` de uma conta de serviço somente leitura. Criar essa conta e as permissões é trabalho de infraestrutura, fora deste repositório; este projeto só deixa o ponto preparado e documentado.
- Texto da interface em português, com acentuação.

## 5. Fases propostas

1. **Núcleo de nomenclatura:** JSON de regras, módulo de validação, `GET /api/nomenclatura`, `POST /api/nomenclatura/validar`, página `/nomenclatura` (validador + abas de consulta).
2. **Conformidade no catálogo:** cálculo por coluna/tabela/schema, selos e sugestões no detalhe da tabela e na lista de tabelas do schema.
3. **Busca e filtros:** `GET /api/catalog/search`, similaridade, filtros facetados, home nova, Ctrl+K.
4. **API da skill:** rotas de reuso, resposta pronta para o cabeçalho, autenticação por token de serviço (parte de código).
5. **Depois, se aprovado:** registro de consultas e recusas justificadas para a auditoria (seria a primeira tabela gravada pelo app, no schema `cur_gov`), favoritos, exportações.

Cada fase deve ser entregável e testável sozinha.

## 6. Decisões de detalhe (minha escolha, após revisão)

Todas podem ser trocadas; estão aqui para o construtor não precisar adivinhar.

1. **Fonte das regras.** As três referências da skill estão copiadas em
   [docs/nomenclatura-fonte/](../../nomenclatura-fonte/) (prefixos, domínios de tipo, domínios de negócio, com a
   versão e a data da cópia). O JSON do app é gerado a partir delas. A tela mostra essa versão e essa data.
2. **Regra de conformidade de tipo e tamanho.**
   - Prefixo → domínios de tipo candidatos, conforme as tabelas da fonte. Os prefixos `NR_`, `VL_`, `VR_`, `PC_`,
     `QT_`, `LEG_` e `VLX_` **não têm domínio de tipo** na fonte: para eles só o prefixo é validado, e a tela
     não inventa tipo esperado.
   - Tipos são comparados por **família** (texto, inteiro, decimal, data, hora, data/hora, booleano), e não pelo
     nome exato, para valer em DB2 e em Postgres (`VARCHAR`/`CHARACTER VARYING`, `TIMESTAMP`…).
   - Família diferente da esperada → *fora do padrão*. Mesma família com tamanho diferente do padrão → *aviso*.
     Mesma família e tamanho → *conforme*.
3. **Prefixo com mais de um domínio (`CD_`, `DS_`, `DT_`).** Numa coluna que já existe não há quem responda.
   A coluna é *conforme* se bate com **qualquer** dos domínios candidatos; senão, segue a regra do item 2 contra o
   mais próximo. Não existe o estado "indeterminado" no percentual. A pergunta de desambiguação existe só no
   validador de nome livre e na API da skill.
4. **Percentual de conformidade.** Conforme conta 1, aviso conta 0,5, fora do padrão conta 0, sobre as colunas de
   negócio (sem auditoria). Tabelas e schemas LEGADO ficam como "não aplicável".
5. **Conformidade sob demanda ou em lote.** Usa só metadados. Reaproveita a mesma consulta única de colunas da
   busca (item 7), em cache, cobrindo o catálogo inteiro; o filtro por faixa e o selo na lista funcionam sobre
   todos os resultados. A primeira carga a frio pode demorar; as seguintes vêm do cache.
6. **"Candidato forte".** O servidor devolve a similaridade numérica **e** um rótulo (`forte`, `medio`, `fraco`)
   com limiares configuráveis em `Settings`. A skill usa o rótulo para recomendar reaproveitar. Para tabela, a
   sobreposição é o índice de Jaccard sobre os nomes de coluna normalizados, e a resposta traz também as
   contagens (colunas em comum / total).
7. **Escala e candidatos.** A ordem de grandeza de tabelas e colunas não é conhecida. A **primeira tarefa da
   fase 3** é medir (uma consulta de contagem ao catálogo) e só então fixar o desenho do cache. Schemas LEGADO
   podem ser candidatos de reuso, sempre marcados com a camada. Schemas ou tabelas sem permissão de leitura
   aparecem só pela estrutura. A completude de cada candidato vem **do cache de saúde, se já existir**; senão
   vem vazia. Nunca se varre uma tabela na hora da consulta de reuso.
8. **Autenticação por token (fase 4).** Preferência: JWT emitido pelo Keycloak (client credentials), validado
   por JWKS e issuer. O construtor deve verificar primeiro se a `morlan-access-lib` já suporta Bearer. **Se não
   suportar, a fase 4 não escreve validação de token própria**: fica pendente de decisão com o time da lib e da
   infraestrutura. A conta de serviço precisa passar pelo gate `ACESSO_APP` como qualquer usuário.
9. **Link do candidato.** Absoluto a partir de `FRONTEND_URL`, com caminho relativo como alternativa quando essa
   variável estiver vazia.

## 7. O que fica para quem for construir

Algoritmo exato de similaridade e dos pesos; estrutura interna do JSON de regras; texto das mensagens de
conformidade; organização dos componentes do front; formato exato da resposta de reuso, desde que
contenha o que está na seção 3.4.
