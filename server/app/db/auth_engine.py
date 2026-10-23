"""Engine SQLAlchemy *síncrono* — existe porque `morlan_access`
(`create_auth_router`/`make_get_current_user`) exige `Callable[[],
Iterator[Session]]`, uma `Session` síncrona, não `AsyncSession`; reaproveitado
também por `app/main.py` como engine do sink de log de `dh_helper.obslog`
(que só precisa de um `sqlalchemy.Engine` comum, agnóstico de schema/lib; ver
comentário abaixo sobre `search_path`). Com `SESSION_STORE=rds` (default —
ver `Settings.SESSION_STORE`), a lib grava a sessão de usuário na tabela
`sessao`, em `IAM_SCHEMA` (`cur_iam`), através deste mesmo engine. O resto do
app (features de negócio) usa o engine assíncrono em `app/db/engine.py`.

Mesma técnica do `_sync_dsn()` de rnc2/server: deriva o DSN síncrono trocando
o driver, sem duplicar configuração.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings


def _sync_dsn(async_dsn: str) -> str:
    return async_dsn.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)


# `morlan_access.models.Sessao` não declara `schema=` próprio (é modelo da
# lib, não nosso, pra mudar) — suas queries referenciam `sessao` sem
# qualificar schema. `options=-csearch_path=...` faz essas queries caírem em
# `IAM_SCHEMA` (`cur_iam`, o schema da própria Morlan Access/IAM) em vez de
# `public`. As gravações de log do dh_helper.obslog, que também passam por
# este engine, não dependem disso — já qualificam o próprio nome de tabela
# com o schema no SQL que geram (ver app/main.py).
auth_engine = create_engine(
    _sync_dsn(settings.DATABASE_URL),
    pool_pre_ping=True,
    connect_args={"options": f"-c search_path={settings.IAM_SCHEMA}"},
)
AuthSessionLocal = sessionmaker(bind=auth_engine, autoflush=False, autocommit=False)


def get_auth_db() -> Iterator[Session]:
    db = AuthSessionLocal()
    try:
        yield db
    finally:
        db.close()
