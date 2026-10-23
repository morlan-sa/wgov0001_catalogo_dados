from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.engine import get_db
from app.features.health import service as health_service
from app.features.health.schemas import HealthOut

# O prefixo `/api` é aplicado centralmente em app/main.py (discover_routers)
# — cada feature só declara o próprio sub-prefixo.
router = APIRouter(prefix="/health", tags=["health"])


# Esta rota é pública de propósito — health check de load balancer não tem
# cookie de sessão para mandar. Não copie essa ausência de auth para uma
# rota de negócio nova: use `Depends(get_current_user)` de
# `app/features/auth/dependencies.py` (ver `app/features/example/`, uma
# feature descartável mostrando o padrão, e "Auth architecture" em
# CLAUDE.md).


@router.get("", response_model=HealthOut)
async def health(db: AsyncSession = Depends(get_db)):
    return await health_service.get_health(db)
