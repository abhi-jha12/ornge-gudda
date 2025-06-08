from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
import uuid
class PredictionResponse(BaseModel):
    predicted_class: str
    confidence: float
    predicted_index: int
    filename: str

class UserBase(BaseModel):
    client_id: str
    name: Optional[str] = "Friend"
    push_subscription: Optional[dict] = None
    streak: Optional[int] = 0
    actions: Optional[int] = 0
    level: Optional[int] = 1
    daily_quote_count: Optional[int] = 0
    games_played: Optional[int] = 0
    tarot_draws: Optional[int] = 0
    is_admin: Optional[bool] = False
    is_banned: Optional[bool] = False
    food_points: Optional[int] = 0
    food_streak: Optional[int] = 0
    gender: Optional[str] = None
    is_special_moodboard_allowed: Optional[bool] = False
    weekly_spends: Optional[List[int]] = None
    today_expense: Optional[int] = 0

class OrangeUserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    created_at: datetime
    last_login: datetime