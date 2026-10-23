"""Nome da tabela de controle do Alembic — isolado num módulo próprio, sem
nenhum outro import, para que `alembic/env.py` e `scripts/generate_dba_sql.py`
possam ambos importá-lo sem risco: `alembic/env.py` não pode ser importado
diretamente (seu corpo executa `run_migrations_offline()`/
`run_migrations_online()` como efeito colateral do próprio import), e o
pacote `alembic` deste projeto (sem `__init__.py`, para não colidir com o
pacote pip `alembic`) nunca venceria essa resolução de qualquer forma.

O sufixo é o nome do projeto em snake_case. Se o nome do projeto mudar, troque
`VERSION_TABLE` aqui e regenere o espelho SQL do DBA (`npm run dba:generate`).
"""

VERSION_TABLE = "alembic_version_wgov0001_catalogo_dados"
