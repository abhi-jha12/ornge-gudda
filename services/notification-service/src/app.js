const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { Pool } = require("pg");
const webpush = require("web-push");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://default:hz5UOc2QjfuM@ep-purple-glitter-a1u2cptf-pooler.ap-southeast-1.aws.neon.tech/verceldb?sslmode=require";
const VAPID_PUBLIC_KEY =
  "BJGiGGiQ3z1BvTNujXCZblPCOV7dAGyi0A4lbtQT0qpRMblF3xt0L71ybVbUIIxqAZIpLeqTPlLyd7OiGj79LDU";
const VAPID_PRIVATE_KEY = "QK8yWCuYRVf5rs6HVEyFmqxVuQQweV2No4FYBC87o30";
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

pool.connect((err, release) => {
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
app.use(express.static(path.join(__dirname, '..', 'public')));

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
  });
});


// Push notification endpoint
app.post("/api/send-notification", async (req, res) => {
  try {
    const { client_id, title, body } = req.body;

    // Validate required fields
    if (!client_id || !title || !body) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: client_id, title, body",
      });
    }

    // Get user's push subscription from database
    const userResult = await pool.query(
      "SELECT push_subscription FROM orange_users WHERE client_id = $1",
      [client_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    const pushSubscription = userResult.rows[0].push_subscription;

    if (!pushSubscription) {
      return res.status(400).json({
        success: false,
        error: "User has no push subscription",
      });
    }

    // Parse subscription data (assuming it's stored as JSON string)
    let subscription;
    try {
      subscription =
        typeof pushSubscription === "string"
          ? JSON.parse(pushSubscription)
          : pushSubscription;
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        error: "Invalid push subscription format",
      });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Send push notification
    const notificationPayload = JSON.stringify({
      title,
      body,
      icon: `${baseUrl}/icons/icon_lg.png`,
      badge: `${baseUrl}/icons/icon_md.png`,
      vibrate: [100, 50, 100],
      tag: "notification",
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
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

    res.json({
      success: true,
      message: "Push notification sent successfully",
      client_id,
    });
  } catch (error) {
    console.error("Push notification error:", error);

    // Handle specific web-push errors
    if (error.statusCode === 410) {
      // Subscription is no longer valid, you might want to remove it from database
      res.status(410).json({
        success: false,
        error: "Push subscription is no longer valid",
      });
    } else {
      res.status(500).json({
        success: false,
        error: "Failed to send push notification",
      });
    }
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
  console.log(`🚀 Orange User service running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});

// Graceful shutdown
const gracefulShutdown = () => {
  console.log("Shutting down gracefully...");
  pool.end(() => {
    console.log("Database connections closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = app;
