r"""Gera `app/features/nomenclatura/regras.json` a partir de `docs/nomenclatura-fonte/`.

Uso (a partir de `server/`):

    uv run python scripts/gerar_regras_nomenclatura.py \
        --versao 0.2.0 --data-fonte 2026-08-04

`--versao` e `--data-fonte` são obrigatórios: identificam a versão da skill
SKTIARQ0001 da qual os markdowns foram copiados.
"""

import argparse
import json
import sys
from pathlib import Path

RAIZ_SERVER = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ_SERVER))

from app.features.nomenclatura.geracao import gerar_regras  # noqa: E402

PASTA_FONTE = RAIZ_SERVER.parent / "docs" / "nomenclatura-fonte"
SAIDA = RAIZ_SERVER / "app" / "features" / "nomenclatura" / "regras.json"


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera regras.json de nomenclatura.")
    parser.add_argument("--versao", required=True, help="versão da skill, ex.: 0.2.0")
    parser.add_argument(
        "--data-fonte",
        required=True,
        help="data da fonte (AAAA-MM-DD), ex.: 2026-08-04",
    )
    parser.add_argument("--fonte", type=Path, default=PASTA_FONTE)
    parser.add_argument("--saida", type=Path, default=SAIDA)
    args = parser.parse_args()

    regras = gerar_regras(args.fonte, args.versao, args.data_fonte)
    args.saida.write_text(
        json.dumps(regras, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"{args.saida} gerado (versão {args.versao}, fonte de {args.data_fonte})")


if __name__ == "__main__":
    main()
