from pydantic import BaseModel

class PredictionResponse(BaseModel):
    predicted_class: str
    confidence: float
    predicted_index: int
    filename: str