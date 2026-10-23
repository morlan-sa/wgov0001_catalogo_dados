"""Gera SQL para DBAs aplicarem à mão (`alembic/dba_migrations/sql/`) a
partir de `migrations.sql` (saída de `alembic upgrade head --sql`) — ver
`alembic/dba_migrations/README.md`.

Um arquivo por revision Alembic, nomeado com o próprio id da revision
(`0000_create_schema.py` -> `0000_create_schema.sql`), na mesma ordem
cronológica que `alembic upgrade head --sql` já emite. Ao contrário do
`split_migration_sql.py` do rnc2/server (que agrupa tabelas por domínio via
dicionários `TABLE_CONCERN`/`REVISION_CONCERN` hardcoded e uma ordem de
execução não-cronológica — necessário lá por causa de uma baseline squashed
com dezenas de tabelas e renames históricos), este projeto tem uma cadeia
linear e pequena de revisions: o mapeamento é 1:1, sem dicionário
hand-maintained. Se este projeto crescer a ponto de precisar de
agrupamento por domínio ou reordenação, o script do rnc2 é a referência a
seguir — não vale reproduzir aquela complexidade aqui antes de precisar
dela de verdade.

A tabela `VERSION_TABLE` (bookkeeping que o próprio Alembic cria
e mantém — nome customizado via `version_table` em `alembic/env.py`, ver o
comentário lá) é preservada nestes arquivos, só reposicionada: no dump
bruto ela é criada *antes* do primeiro `CREATE SCHEMA`, o que falha se
aplicado à risca (o schema ainda não existe) — essa ordem só "funciona" no
caminho online porque `alembic/env.py` cria o schema à mão antes de
qualquer coisa (ver comentário lá, "Ovo e galinha"). Preservar essa tabela
— em vez de inventar uma tabela de controle própria, que ficaria
dessincronizada da que o Alembic realmente usa — significa que, depois de
um DBA aplicar estes arquivos à mão, um `alembic upgrade head` rodando
depois (o deploy automático do próprio app) reconhece a revision correta e
não tenta recriar nada que já exista.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Invocado como `python scripts/generate_dba_sql.py` (ver package.json), o que
# põe `scripts/` — não `server/` — em sys.path[0]. Sem isto, `app` não
# resolveria. (`VERSION_TABLE` vive em `app/db/alembic_version_table.py`, não
# em `alembic/env.py`, de propósito: importar `env.py` executaria seu corpo
# inteiro, incluindo `run_migrations_offline()`/`run_migrations_online()` —
# e o pacote `alembic/` deste projeto, sem `__init__.py` para não colidir com
# o pacote pip `alembic`, nunca venceria essa resolução de qualquer forma.)
sys.path.insert(0, str(ROOT))
from app.db.alembic_version_table import VERSION_TABLE  # noqa: E402

SOURCE = ROOT / "migrations.sql"
OUT_DIR = ROOT / "alembic" / "dba_migrations" / "sql"

_BANNER_RE = re.compile(r"^-- Running upgrade (.+)$", re.MULTILINE)
_PREAMBLE_TABLE_RE = re.compile(
    rf"(CREATE TABLE \S*{VERSION_TABLE}\b.*?;\n)", re.DOTALL
)
_FIRST_INSERT_RE = re.compile(rf"(?=INSERT INTO \S*{VERSION_TABLE}\b)")
_UNSAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9_.-]+")


def _read_dump() -> str:
    if not SOURCE.exists():
        sys.exit(
            f"{SOURCE} não existe. Rode primeiro:\n"
            f"  uv run alembic upgrade head --sql > {SOURCE.name}"
        )
    raw = SOURCE.read_bytes().decode("utf-8")
    return raw.replace("\r\n", "\n").replace("\r", "\n")


def _clean_body(body: str) -> str:
    body = re.sub(r"\n*COMMIT;\s*\Z", "\n", body)
    lines = [line.rstrip() for line in body.strip("\n").splitlines()]
    return "\n".join(lines) + "\n"


def main() -> None:
    raw = _read_dump()
    if "-- Running upgrade" not in raw:
        sys.exit("Nenhum '-- Running upgrade' em migrations.sql — dump vazio?")

    parts = _BANNER_RE.split(raw)
    # parts = [preamble, banner_1, body_1, banner_2, body_2, ...].
    preamble = parts[0]
    revisions = list(zip(parts[1::2], parts[2::2], strict=False))
    if not revisions:
        sys.exit("Não foi possível identificar nenhuma revision no dump.")

    match = _PREAMBLE_TABLE_RE.search(preamble)
    if not match:
        sys.exit(f"Não encontrei a criação de {VERSION_TABLE} no preâmbulo do dump.")
    alembic_version_table_sql = match.group(1).rstrip("\n")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.sql"):
        old.unlink()

    written = []
    for i, (banner, body) in enumerate(revisions, start=1):
        to_revision = banner.split("->")[-1].strip()
        if i == 1:
            # Reposiciona a criação de VERSION_TABLE para depois
            # do CREATE SCHEMA desta revision e antes do primeiro INSERT
            # nela — ver docstring do módulo.
            body = _FIRST_INSERT_RE.sub(
                alembic_version_table_sql + "\n\n", body, count=1
            )
        filename = _UNSAFE_FILENAME_RE.sub("_", to_revision) + ".sql"
        header = (
            "-- Gerado por scripts/generate_dba_sql.py — NÃO EDITE À MÃO.\n"
            f"-- Alembic revision: {to_revision}\n"
            "-- Regenerar: veja alembic/dba_migrations/README.md\n\n"
        )
        content = header + _clean_body(body)
        (OUT_DIR / filename).write_text(content, encoding="utf-8", newline="\n")
        written.append(filename)

    print(f"Escreveu {len(written)} arquivo(s) em {OUT_DIR.relative_to(ROOT)}/")
    for name in written:
        print(f"  {name}")

    SOURCE.unlink()


if __name__ == "__main__":
    main()
