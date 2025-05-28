from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from ..services.model_service import model_service
from ..services.file_service import file_service
from ..models.schemas import PredictionResponse

router = APIRouter(tags=["predictions"])

@router.post("/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...)):
    try:
        # Validate file
        await file_service.validate_image_file(file)
        
        # Read and process image
        image_data = await file.read()
        img_array = await file_service.process_image(image_data)
        
        # Make prediction
        prediction = model_service.predict(img_array)
        
        return {
            **prediction,
            "filename": file.filename
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")