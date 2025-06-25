const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const { Pool } = require("pg");
const UserRepository = require("./user/user-repo");
const UserService = require("./user/user-service");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_URL =
  process.env.DATABASE_URL;
const pool = new Pool({ connectionString: DATABASE_URL });
const initializeDatabase = async () => {
  try {
    const client = await pool.connect();
    console.log("✅ Connected to NeonDB PostgreSQL");
    client.release();
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  }
};
const userRepository = new UserRepository(pool);
const userService = new UserService(userRepository);
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(morgan("combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const authenticateUser = async (req, res, next) => {
  try {
    const client_id = req.cookies.clientId || req.headers["x-client-id"];

    if (!client_id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const user = await userService.getUserByClientId(client_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

const checkUserSubscription = async (req, res, next) => {
  try {
    const client_id = req.cookies.clientId || req.headers["x-client-id"];
    if (!client_id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    const subs = await userService.getUserSubscription(client_id);
    if (!subs) {
      return res.status(404).json({
        success: false,
        error: "Subscription not found",
      });
    }
    req.userSubscription = subs;
    next();
  } catch (error) {
    console.error("Error in checkUserSubscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while checking user subscription",
    });
  }
};

const attachIpAndWeather = async (req, res, next) => {
  try {
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.headers["x-real-ip"] ||
      req.ip ||
      "127.0.0.1";
    const ipInfoResponse = await fetch("https://bscan.info/api/ipinfo", {
      headers: {
        "Content-Type": "application/json",
        Referer: "https://bscan.info",
        "X-Forwarded-For": clientIp,
      },
    });

    const ipData = await ipInfoResponse.json();
    const ipInfo = {
      data: ipData,
    };
    if (ipData.loc) {
      const [lat, lon] = ipData.loc.split(",");
      const apiKey = "1ab3b1fb58d5738e290b8d859ff318e4";
      const weatherRes = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`
      );

      if (weatherRes.ok) {
        const weatherData = await weatherRes.json();
        ipInfo.weather = {
          temp: weatherData.main?.temp,
          conditions: weatherData.weather?.map((w) => ({
            main: w.main,
          })),
        };
      }
    }

    req.ipInfo = ipInfo;
  } catch (error) {
    console.error("Error in attachIpAndWeather:", error);
    req.ipInfo = {
      ip: clientIp || "Unknown",
      error: "Could not fetch complete IP information",
      ...(req.ipInfo || {}),
    };
  }
  next();
};

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Orange User Service API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "orange-user-service",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// User endpoints
app.get("/api/me", authenticateUser, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

app.post("/api/me", authenticateUser, async (req, res, next) => {
  try {
    const client_id = req.cookies.clientId || req.headers["x-client-id"];
    if (!client_id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    const userData = req.body;
    if (!userData || Object.keys(userData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No user data provided for update",
      });
    }
    const updatedUser = await userService.updateUserByClientId(
      client_id,
      userData
    );
    res.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while updating user",
    });
  }
});

app.get("/api/me/context", attachIpAndWeather, async (req, res) => {
  res.json({
    success: true,
    ipInfo: req.ipInfo,
  });
});

app.get(
  "/api/me/subscription",
  authenticateUser,
  checkUserSubscription,
  (req, res) => {
    res.json({
      success: true,
      subscription: req.userSubscription,
    });
  }
);

app.post("/api/me/subscription", authenticateUser, async (req, res, next) => {
  try {
    const client_id = req.cookies.clientId || req.headers["x-client-id"];
    if (!client_id) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }
    const subscriptionData = req.body;
    if (!subscriptionData || Object.keys(subscriptionData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "No subscription data provided for update",
      });
    }
    const updatedSubscription = await userService.updateUserSubscription(
      client_id,
      subscriptionData
    );
    res.json({
      success: true,
      subscription: updatedSubscription,
    });
  } catch (error) {
    console.error("Error updating subscription:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error while updating subscription",
    });
  }
});

app.get("/api/users/:id", authenticateUser, async (req, res, next) => {
  try {
    if (req.params.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: "Unauthorized access",
      });
    }

    const user = await userService.getUserById(req.params.id);
    res.json({
      success: true,
      user: user,
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Error:", error);
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 ? "Internal server error" : error.message;

  res.status(statusCode).json({
    success: false,
    error: message,
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
});
const startServer = async () => {
  await initializeDatabase();

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Orange User service running on port ${PORT}`);
  });
  const gracefulShutdown = async () => {
    console.log("Shutting down gracefully...");
    server.close(async () => {
      await pool.end();
      console.log("Database connections closed");
      process.exit(0);
    });
  };

  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);
};

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

module.exports = app;
