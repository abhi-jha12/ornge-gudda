from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from .config import settings
from .routers import health, predict, users
from .services.model_service import model_service
from .services.rabbitmq_service import rabbitmq_service  
import logging
import os
from logging.handlers import RotatingFileHandler
from fastapi.staticfiles import StaticFiles

# Ensure logs directory exists
os.makedirs("/app/logs", exist_ok=True)
# Configure rotating file handler with log rotation
rotating_handler = RotatingFileHandler(
    filename="/app/logs/app.log",
    maxBytes=5 * 1024 * 1024,
    backupCount=2,
    encoding="utf-8",
    delay=False,
)

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[rotating_handler, logging.StreamHandler()],
)

logger = logging.getLogger(__name__)


def create_app():
    app = FastAPI(
        title="Food Classifier API",
        version="1.0.0",
        description="API for classifying food images",
    )
    app.mount("/static", StaticFiles(directory="app/static"), name="static")

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
    app.include_router(users.router)

    @app.on_event("startup")
    async def startup_event():
        # Load ML model
        await model_service.load_model()

        # Start RabbitMQ consumer thread
        rabbitmq_service.start_consumer_thread()
        logger.info("RabbitMQ notification consumer thread started")

        logger.info("Food Classifier API started successfully")

    @app.on_event("shutdown")
    async def shutdown_event():
        # Clean up RabbitMQ connections
        rabbitmq_service.close()
        logger.info("RabbitMQ connections closed gracefully")

    return app


app = create_app()
