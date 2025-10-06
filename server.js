const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

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
    version: "1.0.1",
    service: "mcp-node",
    ai_enabled: !!process.env.OPENAI_API_KEY,
    openai_key_length: process.env.OPENAI_API_KEY?.length || 0,
  });
});

// MCP chat endpoint with OpenAI integration
app.post("/api/v1/chat", async (req, res) => {
  try {
    const { messages, message, user_id, conversation_id } = req.body;

    // Support both formats: messages array or single message
    const messageArray =
      messages || (message ? [{ role: "user", content: message }] : []);

    if (!messageArray || messageArray.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Messages array or message field is required",
        timestamp: new Date().toISOString(),
      });
    }

    const userMessage = messageArray[messageArray.length - 1].content;
    console.log("Processing message with OpenAI:", userMessage);
    console.log("OpenAI key present:", !!process.env.OPENAI_API_KEY);
    console.log("OpenAI key starts with:", process.env.OPENAI_API_KEY?.substring(0, 10));

    // Call OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("Calling OpenAI API...");
        const openaiResponse = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              messages: messageArray,
              temperature: 0.7,
              max_tokens: 500,
            }),
          }
        );

        console.log("OpenAI response status:", openaiResponse.status);

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          console.log("Got response from OpenAI:", openaiData.choices[0].message.content);

          // Return in the expected format
          const response = {
            id: openaiData.id || `mcp_${Date.now()}`,
            choices: openaiData.choices.map((choice) => ({
              message: {
                role: choice.message.role,
                content: choice.message.content,
              },
              finish_reason: choice.finish_reason,
            })),
            usage: openaiData.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
            timestamp: new Date().toISOString(),
          };

          return res.json(response);
        } else {
          const errorData = await openaiResponse.json();
          console.error("OpenAI API error:", errorData);
          
          return res.status(500).json({
            error: "OpenAI API error",
            message: errorData.error?.message || "Unknown error",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (openaiError) {
        console.error("OpenAI fetch error:", openaiError.message);
        console.error("Error details:", openaiError);
        
        return res.status(500).json({
          error: "Failed to connect to OpenAI",
          message: openaiError.message,
          timestamp: new Date().toISOString(),
        });
      }
    } else {
      console.log("No OpenAI API key configured");
      
      return res.status(503).json({
        error: "Service not configured",
        message: "OPENAI_API_KEY environment variable is not set",
        timestamp: new Date().toISOString(),
      });
    }
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
  console.log("OpenAI enabled:", !!process.env.OPENAI_API_KEY);
  console.log("OpenAI key length:", process.env.OPENAI_API_KEY?.length || 0);
});