const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path}`
  );
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "1.0.0",
    service: "mcp-node",
  });
});

// MCP chat endpoint - NO AUTH FOR NOW
app.post("/api/v1/chat", async (req, res) => {
  try {
    const { messages, message, user_id, conversation_id } = req.body;

    // Support both formats: messages array or single message
    const messageArray = messages || (message ? [{ role: "user", content: message }] : []);

    if (!messageArray || messageArray.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Messages array or message field is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Process the chat request
    const response = {
      id: `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: "Hello! I'm your MCP AI assistant. I'm connected and working!",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0),
        completion_tokens: 15,
        total_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0) + 15,
      },
      timestamp: new Date().toISOString(),
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
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
  console.log(`MCP Server running on port ${PORT}`);
  console.log('Auth disabled for testing');
});