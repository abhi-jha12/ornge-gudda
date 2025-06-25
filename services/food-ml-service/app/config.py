from pathlib import Path
from pydantic_settings import BaseSettings  

class Settings(BaseSettings):
    BASE_DIR: Path = Path(__file__).parent.parent
    MODEL_DIR: Path = BASE_DIR / "final_model"
    MODEL_ZIP_PATH: Path = BASE_DIR / "final_model.zip"
    CLASSES_PATH: Path = BASE_DIR / "index_to_class.pkl"
    
    # CORS settings
    CORS_ORIGINS: list = ["*"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list = ["*"]
    CORS_ALLOW_HEADERS: list = ["*"]
    
    # Model download settings
    MODEL_DOWNLOAD_ID: str = "104YeURBTo41mqcMhhOTW4AROMY2tGtM8"
    CLASSES_DOWNLOAD_ID: str = "1ofKEjvN5lGQyU8bElbcA8ZedzYAxjRZV"
    
    class Config:
        case_sensitive = True

settings = Settings()