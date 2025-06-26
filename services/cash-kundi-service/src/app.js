const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { Pool } = require("pg");
const webpush = require("web-push");
const promClient = require("prom-client");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3004;
const DATABASE_URL = process.env.DATABASE_URL;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const register = new promClient.Registry();
promClient.collectDefaultMetrics({
  register,
  prefix: "badal_service_",
});

const httpRequestsTotal = new promClient.Counter({
  name: "badal_service_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: "badal_service_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const databaseConnectionsActive = new promClient.Gauge({
  name: "badal_service_database_connections_active",
  help: "Number of active database connections",
  registers: [register],
});

// RabbitMQ configuration
const RABBITMQ_CONFIG = {
  host: process.env.RABBITMQ_HOST,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USER,
  password: process.env.RABBITMQ_PASSWORD,
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

const metricsMiddleware = (req, res, next) => {
  const startTime = Date.now();

  res.on("finish", () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route ? req.route.path : req.path;

    httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
  });

  next();
};

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection failed:", err.message);
  } else {
    console.log("✅ Connected to NeonDB PostgreSQL");
    databaseConnectionsActive.set(pool.totalCount);
    release();
  }
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(metricsMiddleware);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error);
  }
});

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
});

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");

  pool.end(() => {
    console.log("Database connections closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = app;
