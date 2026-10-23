from fastapi import APIRouter, Depends

from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.schemas import service as schemas_service
from app.features.schemas.schemas import SchemaOut

router = APIRouter(prefix="/schemas", tags=["schemas"])


@router.get("", response_model=list[SchemaOut])
async def listar(_: CurrentUser = Depends(get_current_user)):
    return await schemas_service.list_schemas()
