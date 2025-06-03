from app.services.rabbitmq_service import rabbitmq_service
from ..services.push_service import push_service
from fastapi import APIRouter, Depends, HTTPException
from typing import List
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


@router.post("/send-notification")
async def send_notification_to_users(
    request: NotificationRequest, db: Session = Depends(get_db)
):
    """
    Queue notification sending job to RabbitMQ
    """
    try:
        # Validate that users exist (optional quick check)
        users_count = (
            db.query(OrangeUser)
            .filter(OrangeUser.client_id.in_(request.client_ids))
            .count()
        )

        if users_count == 0:
            raise HTTPException(
                status_code=404, 
                detail="No users found with the provided client_ids"
            )

        # Publish notification job to RabbitMQ
        job_id = rabbitmq_service.publish_notification(
            client_ids=request.client_ids,
            title=request.title,
            body=request.body
        )

        return {
            "status": "queued",
            "job_id": job_id,
            "message": "Notifications queued for processing",
            "total_users": len(request.client_ids),
            "users_found": users_count
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Error queuing notifications: {str(e)}"
        )
