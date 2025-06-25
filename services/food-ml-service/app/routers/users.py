from datetime import datetime
import pika
from app.services.rabbitmq_service import rabbitmq_service
from fastapi import APIRouter, Depends, HTTPException
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.schemas import OrangeUserResponse
from ..models.users import OrangeUser
from pydantic import BaseModel

router = APIRouter(prefix="/users", tags=["users"])


class NotificationRequest(BaseModel):
    client_ids: List[str]
    title: str
    body: str


@router.get("/", response_model=List[OrangeUserResponse])
async def get_all_users(db: Session = Depends(get_db)):
    """Get all users"""
    try:
        users = db.query(OrangeUser).all()
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching users: {str(e)}")


@router.get("/count")
async def get_users_count(db: Session = Depends(get_db)):
    """Get total count of users"""
    try:
        count = db.query(OrangeUser).count()
        return {"total_users": count, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error counting users: {str(e)}")


@router.post("/send-notification", response_model=Dict[str, Any])
async def send_notification_to_users(
    request: NotificationRequest, db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Queue notification sending job to RabbitMQ

    This endpoint:
    1. Validates the requested client_ids exist
    2. Publishes the notification job to RabbitMQ
    3. Returns immediate response with job details
    """
    try:
        # Lightweight validation - check if any users exist
        exists = db.query(
            db.query(OrangeUser)
            .filter(OrangeUser.client_id.in_(request.client_ids))
            .exists()
        ).scalar()

        if not exists:
            raise HTTPException(
                status_code=404,
                detail="No users found with the provided client_ids",
            )

        # Publish to RabbitMQ (no database operations in consumer)
        job_id = rabbitmq_service.publish_notification(
            client_ids=request.client_ids, title=request.title, body=request.body
        )

        return {
            "status": "queued",
            "job_id": job_id,
            "message": "Notifications queued for background processing",
            "total_users": len(request.client_ids),
            "queued_at": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except pika.exceptions.AMQPError as e:
        raise HTTPException(
            status_code=503,
            detail="Notification service temporarily unavailable",
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Internal server error while queuing notifications",
        )
