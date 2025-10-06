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
    version: "1.0.0",
    service: "mcp-node",
    ai_enabled: !!process.env.OPENAI_API_KEY,
  });
});

// MCP chat endpoint with OpenAI integration
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

    console.log("Processing message with OpenAI:", messageArray[messageArray.length - 1].content);

    // Call OpenAI API
    if (process.env.OPENAI_API_KEY) {
      try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: messageArray,
            temperature: 0.7,
            max_tokens: 500
          })
        });

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          console.log("Got response from OpenAI");
          
          // Return in the expected format
          const response = {
            id: openaiData.id || `mcp_${Date.now()}`,
            choices: openaiData.choices.map(choice => ({
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
          console.error("OpenAI error:", errorData);
        }
      } catch (openaiError) {
        console.error("OpenAI fetch error:", openaiError.message);
      }
    } else {
      console.log("No OpenAI API key configured");
    }

    // Fallback response if OpenAI fails or is not configured
    console.log("Using fallback response");
    const fallbackResponse = {
      id: `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: "I'm currently unable to connect to the AI service. Please configure the OPENAI_API_KEY environment variable in Render dashboard for full AI capabilities.",
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0),
        completion_tokens: 20,
        total_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0) + 20,
      },
      timestamp: new Date().toISOString(),
    };

    res.json(fallbackResponse);
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
});