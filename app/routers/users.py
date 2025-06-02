from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.schemas import OrangeUserResponse
from ..models.users import User

router = APIRouter(
    prefix="/users",
    tags=["users"]
)

@router.get("/", response_model=List[OrangeUserResponse])
async def get_all_users(db: Session = Depends(get_db)):
    """Get all users"""
    try:
        users = db.query(User).all()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")

@router.get("/count")
async def get_users_count(db: Session = Depends(get_db)):
    """Get total count of users"""
    try:
        count = db.query(User).count()
        return {
            "total_users": count,
            "status": "success"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting users: {str(e)}")