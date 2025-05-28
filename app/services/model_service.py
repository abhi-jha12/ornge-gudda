import tensorflow as tf
import keras
from keras.layers import TFSMLayer
import numpy as np
import pickle
import gdown
import zipfile
import shutil
from pathlib import Path
from ..config import settings

class ModelService:
    def __init__(self):
        self.model = None
        self.index_to_class = {}
        self.loaded = False

    async def load_model(self):
        """Download and load model if not already present"""
        try:
            # Check if both model folder and class index file already exist
            if settings.MODEL_DIR.exists() and settings.CLASSES_PATH.exists():
                print("✅ Model and class index already present. Skipping download.")
            else:
                await self._download_assets()

            # Load model
            self.model = TFSMLayer(str(settings.MODEL_DIR), call_endpoint="serving_default")
            
            # Load class index
            with open(settings.CLASSES_PATH, "rb") as f:
                self.index_to_class = pickle.load(f)
            
            self.loaded = True
            print(f"✅ Model loaded with {len(self.index_to_class)} classes")
            
        except Exception as e:
            print(f"❌ Error loading model: {e}")
            raise

    async def _download_assets(self):
        """Download model and class index from Google Drive"""
        # Delete existing model folder if partially present
        if settings.MODEL_DIR.exists():
            print("🧹 Removing incomplete model folder...")
            shutil.rmtree(settings.MODEL_DIR)

        print("📦 Downloading model from Google Drive...")
        gdown.download(
            id=settings.MODEL_DOWNLOAD_ID,
            output=str(settings.MODEL_ZIP_PATH),
            quiet=False,
        )

        print("🗂 Extracting model zip...")
        with zipfile.ZipFile(settings.MODEL_ZIP_PATH, "r") as zip_ref:
            zip_ref.extractall(settings.MODEL_DIR)
        print("✅ Model extracted to:", settings.MODEL_DIR)

        settings.MODEL_ZIP_PATH.unlink(missing_ok=True)

        print("📦 Downloading class index file from Google Drive...")
        gdown.download(
            id=settings.CLASSES_DOWNLOAD_ID,
            output=str(settings.CLASSES_PATH),
            quiet=False,
        )
        print("✅ Classes file downloaded!")

    def predict(self, image_array: np.ndarray):
        """Make prediction on processed image array"""
        if not self.loaded:
            raise RuntimeError("Model not loaded")
            
        prediction_dict = self.model(image_array)
        
        # Extract predictions from the dictionary
        if "predictions" in prediction_dict:
            predictions = prediction_dict["predictions"]
        elif "output_0" in prediction_dict:
            predictions = prediction_dict["output_0"]
        elif "dense" in prediction_dict:
            predictions = prediction_dict["dense"]
        elif "sequential" in prediction_dict:
            predictions = prediction_dict["sequential"]
        else:
            predictions = list(prediction_dict.values())[0]

        if hasattr(predictions, "numpy"):
            predictions = predictions.numpy()

        predicted_index = np.argmax(predictions)
        confidence = float(np.max(predictions))
        predicted_class = self.index_to_class.get(predicted_index, "Unknown")

        return {
            "predicted_class": predicted_class,
            "confidence": confidence,
            "predicted_index": int(predicted_index)
        }

model_service = ModelService()