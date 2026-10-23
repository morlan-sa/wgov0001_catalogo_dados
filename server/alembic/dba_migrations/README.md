# SQL para DBAs aplicarem à mão

Em ambientes onde o usuário de banco da própria aplicação não tem permissão
de DDL, um DBA aplica as mudanças de schema manualmente. Este diretório é
esse artefato: SQL puro, gerado a partir das migrations Alembic reais
(`server/alembic/versions/`), para o DBA revisar e rodar com `psql`. Nenhuma
ferramenta de migração (Alembic incluído) é instalada ou executada no
ambiente do DBA — só os arquivos `.sql`.

Ao contrário do `rnc2/server` (que agrupa migrations por domínio via
dicionários hardcoded, porque tem uma baseline squashed com dezenas de
tabelas e renames históricos que quebram a ordem cronológica), este projeto
tem uma cadeia linear e pequena de revisions: o mapeamento é 1:1, uma
revision Alembic → um arquivo aqui, nomeado com o próprio id da revision, na
mesma ordem cronológica em que foram criadas. Se este projeto crescer a
ponto de precisar de agrupamento por domínio ou reordenação, o script do
rnc2 (`rnc2/server/scripts/split_migration_sql.py`) é a referência a
seguir — não vale reproduzir aquela complexidade aqui antes de precisar
dela de verdade.

## Arquivos

| Arquivo                      | Revision Alembic     |
| ---------------------------- | -------------------- |
| `sql/0000_create_schema.sql` | `0000_create_schema` |
| `sql/0001_create_sessao.sql` | `0001_create_sessao` |

Cada arquivo mantém a própria tabela de controle que o Alembic usa,
`alembic_version_wgov0001_catalogo_dados` (nome customizado — ver `version_table`
em `alembic/env.py` e `app/db/alembic_version_table.py`) — **não** uma tabela de controle
separada — para
que, depois de um DBA aplicar estes arquivos à mão, um `alembic upgrade
head` rodando depois (o deploy automático do próprio app, quando ele tiver
permissão de DDL, ou outro ambiente onde a app roda migrations
normalmente) reconheça a revision correta e não tente recriar nada que já
exista. Isso também é o que o DBA consulta para saber o que já foi
aplicado:

```sql
SELECT version_num FROM <schema>.alembic_version_template;
```

## Como aplicar (DBA)

Na ordem dos nomes de arquivo (já são cronológicos):

```bash
psql "$TARGET_DATABASE_URL" -f sql/0000_create_schema.sql
psql "$TARGET_DATABASE_URL" -f sql/0001_create_sessao.sql
```

`0001_create_sessao.sql` cria a tabela `sessao` em `cur_iam` (schema da
própria Morlan Access/IAM, não o deste app — ver `Settings.IAM_SCHEMA`) —
**pressupõe que `cur_iam` já existe**, criado pelas próprias migrações da
Morlan Access. Se o DBA estiver aplicando num ambiente onde `cur_iam` ainda
não existe, resolva isso com o time da Morlan Access antes, não criando o
schema por aqui.

## Como regenerar

Depois de criar uma nova migration Alembic (`npm run migrate -- "mensagem"`
em `server/`):

```bash
cd server
npm run dba:generate
```

Equivalente a rodar manualmente:

```bash
uv run alembic upgrade head --sql > migrations.sql
uv run python scripts/generate_dba_sql.py
```

O script (`scripts/generate_dba_sql.py`) reescreve **todos** os arquivos em
`alembic/dba_migrations/sql/` a partir do zero — não edite esses arquivos à
mão, a próxima regeneração descarta qualquer edição.

## Cuidado: nome do schema fica fixo no SQL gerado

As migrations Python (`alembic/versions/*.py`) leem `Settings.DATABASE_SCHEMA`/
`Settings.IAM_SCHEMA` dinamicamente em tempo de execução — mas um dump SQL
congela esses valores como texto literal (`CREATE SCHEMA IF NOT EXISTS
"template"`, `CREATE TABLE cur_iam.sessao ...`). Os arquivos commitados
hoje foram gerados com os valores deste ambiente de desenvolvimento
(`DATABASE_SCHEMA=template`/`IAM_SCHEMA=cur_iam`, ver `server/.env`). **Se o
nome do schema deste projeto (`DATABASE_SCHEMA`) mudar, regenere os
arquivos antes de entregar a um DBA** — caso contrário o SQL vai
criar/referenciar o schema errado. `IAM_SCHEMA` não deveria mudar entre
projetos (é sempre `cur_iam`, o schema fixo da Morlan Access/IAM) — mas se
mudar por algum motivo, regenere pelo mesmo caminho.
