const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Key middleware
const authenticateApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"] || req.headers["authorization"];
  const cleanKey = apiKey?.replace("Bearer ", "");
  
  // Temporary direct comparison for testing
  const EXPECTED_KEY = "rnd_1079m815tfsLvEjhR7pEUlkeLoNk";
  
  console.log("Auth check:", {
    receivedKey: cleanKey,
    matches: cleanKey === EXPECTED_KEY
  });

  if (!cleanKey || cleanKey !== EXPECTED_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid API key required",
      timestamp: new Date().toISOString(),
      debug: {
        keyReceived: cleanKey || "none",
        matches: cleanKey === EXPECTED_KEY
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
    message: "Using hardcoded API key for testing"
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
  console.log("Using hardcoded API key for testing");
});