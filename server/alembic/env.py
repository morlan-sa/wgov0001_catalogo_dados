import asyncio
from logging.config import fileConfig

# Importa cada arquivo models de feature para registrar as classes ORM em
# Base.metadata (nenhuma feature de negócio neste template ainda — mantém o
# padrão pronto para quando houver: `import app.features.<nome>.models`).
from sqlalchemy import pool, text
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context
from app.config import settings
from app.db.alembic_version_table import VERSION_TABLE
from app.db.engine import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

_OUR_SCHEMA = settings.DATABASE_SCHEMA


def include_name(name, type_, parent_names) -> bool:
    if type_ == "schema":
        return name in (_OUR_SCHEMA, None)
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table=VERSION_TABLE,
        version_table_schema=_OUR_SCHEMA,
        include_schemas=True,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:
    # `version_table_schema` abaixo faz o Alembic criar sua própria tabela
    # de controle (`VERSION_TABLE`) dentro do nosso schema *antes* de rodar
    # qualquer migração — incluindo a 0000_create_schema, cujo único
    # trabalho é justamente criar esse schema. Ovo e galinha: cria-se o
    # schema aqui primeiro, com commit próprio, para que essa configuração
    # de controle tenha onde ser gravada.
    connection.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{_OUR_SCHEMA}"'))
    connection.commit()

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table=VERSION_TABLE,
        version_table_schema=_OUR_SCHEMA,
        include_schemas=True,
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
