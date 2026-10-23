from pydantic import BaseModel


class DomainOut(BaseModel):
    code: str
    name: str
    schema_count: int
    object_count: int
