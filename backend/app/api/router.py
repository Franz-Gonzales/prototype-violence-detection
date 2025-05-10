from fastapi import APIRouter
from app.api.endpoints import router as endpoints_router

router = APIRouter()

# Incluir todos los endpoints
router.include_router(endpoints_router)