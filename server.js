const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// API Key middleware
const authenticateApiKey = (req, res, next) => {
  // Get API key from header (support both formats)
  const authHeader = req.headers["authorization"] || "";
  const apiKey = req.headers["x-api-key"] || (authHeader.startsWith("Bearer ") ? authHeader.substring(7) : authHeader);

  // Validate API key
  if (!apiKey || apiKey !== process.env.RENDER_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid API key required",
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${req.headers["x-request-id"] || "no-request-id"}`);
  next();
});

// Health check endpoint (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
    service: "mcp-node"
  });
});

// MCP chat endpoint
app.post("/api/v1/chat", authenticateApiKey, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Messages array is required",
        timestamp: new Date().toISOString()
      });
    }

    // Process the chat request
    const response = {
      id: `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: "This is a test response from the MCP server.",
          },
          finish_reason: "stop"
        }
      ],
      usage: {
        prompt_tokens: messages.reduce((acc, m) => acc + m.content.length, 0),
        completion_tokens: 12,
        total_tokens: messages.reduce((acc, m) => acc + m.content.length, 0) + 12
      },
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Metrics endpoint (for monitoring)
app.get("/metrics", authenticateApiKey, (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    requests: {
      total: 0,
      success: 0,
      error: 0
    },
    latency: {
      p50: 0,
      p95: 0,
      p99: 0
    }
  });
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
});