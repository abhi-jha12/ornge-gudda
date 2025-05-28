from fastapi import FastAPI, File, UploadFile, HTTPException
import tensorflow as tf
import keras
from tensorflow.keras.preprocessing import image
from keras.applications.mobilenet_v2 import preprocess_input
import numpy as np
from PIL import Image
import io
import pickle
import os
from pathlib import Path
import gdown
import zipfile

app = FastAPI(title="Food Classifier API", version="1.0.0")

# Global variables to store model and classes
model = None
index_to_class = {}

# Get the directory where this file is located
BASE_DIR = Path(__file__).parent.parent


@app.on_event("startup")
async def load_everything():
    """Download model and class index from Google Drive only if not present"""
    global model, index_to_class

    try:
        model_dir = BASE_DIR / "final_model"
        model_zip_path = BASE_DIR / "final_model.zip"
        classes_path = BASE_DIR / "index_to_class.pkl"

        # Check if both model folder and class index file already exist
        if model_dir.exists() and classes_path.exists():
            print("✅ Model and class index already present. Skipping download.")
        else:
            # Delete existing model folder if partially present
            if model_dir.exists():
                print("🧹 Removing incomplete model folder...")
                import shutil

                shutil.rmtree(model_dir)

            print("📦 Downloading model from Google Drive...")
            gdown.download(
                id="104YeURBTo41mqcMhhOTW4AROMY2tGtM8",
                output=str(model_zip_path),
                quiet=False,
            )

            print("🗂 Extracting model zip...")
            with zipfile.ZipFile(model_zip_path, "r") as zip_ref:
                zip_ref.extractall(model_dir)
            print("✅ Model extracted to:", model_dir)

            model_zip_path.unlink(missing_ok=True)

            print("📦 Downloading class index file from Google Drive...")
            gdown.download(
                id="1ofKEjvN5lGQyU8bElbcA8ZedzYAxjRZV",
                output=str(classes_path),
                quiet=False,
            )
            print("✅ Classes file downloaded!")

        # Load model
        model = keras.layers.TFSMLayer(str(model_dir), call_endpoint="serving_default")
        print("✅ Model loaded!")

        # Load class index
        with open(classes_path, "rb") as f:
            index_to_class = pickle.load(f)
        print(f"✅ Classes loaded! Found {len(index_to_class)} classes")

    except Exception as e:
        print(f"❌ Error during startup: {e}")
        raise


@app.get("/")
def home():
    """Test if API is working"""
    return {
        "message": "Food Classifier API is running!",
        "status": "healthy",
        "model_loaded": model is not None,
        "classes_count": len(index_to_class),
    }


@app.get("/health")
def health_check():
    """Health check endpoint for Render"""
    return {"status": "healthy"}


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    """Upload image and get prediction"""

    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    try:
        # Check if file is an image
        if not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Please upload an image file")

        # Check file size (optional - add size limit)
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        if file.size and file.size > MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail="File too large")

        # Read the uploaded image
        image_data = await file.read()

        # Process the image
        img = Image.open(io.BytesIO(image_data))
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to 224x224 (your model's input size)
        img = img.resize((224, 224))

        # Convert to array and preprocess
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)

        # Make prediction using TFSMLayer
        prediction_dict = model(img_array)

        # Debug: print the prediction dictionary structure
        print("Prediction dict keys:", prediction_dict.keys())

        # Extract predictions from the dictionary
        # Try common output key names
        if "predictions" in prediction_dict:
            predictions = prediction_dict["predictions"]
        elif "output_0" in prediction_dict:
            predictions = prediction_dict["output_0"]
        elif "dense" in prediction_dict:
            predictions = prediction_dict["dense"]
        elif "sequential" in prediction_dict:
            predictions = prediction_dict["sequential"]
        else:
            # If none of the common keys work, take the first value
            predictions = list(prediction_dict.values())[0]

        # Convert tensor to numpy if needed
        if hasattr(predictions, "numpy"):
            predictions = predictions.numpy()

        predicted_index = np.argmax(predictions)
        confidence = float(np.max(predictions))

        # Get class name
        predicted_class = index_to_class.get(predicted_index, "Unknown")

        return {
            "predicted_class": predicted_class,
            "confidence": confidence,
            "predicted_index": int(predicted_index),
            "filename": file.filename,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# Add CORS middleware if needed for web frontend
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
