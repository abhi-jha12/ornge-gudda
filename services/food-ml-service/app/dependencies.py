from ..services.model_service import model_service

async def get_model_service():
    if not model_service.loaded:
        await model_service.load_model()
    return model_service