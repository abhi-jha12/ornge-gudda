from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from .config import settings
from .routers import health, predict
from .services.model_service import model_service
import logging
import json
from datetime import datetime

# Configure structured logging for Loki
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("/app/logs/app.log"), logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


def create_app():
    app = FastAPI(
        title="Food Classifier API",
        version="1.0.0",
        description="API for classifying food images",
    )

    # Initialize Prometheus monitoring
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        excluded_handlers=[".*admin.*", "/metrics"],
        env_var_name="ENABLE_METRICS",
        inprogress_name="inprogress",
        inprogress_labels=True,
    )

    instrumentator.instrument(app)
    instrumentator.expose(app, endpoint="/metrics")

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
        logger.info("Food Classifier API started successfully")

    return app


app = create_app()
