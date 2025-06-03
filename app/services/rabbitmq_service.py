import pika
import json
import logging
from typing import Dict, Any
import os

logger = logging.getLogger(__name__)

class RabbitMQService:
    def __init__(self):
        self.connection = None
        self.channel = None
        self.connect()
    
    def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            # RabbitMQ connection parameters
            credentials = pika.PlainCredentials('admin', 'password')
            parameters = pika.ConnectionParameters(
                host='rabbitmq', 
                port=5672,
                virtual_host='/',
                credentials=credentials
            )
            
            self.connection = pika.BlockingConnection(parameters)
            self.channel = self.connection.channel()
            
            # Declare the notification queue
            self.channel.queue_declare(
                queue='notifications',
                durable=True  # Queue survives RabbitMQ restarts
            )
            
            logger.info("Connected to RabbitMQ successfully")
            
        except Exception as e:
            logger.error(f"Failed to connect to RabbitMQ: {e}")
            raise
    
    def publish_notification(self, client_ids: list, title: str, body: str) -> str:
        """Publish notification job to queue"""
        try:
            message = {
                "client_ids": client_ids,
                "title": title,
                "body": body
            }
            
            self.channel.basic_publish(
                exchange='',
                routing_key='notifications',
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Make message persistent
                )
            )
            
            logger.info(f"Published notification for {len(client_ids)} users")
            return f"notification_{len(client_ids)}_users"
            
        except Exception as e:
            logger.error(f"Failed to publish notification: {e}")
            raise
    
    def close(self):
        """Close RabbitMQ connection"""
        if self.connection and not self.connection.is_closed:
            self.connection.close()

# Create a global instance
rabbitmq_service = RabbitMQService()