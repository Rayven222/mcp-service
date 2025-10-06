const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
const authenticateToken = (req, res, next) => {
  const token = req.headers['x-render-token'] || req.headers['authorization'];
  
  if (!token || token !== process.env.RENDER_API_TOKEN) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Valid token required",
      timestamp: new Date().toISOString(),
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
  });
});

// Chat endpoint with auth
app.post("/api/v1/chat", authenticateToken, async (req, res) => {
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
});