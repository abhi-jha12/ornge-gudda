const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { Pool } = require("pg");
const webpush = require("web-push");
const amqp = require("amqplib");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3002;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://default:hz5UOc2QjfuM@ep-purple-glitter-a1u2cptf-pooler.ap-southeast-1.aws.neon.tech/verceldb?sslmode=require";
const VAPID_PUBLIC_KEY =
  "BJGiGGiQ3z1BvTNujXCZblPCOV7dAGyi0A4lbtQT0qpRMblF3xt0L71ybVbUIIxqAZIpLeqTPlLyd7OiGj79LDU";
const VAPID_PRIVATE_KEY = "QK8yWCuYRVf5rs6HVEyFmqxVuQQweV2No4FYBC87o30";

// RabbitMQ configuration
const RABBITMQ_CONFIG = {
  host: process.env.RABBITMQ_HOST || "rabbitmq",
  port: process.env.RABBITMQ_PORT || 5672,
  username: process.env.RABBITMQ_USER || "admin",
  password: process.env.RABBITMQ_PASSWORD || "password",
  vhost: process.env.RABBITMQ_VHOST || "/",
};

const RABBITMQ_URL = `amqp://${RABBITMQ_CONFIG.username}:${RABBITMQ_CONFIG.password}@${RABBITMQ_CONFIG.host}:${RABBITMQ_CONFIG.port}${RABBITMQ_CONFIG.vhost}`;

const pool = new Pool({
  connectionString: DATABASE_URL,
});

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    "https://ornge.in/",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}
let rabbitConnection = null;
let rabbitChannel = null;

async function connectToRabbitMQ() {
  try {
    rabbitConnection = await amqp.connect(RABBITMQ_URL);
    rabbitChannel = await rabbitConnection.createChannel();
    const queueName = "notification_queue";
    await rabbitChannel.assertQueue(queueName, {
      durable: true,
    });
    console.log(`📥 Listening for messages on queue: ${queueName}`);

    // Set up consumer
    rabbitChannel.consume(queueName, async (message) => {
      if (message) {
        try {
          const notificationData = JSON.parse(message.content.toString());
          await processNotification(notificationData);
          rabbitChannel.ack(message);
        } catch (error) {
          console.error("❌ Error processing notification message:", error);
          rabbitChannel.nack(message, false, true);
        }
      }
    });
    rabbitConnection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err);
    });

    rabbitConnection.on("close", () => {
      console.log("RabbitMQ connection closed");
      setTimeout(connectToRabbitMQ, 5000);
    });
  } catch (error) {
    console.error("❌ Failed to connect to RabbitMQ:", error);
    setTimeout(connectToRabbitMQ, 5000);
  }
}

// Process notification function
async function processNotification(notificationData) {
  const { client_id, title, body, type } = notificationData;

  if (!client_id || !title || !body) {
    console.error("Invalid notification data:", notificationData);
    return;
  }

  try {
    const userResult = await pool.query(
      "SELECT push_subscription FROM orange_users WHERE client_id = $1",
      [client_id]
    );

    if (userResult.rows.length === 0) {
      console.log(`User not found: ${client_id}`);
      return;
    }

    const pushSubscription = userResult.rows[0].push_subscription;

    if (!pushSubscription) {
      console.log(`User has no push subscription: ${client_id}`);
      return;
    }

    let subscription;
    try {
      subscription =
        typeof pushSubscription === "string"
          ? JSON.parse(pushSubscription)
          : pushSubscription;
    } catch (parseError) {
      console.error("Invalid push subscription format:", parseError);
      return;
    }
    const baseUrl = `https://ornge.site/notification-service`;

    // Send push notification
    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: `${baseUrl}/icons/icon_lg.png`,
      badge: `${baseUrl}/icons/icon_md.png`,
      vibrate: [100, 50, 100],
      tag: type || "notification",
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        type,
      },
      actions: [
        {
          action: "explore",
          title: "View",
        },
      ],
    });

    await webpush.sendNotification(subscription, notificationPayload, {
      urgency: "high",
      TTL: 86400,
    });

    console.log(`✅ Push notification sent to ${client_id}`);
  } catch (error) {
    console.error("❌ Error sending push notification:", error);

    if (error.statusCode === 410) {
      console.log(`Removing invalid subscription for user: ${client_id}`);
      await pool.query(
        "UPDATE orange_users SET push_subscription = NULL WHERE client_id = $1",
        [client_id]
      );
    }
  }
}

// Helper function to send notification to RabbitMQ queue
async function queueNotification(client_id, title, body, type = "general") {
  try {
    if (!rabbitChannel) {
      throw new Error("RabbitMQ not connected");
    }

    const message = JSON.stringify({
      client_id,
      title,
      body,
      type,
      timestamp: new Date().toISOString(),
    });

    await rabbitChannel.sendToQueue(
      "notification_queue",
      Buffer.from(message),
      {
        persistent: true,
      }
    );
  } catch (error) {
    console.error("Failed to queue notification:", error);
    throw error;
  }
}

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to NeonDB PostgreSQL");
    release();
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "..", "public")));

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Orange Notification Service API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "orange-notification-service",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    rabbitmq: rabbitConnection ? "connected" : "disconnected",
  });
});

// Single notification endpoint
app.post("/api/send-notification", async (req, res) => {
  try {
    const { client_id, title, body, type } = req.body;

    if (!client_id || !title || !body) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: client_id, title, body",
      });
    }

    // Queue the notification
    await queueNotification(client_id, title, body, type);

    res.json({
      success: true,
      message: "Notification queued successfully",
      client_id,
    });
  } catch (error) {
    console.error("Queue notification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to queue notification",
    });
  }
});

// Bulk notification endpoint
app.post("/api/send-bulk-notifications", async (req, res) => {
  try {
    const { client_ids, title, body, type } = req.body;

    // Validate input
    if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: "client_ids must be a non-empty array",
      });
    }

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: title, body",
      });
    }

    if (client_ids.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Maximum 1000 client_ids allowed per request",
      });
    }

    // Queue notifications for all client_ids
    const results = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const client_id of client_ids) {
      try {
        await queueNotification(client_id, title, body, type);
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          client_id,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      message: "Bulk notifications processed",
      total: client_ids.length,
      results,
    });
  } catch (error) {
    console.error("Bulk notification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process bulk notifications",
    });
  }
});

// Direct send notification endpoint
app.post("/api/send-notification-direct", async (req, res) => {
  try {
    const { client_id, title, body, type } = req.body;

    if (!client_id || !title || !body) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: client_id, title, body",
      });
    }

    await processNotification({ client_id, title, body, type });

    res.json({
      success: true,
      message: "Push notification sent directly",
      client_id,
    });
  } catch (error) {
    console.error("Direct notification error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send notification directly",
    });
  }
});

// Error handling
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});

// Server startup
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Orange Notification service running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);

  connectToRabbitMQ();
});

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");
  if (rabbitChannel) {
    await rabbitChannel.close();
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
  }

  pool.end(() => {
    console.log("Database connections closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = app;
