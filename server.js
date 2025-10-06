const express = require("express");
const cors = require("cors");
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Try to read API key from secrets file
let secretApiKey;
try {
  secretApiKey = fs.readFileSync('/etc/secrets/RENDER_API_KEY', 'utf8').trim();
  console.log("Found API key in secrets file");
} catch (error) {
  console.log("No API key in secrets file:", error.message);
}

// Get API key from environment or secrets
const API_KEY = process.env.RENDER_API_KEY || secretApiKey;

// Middleware
app.use(cors());
app.use(express.json());

// API Key middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"];
  const cleanKey = apiKey?.replace("Bearer ", "");
  
  console.log("Auth check:", {
    receivedKey: cleanKey,
    envKeyPresent: !!process.env.RENDER_API_KEY,
    secretKeyPresent: !!secretApiKey,
    finalKeyPresent: !!API_KEY
  });

  if (!cleanKey || cleanKey !== API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid API key required",
      timestamp: new Date().toISOString(),
      debug: {
        keyReceived: cleanKey || "none",
        envKeyPresent: !!process.env.RENDER_API_KEY,
        secretKeyPresent: !!secretApiKey,
        finalKeyPresent: !!API_KEY
      }
    });
  }
  next();
};

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    env: {
      envKeyPresent: !!process.env.RENDER_API_KEY,
      secretKeyPresent: !!secretApiKey,
      finalKeyPresent: !!API_KEY,
      nodeEnv: process.env.NODE_ENV
    }
  });
});

// Chat endpoint with auth
app.post("/api/v1/chat", authenticateApiKey, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages) {
      return res.status(400).json({
        error: "Messages array is required",
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      id: `chat_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: "This is a test response.",
          },
        },
      ],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log("API Key sources:", {
    fromEnv: !!process.env.RENDER_API_KEY,
    fromSecrets: !!secretApiKey,
    finalKey: !!API_KEY
  });
});