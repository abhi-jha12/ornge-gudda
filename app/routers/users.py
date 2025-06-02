from ..services import push_service
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
    Send push notification to multiple users by their client_ids
    """
    try:
        # Get users with matching client_ids
        users = (
            db.query(OrangeUser)
            .filter(OrangeUser.client_id.in_(request.client_ids))
            .all()
        )

        if not users:
            raise HTTPException(
                status_code=404, detail="No users found with the provided client_ids"
            )

        results = []
        for user in users:
            if user.push_subscription:  # Check if user has push subscription
                try:
                    success = push_service.send_notification(
                        subscription=user.push_subscription,
                        title=request.title,
                        body=request.body,
                    )
                    results.append(
                        {
                            "client_id": user.client_id,
                            "status": "success" if success else "failed",
                            "message": (
                                "Notification sent"
                                if success
                                else "Failed to send notification"
                            ),
                        }
                    )
                except Exception as e:
                    results.append(
                        {
                            "client_id": user.client_id,
                            "status": "error",
                            "message": str(e),
                        }
                    )
            else:
                results.append(
                    {
                        "client_id": user.client_id,
                        "status": "skipped",
                        "message": "User has no push subscription",
                    }
                )

        # Count successful notifications
        success_count = sum(1 for r in results if r["status"] == "success")

        return {
            "status": "completed",
            "total_users": len(request.client_ids),
            "users_found": len(users),
            "notifications_sent": success_count,
            "details": results,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error sending notifications: {str(e)}"
        )
