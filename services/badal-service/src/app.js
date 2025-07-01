const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const { Pool } = require("pg");
const webpush = require("web-push");
const promClient = require("prom-client");
const FridgeRepository = require("./my-fridge/my-fridge-repo");
const FridgeService = require("./my-fridge/fridge-service");
const NotificationService = require("./my-fridge/notification-service");
const NotificationLogic = require("./my-fridge/notification-logic");
const NotificationScheduler = require("./my-fridge/scheduler");
const FoodService = require("./food-entry/food-service");
const FoodEntryRepository = require("./food-entry/food-entry-repo");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3003;
const DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgres://default:hz5UOc2QjfuM@ep-purple-glitter-a1u2cptf-pooler.ap-southeast-1.aws.neon.tech/verceldb?sslmode=require";
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
//intialise fridge service
const fridgeRepository = new FridgeRepository(pool);
const fridgeService = new FridgeService(fridgeRepository);
const foodEntryRepository = new FoodEntryRepository(pool);
const foodService = new FoodService(foodEntryRepository);

const notificationService = new NotificationService();
const notificationLogic = new NotificationLogic(
  fridgeRepository,
  notificationService
);
const scheduler = new NotificationScheduler(notificationLogic);

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
    message: "Orange Food Service API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ornge-badal-service",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// Import and use the fridge service
app.post("/fridge", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }
    const fridgeName = req.body.name;
    if (!fridgeName) {
      return res.status(400).json({
        success: false,
        error: "Fridge name is required",
      });
    }
    const fridge = await fridgeService.createFridge(clientId, fridgeName);
    res.json({
      success: true,
      fridge,
    });
  } catch (error) {
    console.error("Error creating fridge:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.get("/fridge", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }
    const fridge = await fridgeService.getFridge(clientId);
    if (!fridge) {
      return res.status(404).json({
        success: false,
        error: "Fridge not found",
      });
    }
    res.json({
      success: true,
      fridge,
    });
  } catch (error) {
    console.error("Error fetching fridge:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.get("/fridge/items", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }
    const fridgeItems = await fridgeService.getFridgeItems(clientId);
    res.json({
      success: true,
      fridgeItems,
    });
  } catch (error) {
    console.error("Error fetching fridge items:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.post("/fridge/items", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }
    const item = req.body;
    if (
      !item ||
      !item.name ||
      !item.category ||
      !item.quantity ||
      !item.expiry_date
    ) {
      return res.status(400).json({
        success: false,
        error: "Item details are incomplete",
      });
    }
    const newItem = await fridgeService.addFridgeItem(clientId, item);
    res.json({
      success: true,
      item: newItem,
    });
  } catch (error) {
    console.error("Error adding fridge item:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.put("/fridge/items", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }
    const itemUpdate = req.body;
    if (!itemUpdate || !itemUpdate.id || !itemUpdate.operation_type) {
      return res.status(400).json({
        success: false,
        error: "Item update details are incomplete",
      });
    }
    const updatedItem = await fridgeService.updateFridgeItem(
      clientId,
      itemUpdate
    );
    res.json({
      success: true,
      item: updatedItem,
    });
  } catch (error) {
    console.error("Error updating fridge item:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
// GET food entries by date
app.get("/food/entries", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const { date, start_date, end_date, category } = req.query;

    if (!date && (!start_date || !end_date)) {
      return res.status(400).json({
        success: false,
        error:
          "Either date or date range (start_date and end_date) is required",
      });
    }

    let foodEntries;

    if (date && category) {
      foodEntries = await foodService.getUserFoodEntriesByDateAndCategory(
        clientId,
        date,
        category
      );
    } else if (date) {
      foodEntries = await foodService.getUserFoodEntriesByDate(clientId, date);
    } else {
      foodEntries = await foodService.getUserFoodEntriesByDateRange(
        clientId,
        start_date,
        end_date
      );
    }

    res.json({
      success: true,
      foodEntries,
    });
  } catch (error) {
    console.error("Error fetching food entries:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.post("/food/entries", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const { date, meal_type, food_category, food_name, calories, mood_tag } =
      req.body;

    if (
      !date ||
      !meal_type ||
      !food_category ||
      !food_name ||
      calories === undefined
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Required fields: date, meal_type, food_category, food_name, calories",
      });
    }

    const newEntry = await foodService.createUserFoodEntry(
      clientId,
      date,
      meal_type,
      food_category,
      food_name,
      calories,
      mood_tag
    );

    res.json({
      success: true,
      foodEntry: newEntry,
    });
  } catch (error) {
    console.error("Error creating food entry:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.get("/food/dayEntries", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: "Date is required",
      });
    }
    const foodEntries = await foodService.getWeeklyEntries(clientId);
    const entriesByDate = {};

    foodEntries.forEach((entry) => {
      const entryDate = entry.date;
      if (!entriesByDate[entryDate]) {
        entriesByDate[entryDate] = {
          meals: [],
          totalCalories: 0,
        };
      }

      entriesByDate[entryDate].meals.push({
        id: entry.id,
        type: entry.meal_type,
        name: entry.food_name,
        calories: entry.calories,
        category: entry.food_category,
        emoji: entry.emoji,
        moodTag: entry.mood_tag,
      });

      entriesByDate[entryDate].totalCalories += entry.calories;
    });
    const dayEntries = Object.keys(entriesByDate).map((date) => ({
      date,
      totalCalories: entriesByDate[date].totalCalories,
      meals: entriesByDate[date].meals,
    }));

    res.json({
      success: true,
      dayEntries,
    });
  } catch (error) {
    console.error("Error fetching food stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});
app.get("/food/weeklyStats", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const weeklyStats = await foodService.getWeeklyStats(clientId);

    res.json({
      success: true,
      weeklyStats,
    });
  } catch (error) {
    console.error("Error fetching food stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

app.put("/food/entries/:id", async (req, res) => {
  try {
    const clientId = req.headers["x-client-id"] || req.cookies.clientId;
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: "Client ID is required",
      });
    }

    const { id } = req.params;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Food entry ID is required",
      });
    }

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Update data is required",
      });
    }

    const updatedEntry = await foodService.updateUserFoodEntry(
      id,
      clientId,
      updates
    );

    res.json({
      success: true,
      foodEntry: updatedEntry,
    });
  } catch (error) {
    console.error("Error updating food entry:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
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
  console.log(`🚀 Orange Food service running on port ${PORT}`);
  scheduler.start();
});

const gracefulShutdown = async () => {
  console.log("Shutting down gracefully...");
  scheduler.stop();
  pool.end(() => {
    console.log("Database connections closed");
    process.exit(0);
  });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

module.exports = app;
