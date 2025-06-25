import tensorflow as tf
import keras
from keras.layers import TFSMLayer
import numpy as np
import pickle
import gdown
import zipfile
import shutil
from pathlib import Path
from prometheus_client import Counter, Histogram, Gauge
import time
from ..config import settings

# Define metrics
PREDICTION_COUNTER = Counter(
    "food_classifier_predictions_total",
    "Total predictions made by food classifier",
    ["class_label"],
)

PREDICTION_LATENCY = Histogram(
    "food_classifier_latency_seconds",
    "Prediction processing time in seconds",
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0],
)

PREDICTION_CONFIDENCE = Histogram(
    "food_classifier_confidence",
    "Confidence scores of predictions",
    ["class_label"],
    buckets=[0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
)

MODEL_VERSION = Gauge(
    "food_classifier_version",
    "Current version of the food classifier model",
    ["version"],
)

ERROR_COUNTER = Counter(
    "food_classifier_errors_total", "Total prediction errors", ["error_type"]
)


class ModelService:
    def __init__(self):
        self.model = None
        self.index_to_class = {}
        self.loaded = False
        self.model_version = "1.0.0"  # Update this with your actual version

    async def load_model(self):
        """Download and load model if not already present"""
        try:
            # Check if both model folder and class index file already exist
            if settings.MODEL_DIR.exists() and settings.CLASSES_PATH.exists():
                print("✅ Model and class index already present. Skipping download.")
            else:
                await self._download_assets()

            # Load model
            self.model = TFSMLayer(
                str(settings.MODEL_DIR), call_endpoint="serving_default"
            )

            # Load class index
            with open(settings.CLASSES_PATH, "rb") as f:
                self.index_to_class = pickle.load(f)

            self.loaded = True
            MODEL_VERSION.labels(version=self.model_version).set(1)
            print(f"✅ Model loaded with {len(self.index_to_class)} classes")

        except Exception as e:
            ERROR_COUNTER.labels(error_type="load_error").inc()
            print(f"❌ Error loading model: {e}")
            raise

    async def _download_assets(self):
        """Download model and class index from Google Drive"""
        try:
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

        except Exception as e:
            ERROR_COUNTER.labels(error_type="download_error").inc()
            raise

    def predict(self, image_array: np.ndarray):
        """Make prediction on processed image array"""
        if not self.loaded:
            ERROR_COUNTER.labels(error_type="not_loaded_error").inc()
            raise RuntimeError("Model not loaded")

        start_time = time.time()

        try:
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

            # Record metrics
            latency = time.time() - start_time
            PREDICTION_LATENCY.observe(latency)
            PREDICTION_COUNTER.labels(class_label=predicted_class).inc()
            PREDICTION_CONFIDENCE.labels(class_label=predicted_class).observe(
                confidence
            )

            return {
                "predicted_class": predicted_class,
                "confidence": confidence,
                "predicted_index": int(predicted_index),
                "processing_time": latency,
            }

        except Exception as e:
            ERROR_COUNTER.labels(error_type="prediction_error").inc()
            raise


model_service = ModelService()
