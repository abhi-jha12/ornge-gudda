from fastapi import APIRouter, Depends
from ..services.model_service import model_service

router = APIRouter(tags=["health"])

@router.get("/")
async def home():
    return {
        "message": "Food Classifier API is running!",
        "status": "healthy",
        "model_loaded": model_service.loaded,
        "classes_count": len(model_service.index_to_class),
    }

@router.get("/health")
async def health_check():
    return {"status": "healthy"}