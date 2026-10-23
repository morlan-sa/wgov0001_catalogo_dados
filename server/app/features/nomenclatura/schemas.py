from pydantic import BaseModel


class PrefixoOut(BaseModel):
    codigo: str
    significado: str
    exemplo: str
    dominios: list[str]


class DominioTipoOut(BaseModel):
    codigo: str
    descricao: str
    tipo: str
    escala: str | None
    nulo: bool
    exemplo: str


class DominioNegocioOut(BaseModel):
    codigo: str
    nome: str


class AmbiguidadeOut(BaseModel):
    termos: list[str]
    opcoes: list[str]
    pergunta: str


class NomenclaturaOut(BaseModel):
    fonte: str
    versao: str
    data_fonte: str
    prefixos: list[PrefixoOut]
    dominios_tipo: list[DominioTipoOut]
    dominios_negocio: list[DominioNegocioOut]
    camadas: list[str]
    ambiguidades: list[AmbiguidadeOut]


class ValidarNomeIn(BaseModel):
    nome: str
    tipo: str | None = None
    tamanho: int | None = None


class SugestaoOut(BaseModel):
    nome: str | None = None
    dominio: str | None = None
    tipo: str | None = None
    nulo: bool | None = None


class AvaliacaoOut(BaseModel):
    """Resultado da avaliação de uma coluna; reusado pelo catálogo."""

    resultado: str
    problemas: list[str]
    sugestao: SugestaoOut | None = None


class ValidacaoOut(AvaliacaoOut):
    nome: str
    ambiguidade: AmbiguidadeOut | None = None
    dominios_candidatos: list[str]
