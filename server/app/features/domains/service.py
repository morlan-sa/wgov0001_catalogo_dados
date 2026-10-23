import unicodedata

from app.features.catalog.inference import list_dominios_negocio
from app.features.domains.schemas import DomainOut
from app.features.schemas.service import list_schemas


def _sort_key(name: str) -> str:
    """Ordem alfabética pt-BR: ignora acento e caixa (como `localeCompare`)."""
    decomposed = unicodedata.normalize("NFD", name)
    return "".join(c for c in decomposed if not unicodedata.combining(c)).casefold()


async def list_domains_with_usage() -> list[DomainOut]:
    domains = list_dominios_negocio()
    schemas = await list_schemas()

    result: list[DomainOut] = []
    for domain in domains:
        do_dominio = [s for s in schemas if s.dominio.code == domain["code"]]
        result.append(
            DomainOut(
                code=domain["code"],
                name=domain["name"],
                schema_count=len(do_dominio),
                object_count=sum(s.table_count + s.view_count for s in do_dominio),
            )
        )
    return sorted(result, key=lambda d: _sort_key(d.name))
