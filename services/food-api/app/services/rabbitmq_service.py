from typing import List
import pika
import json
import logging
import threading
from app.database import SessionLocal
from app.models.users import OrangeUser
from app.services.push_service import push_service
from contextlib import contextmanager

logger = logging.getLogger(__name__)


class RabbitMQService:
    def __init__(self):
        self._connection_params = None
        self._publish_connection = None
        self._publish_channel = None
        self._consume_connection = None
        self._consume_channel = None
        self._setup_connection_parameters()
        self._ensure_publish_connection()

    def _setup_connection_parameters(self):
        """Configure RabbitMQ connection parameters"""
        self._connection_params = pika.ConnectionParameters(
            host="rabbitmq",
            port=5672,
            virtual_host="/",
            credentials=pika.PlainCredentials("admin", "password"),
            heartbeat=600,
            blocked_connection_timeout=300,
            connection_attempts=5,
            retry_delay=5,
        )

    def _ensure_publish_connection(self):
        """Ensure we have an active publishing connection"""
        if self._publish_connection is None or self._publish_connection.is_closed:
            try:
                self._publish_connection = pika.BlockingConnection(
                    self._connection_params
                )
                self._publish_channel = self._publish_connection.channel()
                self._publish_channel.queue_declare(
                    queue="notifications",
                    durable=True,
                    arguments={"x-max-priority": 10},  
                )
                logger.info("Publish connection established")
            except Exception as e:
                logger.error(f"Failed to establish publish connection: {e}")
                raise

    def _ensure_consume_connection(self):
        """Ensure we have an active consumer connection"""
        if self._consume_connection is None or self._consume_connection.is_closed:
            try:
                self._consume_connection = pika.BlockingConnection(
                    self._connection_params
                )
                self._consume_channel = self._consume_connection.channel()
                self._consume_channel.queue_declare(queue="notifications", durable=True,arguments={"x-max-priority": 10})
                self._consume_channel.basic_qos(
                    prefetch_count=10
                )  # Process 10 messages at a time
                logger.info("Consumer connection established")
            except Exception as e:
                logger.error(f"Failed to establish consumer connection: {e}")
                raise

    @contextmanager
    def _get_db_session(self):
        """Provide a transactional scope around database operations"""
        session = SessionLocal()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def publish_notification(self, client_ids: List[str], title: str, body: str) -> str:
        """Publish notification to RabbitMQ queue"""
        try:
            self._ensure_publish_connection()

            message = {"client_ids": client_ids, "title": title, "body": body}

            self._publish_channel.basic_publish(
                exchange="",
                routing_key="notifications",
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent message
                    content_type="application/json",
                    priority=5,  # Medium priority
                ),
            )

            job_id = f"notify_{len(client_ids)}_{hash(tuple(client_ids))}"
            logger.info(
                f"Published notification job {job_id} for {len(client_ids)} users"
            )
            return job_id

        except pika.exceptions.AMQPConnectionError:
            logger.error("Connection lost, attempting to reconnect...")
            self._publish_connection = None
            return self.publish_notification(client_ids, title, body)
        except Exception as e:
            logger.error(f"Failed to publish notification: {e}")
            raise

    def _process_single_notification(
        self, user: OrangeUser, title: str, body: str
    ) -> bool:
        """Process notification for a single user"""
        try:
            if not user.push_subscription:
                logger.debug(f"User {user.client_id} has no push subscription")
                return False

            if user.is_banned:
                logger.debug(f"User {user.client_id} is banned, skipping")
                return False

            push_service.send_notification(
                subscription=user.push_subscription, title=title, body=body
            )
            return True
        except Exception as e:
            logger.error(f"Failed to send notification to {user.client_id}: {e}")
            return False

    def _process_notification_batch(self, client_ids: List[str], title: str, body: str):
        """Process a batch of notifications efficiently"""
        with self._get_db_session() as db:
            try:
                # Fetch all users in a single query
                users = (
                    db.query(OrangeUser)
                    .filter(OrangeUser.client_id.in_(client_ids))
                    .all()
                )

                total = len(users)
                successful = 0
                failed = 0

                for user in users:
                    if self._process_single_notification(user, title, body):
                        successful += 1
                    else:
                        failed += 1

                logger.info(
                    f"Notification batch processed - "
                    f"Total: {total}, Success: {successful}, Failed: {failed}"
                )
                return successful, failed

            except Exception as e:
                logger.error(f"Error processing notification batch: {e}")
                raise

    def _on_message_callback(self, channel, method, properties, body):
        """Handle incoming messages from RabbitMQ"""
        try:
            message = json.loads(body)
            client_ids = message["client_ids"]
            title = message["title"]
            body_text = message["body"]

            logger.info(f"Processing notification for {len(client_ids)} users: {title}")

            successful, failed = self._process_notification_batch(
                client_ids, title, body_text
            )

            # Acknowledge message only after successful processing
            channel.basic_ack(delivery_tag=method.delivery_tag)
            logger.info(f"Notification processed - ACK sent for {method.delivery_tag}")

        except json.JSONDecodeError as e:
            logger.error(f"Invalid message format: {e}")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            channel.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

    def start_consumer(self):
        """Start consuming messages from RabbitMQ"""
        self._ensure_consume_connection()

        try:
            self._consume_channel.basic_consume(
                queue="notifications",
                on_message_callback=self._on_message_callback,
                auto_ack=False,
            )
            logger.info("Notification consumer started")
            self._consume_channel.start_consuming()
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise
        finally:
            self.close_consumer()

    def start_consumer_thread(self):
        """Start the consumer in a background thread"""

        def consumer_worker():
            while True:
                try:
                    self.start_consumer()
                except Exception as e:
                    logger.error(f"Consumer thread crashed, restarting: {e}")
                    import time

                    time.sleep(5)  # Wait before restarting

        thread = threading.Thread(target=consumer_worker, daemon=True)
        thread.start()
        logger.info("Started RabbitMQ consumer thread")
        return thread

    def close(self):
        """Close all connections"""
        try:
            if self._publish_connection and self._publish_connection.is_open:
                self._publish_connection.close()
            if self._consume_connection and self._consume_connection.is_open:
                self._consume_connection.close()
            logger.info("All RabbitMQ connections closed")
        except Exception as e:
            logger.error(f"Error closing connections: {e}")

    def close_consumer(self):
        """Close consumer connection specifically"""
        try:
            if self._consume_connection and self._consume_connection.is_open:
                self._consume_connection.close()
            logger.info("Consumer connection closed")
        except Exception as e:
            logger.error(f"Error closing consumer connection: {e}")


# Global instance
rabbitmq_service = RabbitMQService()
