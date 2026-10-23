from dataclasses import asdict

from fastapi import APIRouter, Depends

from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.catalog.reference import CAMADAS_GOVERNADAS
from app.features.nomenclatura.regras import carregar_regras
from app.features.nomenclatura.schemas import (
    NomenclaturaOut,
    ValidacaoOut,
    ValidarNomeIn,
)
from app.features.nomenclatura.service import validar_nome

router = APIRouter(prefix="/nomenclatura", tags=["nomenclatura"])


@router.get("", response_model=NomenclaturaOut)
async def obter_nomenclatura(_: CurrentUser = Depends(get_current_user)):
    regras = carregar_regras()
    return {
        "fonte": regras.fonte,
        "versao": regras.versao,
        "data_fonte": regras.data_fonte,
        "prefixos": list(regras.prefixos.values()),
        "dominios_tipo": list(regras.dominios_tipo.values()),
        "dominios_negocio": [
            {"codigo": codigo, "nome": nome}
            for codigo, nome in regras.dominios_negocio.items()
        ],
        "camadas": list(CAMADAS_GOVERNADAS),
        "ambiguidades": list(regras.ambiguidades),
    }


@router.post("/validar", response_model=ValidacaoOut)
async def validar(corpo: ValidarNomeIn, _: CurrentUser = Depends(get_current_user)):
    validacao = validar_nome(corpo.nome, corpo.tipo, corpo.tamanho)
    avaliacao = validacao.avaliacao
    return {
        "nome": validacao.nome,
        "resultado": avaliacao.resultado,
        "problemas": list(avaliacao.problemas),
        "sugestao": asdict(avaliacao.sugestao) if avaliacao.sugestao else None,
        "ambiguidade": validacao.ambiguidade,
        "dominios_candidatos": list(validacao.dominios_candidatos),
    }
