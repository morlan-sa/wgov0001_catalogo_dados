from pydantic import BaseModel

from app.features.nomenclatura.schemas import AvaliacaoOut


class SaudeOut(BaseModel):
    percentual: int
    classificacao: str


class ConformidadeOut(BaseModel):
    """Resumo de conformidade com a nomenclatura (tabela ou schema)."""

    aplicavel: bool
    conformes: int
    avisos: int
    fora: int
    total: int
    percentual: int | None


class TableOut(BaseModel):
    name: str
    type: str
    description: str | None
    classification: str
    # Só preenchido na lista de tabelas do schema; `list_tables` não calcula.
    conformidade: ConformidadeOut | None = None


class DocumentacaoOut(BaseModel):
    percentual: int | None
    documentadas: int
    total: int


class ColumnOut(BaseModel):
    name: str
    type: str
    length: int | None
    scale: int | None
    nullable: bool
    order: int
    description: str | None
    is_primary_key: bool
    domain: str
    # None nas colunas de auditoria: ficam fora do cálculo de completude.
    completude: SaudeOut | None = None
    # None nas colunas de auditoria e nos schemas LEGADO (convenção não se aplica).
    conformidade: AvaliacaoOut | None = None


class TableSaudeOut(BaseModel):
    total_registros: int
    saude: SaudeOut


class TableDetailOut(TableOut):
    schema_name: str
    # None quando o usuário do banco não pode ler os dados da tabela
    # (`leitura_negada`): a estrutura continua disponível, só a saúde não.
    total_registros: int | None
    saude: SaudeOut | None
    leitura_negada: bool = False
    # Obrigatório no detalhe (a lista é que a deixa opcional).
    conformidade: ConformidadeOut  # pyright: ignore
    documentacao: DocumentacaoOut
    columns: list[ColumnOut]


class ColumnSearchOut(BaseModel):
    schema_name: str
    table: str
    column: str
    type: str
    description: str | None
