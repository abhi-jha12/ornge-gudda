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
const PORT = process.env.PORT || 3004;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// RabbitMQ configuration
const RABBITMQ_CONFIG = {
  host: process.env.RABBITMQ_HOST ,
  port: process.env.RABBITMQ_PORT ,
  username: process.env.RABBITMQ_USER ,
  password: process.env.RABBITMQ_PASSWORD ,
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
    message: "Orange Finance Service API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ornge-cash-kundi-service",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    rabbitmq: rabbitConnection ? "connected" : "disconnected",
  });
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
  console.log(`🚀 Orange Finance service running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  connectToRabbitMQ()

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
