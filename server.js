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
  });
});

// MCP chat endpoint with AI integration
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

    console.log("Processing message:", JSON.stringify(messageArray, null, 2));

    // Try to connect to local MCP orchestrator first
    const MCP_URL = process.env.MCP_ORCHESTRATOR_URL || 'http://localhost:8600';
    let aiResponse = null;

    try {
      console.log("Attempting to connect to MCP orchestrator:", MCP_URL);
      const mcpResponse = await fetch(`${MCP_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messageArray,
          user_id: user_id,
          conversation_id: conversation_id
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (mcpResponse.ok) {
        aiResponse = await mcpResponse.json();
        console.log("Got response from MCP orchestrator");
      }
    } catch (mcpError) {
      console.log("MCP orchestrator unavailable, trying OpenAI:", mcpError.message);
    }

    // Fallback to OpenAI if MCP is unavailable
    if (!aiResponse && process.env.OPENAI_API_KEY) {
      console.log("Using OpenAI fallback");
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
          aiResponse = {
            content: openaiData.choices[0].message.content,
            confidence: 1.0,
            agents_consulted: ['openai-gpt-3.5'],
            metadata: {
              processing_time: 0,
              persona: 'professional',
              timestamp: new Date().toISOString()
            }
          };
          console.log("Got response from OpenAI");
        }
      } catch (openaiError) {
        console.error("OpenAI error:", openaiError.message);
      }
    }

    // If we got a response from either service, format it
    if (aiResponse) {
      const response = {
        id: `mcp_${Date.now()}`,
        choices: [
          {
            message: {
              role: "assistant",
              content: aiResponse.content || aiResponse.choices?.[0]?.message?.content || "I received your message.",
            },
            finish_reason: "stop",
          },
        ],
        usage: {
          prompt_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0),
          completion_tokens: aiResponse.content?.length || 50,
          total_tokens: messageArray.reduce((acc, m) => acc + (m.content?.length || 0), 0) + (aiResponse.content?.length || 50),
        },
        metadata: aiResponse.metadata || {},
        timestamp: new Date().toISOString(),
      };

      console.log("Sending response");
      return res.json(response);
    }

    // Final fallback - generic response
    console.log("All AI services unavailable, using fallback");
    const fallbackResponse = {
      id: `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: "I'm currently unable to connect to the AI services. Please try again in a moment.",
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
  console.log("MCP Orchestrator URL:", process.env.MCP_ORCHESTRATOR_URL || 'http://localhost:8600');
  console.log("OpenAI enabled:", !!process.env.OPENAI_API_KEY);
});