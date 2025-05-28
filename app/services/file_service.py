from PIL import Image
import io
import numpy as np
from tensorflow.keras.preprocessing import image
from keras.applications.mobilenet_v2 import preprocess_input

class FileService:
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

    async def validate_image_file(self, file):
        """Validate the uploaded file is an image within size limits"""
        if not file.content_type.startswith("image/"):
            raise ValueError("Please upload an image file")
            
        if file.size and file.size > self.MAX_FILE_SIZE:
            raise ValueError("File too large")

    async def process_image(self, file_contents: bytes) -> np.ndarray:
        """Process uploaded image file into model-ready array"""
        img = Image.open(io.BytesIO(file_contents))
        if img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to 224x224 (model's input size)
        img = img.resize((224, 224))

        # Convert to array and preprocess
        img_array = image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
        img_array = preprocess_input(img_array)
        
        return img_array

file_service = FileService()