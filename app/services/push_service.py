import json
from pywebpush import webpush, WebPushException
from typing import Dict, Any
from fastapi import HTTPException
from datetime import datetime
class PushNotificationService:
    def __init__(self):
        self.vapid_public_key = "BJGiGGiQ3z1BvTNujXCZblPCOV7dAGyi0A4lbtQT0qpRMblF3xt0L71ybVbUIIxqAZIpLeqTPlLyd7OiGj79LDU"
        self.vapid_private_key = "QK8yWCuYRVf5rs6HVEyFmqxVuQQweV2No4FYBC87o30"
        self.vapid_email = "jhaabhishek887@gmail.com"
    
    def send_notification(
        self, 
        subscription: Dict[str, Any], 
        title: str, 
        body: str,
    ) -> bool:
        """
        Send a push notification with fixed default parameters
        Only requires subscription, title and body
        """
        try:
            payload = {
                "title": title,
                "body": body,
                "icon": f"https://ornge.site/static/icons/icon_lg.png",
                "badge": f"https://ornge.site/static/icons/icon_md.png",
                "vibrate": [100, 50, 100],
                "tag": "notification",
                "data": {
                    "dateOfArrival": int(datetime.now().timestamp() * 1000),
                    "primaryKey": 1
                },
                "actions": [{
                    "action": "explore",
                    "title": "View"
                }]
            }
            
            webpush(
                subscription_info=subscription,
                data=json.dumps(payload),
                vapid_private_key=self.vapid_private_key,
                vapid_claims={
                    "sub": self.vapid_email
                },
                ttl=86400, 
            )
            return True
            
        except WebPushException as e:
            print(f"WebPush error: {e}")
            raise HTTPException(status_code=400, detail=str(e))
        except Exception as e:
            print(f"Notification error: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")

# Global instance
push_service = PushNotificationService()