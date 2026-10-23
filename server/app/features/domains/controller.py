from fastapi import APIRouter, Depends

from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.domains import service as domains_service
from app.features.domains.schemas import DomainOut

router = APIRouter(prefix="/domains", tags=["domains"])


@router.get("", response_model=list[DomainOut])
async def listar(_: CurrentUser = Depends(get_current_user)):
    return await domains_service.list_domains_with_usage()
