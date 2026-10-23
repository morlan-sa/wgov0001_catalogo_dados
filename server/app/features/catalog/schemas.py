from pydantic import BaseModel


class SaudeOut(BaseModel):
    percentual: int
    classificacao: str


class TableOut(BaseModel):
    name: str
    type: str
    description: str | None
    classification: str


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
    columns: list[ColumnOut]


class ColumnSearchOut(BaseModel):
    schema_name: str
    table: str
    column: str
    type: str
    description: str | None
