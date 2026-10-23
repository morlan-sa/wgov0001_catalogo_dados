from pydantic import BaseModel


class DominioOut(BaseModel):
    code: str
    name: str


class SchemaOut(BaseModel):
    schema_name: str
    table_count: int
    view_count: int
    camada: str
    dominio: DominioOut
