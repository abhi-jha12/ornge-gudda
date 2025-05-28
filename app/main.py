from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routers import health, predict
from .services.model_service import model_service


def create_app():
    app = FastAPI(
        title="Food Classifier API",
        version="1.0.0",
        description="API for classifying food images",
    )

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
        allow_methods=settings.CORS_ALLOW_METHODS,
        allow_headers=settings.CORS_ALLOW_HEADERS,
    )

    # Include routers
    app.include_router(health.router)
    app.include_router(predict.router)

    @app.on_event("startup")
    async def startup_event():
        await model_service.load_model()

    return app


app = create_app()
