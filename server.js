const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Try to load OpenAI SDK
let OpenAI;
let openaiClient;
try {
  OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    console.log('OpenAI SDK initialized successfully');
  }
} catch (error) {
  console.log('OpenAI SDK not available, using fetch fallback');
}

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0",
    service: "mcp-node",
    ai_enabled: !!process.env.OPENAI_API_KEY,
    openai_sdk: !!openaiClient,
  });
});

// Chat endpoint with proper OpenAI integration
app.post("/api/v1/chat", async (req, res) => {
  try {
    const { messages, message, user_id, require_agents, persona } = req.body;

    // Support both formats
    const messageArray =
      messages || (message ? [{ role: "user", content: message }] : []);

    if (!messageArray || messageArray.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Messages array required",
        timestamp: new Date().toISOString(),
      });
    }

    const userMessage = messageArray[messageArray.length - 1].content;
    console.log("User message:", userMessage);
    console.log("Requested agents:", require_agents);

    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "Service not configured",
        message: "OPENAI_API_KEY required",
        timestamp: new Date().toISOString(),
      });
    }

    // Build system prompt based on requested agents
    let systemPrompt = "You are an AI assistant for construction project management.";
    
    if (require_agents?.includes('einstein')) {
      systemPrompt = `You are Einstein, a brilliant AI agent specializing in deep analysis, pattern recognition, and scientific reasoning for construction projects. 
      You approach problems with methodical thinking and provide insights based on data and logical reasoning.
      Analyze the user's request thoroughly and provide expert construction management insights.`;
    } else if (require_agents?.includes('archon')) {
      systemPrompt = `You are Archon, the orchestrator AI agent responsible for coordinating multiple perspectives on construction projects.
      You excel at breaking down complex tasks and synthesizing comprehensive solutions.`;
    }

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messageArray,
    ];

    // Use OpenAI SDK if available, otherwise use fetch
    let aiResponse;
    
    if (openaiClient) {
      console.log("Using OpenAI SDK");
      const completion = await openaiClient.chat.completions.create({
        model: require_agents?.includes('einstein') ? 'gpt-4' : 'gpt-3.5-turbo',
        messages: fullMessages,
        temperature: 0.7,
        max_tokens: 1000,
      });

      aiResponse = {
        content: completion.choices[0].message.content,
        model: completion.model,
        usage: completion.usage,
        finish_reason: completion.choices[0].finish_reason,
      };
    } else {
      console.log("Using fetch API");
      const openaiResponse = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: require_agents?.includes('einstein') ? 'gpt-4' : 'gpt-3.5-turbo',
            messages: fullMessages,
            temperature: 0.7,
            max_tokens: 1000,
          }),
        }
      );

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.json();
        console.error("OpenAI error:", errorData);
        return res.status(500).json({
          error: "OpenAI API error",
          message: errorData.error?.message || "Unknown error",
          timestamp: new Date().toISOString(),
        });
      }

      const openaiData = await openaiResponse.json();
      aiResponse = {
        content: openaiData.choices[0].message.content,
        model: openaiData.model,
        usage: openaiData.usage,
        finish_reason: openaiData.choices[0].finish_reason,
      };
    }

    console.log("AI response generated successfully");

    // Return in choices format
    const response = {
      id: `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: aiResponse.content,
          },
          finish_reason: aiResponse.finish_reason,
        },
      ],
      usage: aiResponse.usage,
      metadata: {
        agents_consulted: require_agents || ["openai"],
        model_used: aiResponse.model,
        processing_mode: openaiClient ? "sdk" : "fetch",
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    return res.json(response);
  } catch (error) {
    console.error("Chat error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log("OpenAI API Key:", process.env.OPENAI_API_KEY ? "SET" : "NOT SET");
  console.log("OpenAI SDK:", openaiClient ? "LOADED" : "USING FETCH");
});