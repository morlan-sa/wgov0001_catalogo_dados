from fastapi import APIRouter, Depends

from app.features.auth.dependencies import CurrentUser, get_current_user
from app.features.dashboard import service as dashboard_service
from app.features.dashboard.schemas import (
    SaudeDashboardOut,
    SaudeLegadoOut,
    SummaryOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=SummaryOut)
async def resumo(_: CurrentUser = Depends(get_current_user)):
    return await dashboard_service.get_summary()


@router.get("/saude", response_model=SaudeDashboardOut)
async def saude(_: CurrentUser = Depends(get_current_user)):
    return await dashboard_service.get_saude_governanca()


@router.get("/saude-legado", response_model=SaudeLegadoOut)
async def saude_legado(_: CurrentUser = Depends(get_current_user)):
    return await dashboard_service.get_saude_legado()
