const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// System prompt for OpenAI to act as orchestrator
const SYSTEM_PROMPT = `You are the Orion2 AI Project Management Assistant - an intelligent orchestrator for construction project management.

You have access to these specialized backend services:
- Compliance Service: Construction compliance and regulatory checks
- Risk Service: Project risk assessment and mitigation
- HSE Service: Health, Safety, and Environment monitoring
- QA/QC Service: Quality assurance and quality control
- Schedule Service: Project timeline optimization
- Budget Service: Cost analysis and forecasting
- Document Service: Document analysis and generation

Your role:
1. Analyze user questions
2. Determine which backend services are needed
3. Provide expert construction project management advice
4. Reference specific services when relevant
5. Be professional, accurate, and construction-focused

When users ask about:
- Compliance/regulations → Reference Compliance Service
- Safety/health → Reference HSE Service
- Quality → Reference QA/QC Service
- Timelines/schedules → Reference Schedule Service
- Costs/budget → Reference Budget Service
- Risks → Reference Risk Service
- Documents → Reference Document Service

Always identify yourself as "Orion2 AI Assistant" and provide construction expertise.`;

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0",
    service: "mcp-hybrid-orchestrator",
    ai_enabled: !!process.env.OPENAI_API_KEY,
    services: {
      compliance: "available",
      risk: "available", 
      hse: "available",
      qaqc: "available",
      schedule: "available",
      budget: "available",
      documents: "available"
    }
  });
});

// MCP chat endpoint with OpenAI as orchestrator
app.post("/api/v1/chat", async (req, res) => {
  try {
    const { messages, message, user_id, conversation_id } = req.body;

    // Support both formats
    const messageArray = messages || (message ? [{ role: "user", content: message }] : []);

    if (!messageArray || messageArray.length === 0) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Messages array required",
        timestamp: new Date().toISOString(),
      });
    }

    const userMessage = messageArray[messageArray.length - 1].content;
    console.log("User message:", userMessage);

    // Prepare messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messageArray
    ];

    // Call OpenAI with orchestration context
    if (process.env.OPENAI_API_KEY) {
      try {
        console.log("Calling OpenAI orchestrator...");
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
              messages: fullMessages,
              temperature: 0.7,
              max_tokens: 800,
            }),
          }
        );

        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          const aiContent = openaiData.choices[0].message.content;
          
          console.log("AI Response:", aiContent.substring(0, 100) + "...");

          // Analyze which services were referenced
          const servicesReferenced = [];
          if (aiContent.includes("Compliance") || userMessage.toLowerCase().includes("compliance")) servicesReferenced.push("compliance");
          if (aiContent.includes("Risk") || userMessage.toLowerCase().includes("risk")) servicesReferenced.push("risk");
          if (aiContent.includes("HSE") || userMessage.toLowerCase().includes("safety")) servicesReferenced.push("hse");
          if (aiContent.includes("QA/QC") || userMessage.toLowerCase().includes("quality")) servicesReferenced.push("qaqc");
          if (aiContent.includes("Schedule") || userMessage.toLowerCase().includes("schedule")) servicesReferenced.push("schedule");
          if (aiContent.includes("Budget") || userMessage.toLowerCase().includes("budget")) servicesReferenced.push("budget");

          // Return enhanced response
          const response = {
            id: openaiData.id || `mcp_${Date.now()}`,
            choices: [{
              message: {
                role: "assistant",
                content: aiContent,
              },
              finish_reason: openaiData.choices[0].finish_reason,
            }],
            usage: openaiData.usage,
            metadata: {
              services_referenced: servicesReferenced,
              orchestrator: "openai-gpt-3.5",
              processing_mode: "hybrid",
              timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString(),
          };

          return res.json(response);
        } else {
          const errorData = await openaiResponse.json();
          console.error("OpenAI error:", errorData);
          
          return res.status(500).json({
            error: "OpenAI API error",
            message: errorData.error?.message || "Unknown error",
            timestamp: new Date().toISOString(),
          });
        }
      } catch (openaiError) {
        console.error("OpenAI error:", openaiError.message);
        
        return res.status(500).json({
          error: "AI service error",
          message: openaiError.message,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Fallback if no OpenAI key
    return res.status(503).json({
      error: "Service not configured",
      message: "OPENAI_API_KEY required",
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
  console.log(`Orion2 Hybrid MCP Orchestrator running on port ${PORT}`);
  console.log("Mode: OpenAI as intelligent orchestrator");
  console.log("Services: Compliance, Risk, HSE, QA/QC, Schedule, Budget, Documents");
});