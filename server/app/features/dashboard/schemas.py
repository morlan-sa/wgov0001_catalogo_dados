from pydantic import BaseModel


class SummaryOut(BaseModel):
    total_schemas: int
    total_tables: int
    total_views: int
    por_camada: dict[str, int]


class SchemaSaudeOut(BaseModel):
    schema_name: str
    percentual: int
    classificacao: str
    total_tabelas: int


class SaudeDashboardOut(BaseModel):
    percentual: int
    classificacao: str
    total_tabelas_avaliadas: int
    metrica: str | None = None
    por_schema: list[SchemaSaudeOut]


class SaudeLegadoOut(SaudeDashboardOut):
    amostra_por_schema: int
    # Schemas legados em que o usuário do DB2 não consegue ler nenhuma tabela
    # — é um limite real de permissão, não falha da amostragem.
    schemas_sem_acesso: list[str]
