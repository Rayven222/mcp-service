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

// Backend service URLs (can be overridden with env vars)
const BACKEND_SERVICES = {
  compliance: process.env.COMPLIANCE_SERVICE_URL || 'http://localhost:8610',
  risk: process.env.RISK_SERVICE_URL || 'http://localhost:8611',
  hse: process.env.HSE_SERVICE_URL || 'http://localhost:8612',
  qaqc: process.env.QAQC_SERVICE_URL || 'http://localhost:8613',
  schedule: process.env.SCHEDULE_SERVICE_URL || 'http://localhost:8614',
  budget: process.env.BUDGET_SERVICE_URL || 'http://localhost:8615',
};

// System prompt - OpenAI acts as intelligent orchestrator
const SYSTEM_PROMPT = `You are Orion2 AI Assistant - an intelligent orchestrator for construction project management.

IMPORTANT: You can now ACTUALLY CALL real backend services. When a user asks about:
- Compliance/regulations → Call the Compliance Service
- Safety/health → Call the HSE Service  
- Quality → Call the QA/QC Service
- Timelines/schedules → Call the Schedule Service
- Costs/budget → Call the Budget Service
- Risks → Call the Risk Service

To call a service, respond with this JSON format:
{
  "action": "call_service",
  "service": "compliance|risk|hse|qaqc|schedule|budget",
  "query": "specific question for the service",
  "response": "your analysis and context"
}

If the question doesn't need a backend service, respond normally with construction expertise.

Always identify yourself as "Orion2 AI Assistant" and provide expert construction project management advice.`;

// Function to call backend services
async function callBackendService(serviceName, query) {
  const serviceUrl = BACKEND_SERVICES[serviceName];
  if (!serviceUrl) {
    console.log(`Service ${serviceName} not configured`);
    return null;
  }

  try {
    console.log(`Calling ${serviceName} service at ${serviceUrl}`);
    const response = await fetch(`${serviceUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, context: { source: 'orion2-mcp' } }),
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`Got response from ${serviceName} service`);
      return data;
    } else {
      console.log(`${serviceName} service returned ${response.status}`);
      return null;
    }
  } catch (error) {
    console.log(`${serviceName} service unavailable:`, error.message);
    return null;
  }
}

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: "2.0.0",
    service: "mcp-hybrid-orchestrator",
    ai_enabled: !!process.env.OPENAI_API_KEY,
    backend_services: Object.keys(BACKEND_SERVICES),
  });
});

// MCP chat endpoint - OpenAI orchestrates backend services
app.post("/api/v1/chat", async (req, res) => {
  try {
    const { messages, message, user_id } = req.body;

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

    // Prepare messages with system prompt
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messageArray,
    ];

    // Call OpenAI orchestrator
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        error: "Service not configured",
        message: "OPENAI_API_KEY required",
        timestamp: new Date().toISOString(),
      });
    }

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
    let aiContent = openaiData.choices[0].message.content;

    console.log("OpenAI response received");

    // Check if OpenAI wants to call a backend service
    let serviceData = null;
    let servicesConsulted = [];

    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*"action":\s*"call_service"[\s\S]*\}/);
      if (jsonMatch) {
        const serviceRequest = JSON.parse(jsonMatch[0]);
        if (serviceRequest.action === "call_service" && serviceRequest.service) {
          console.log(`AI requested ${serviceRequest.service} service`);
          serviceData = await callBackendService(serviceRequest.service, serviceRequest.query);
          servicesConsulted.push(serviceRequest.service);
          
          // If we got data, update the response
          if (serviceData) {
            aiContent = `${serviceRequest.response}\n\nBased on ${serviceRequest.service} analysis:\n${JSON.stringify(serviceData, null, 2)}`;
          }
        }
      }
    } catch (parseError) {
      console.log("No service call in response");
    }

    // Analyze which services were mentioned (even if not called)
    const servicesReferenced = [];
    const lowerContent = aiContent.toLowerCase() + userMessage.toLowerCase();
    if (lowerContent.includes("compliance")) servicesReferenced.push("compliance");
    if (lowerContent.includes("risk")) servicesReferenced.push("risk");
    if (lowerContent.includes("safety") || lowerContent.includes("hse")) servicesReferenced.push("hse");
    if (lowerContent.includes("quality") || lowerContent.includes("qaqc")) servicesReferenced.push("qaqc");
    if (lowerContent.includes("schedule") || lowerContent.includes("timeline")) servicesReferenced.push("schedule");
    if (lowerContent.includes("budget") || lowerContent.includes("cost")) servicesReferenced.push("budget");

    // Return enhanced response
    const response = {
      id: openaiData.id || `mcp_${Date.now()}`,
      choices: [
        {
          message: {
            role: "assistant",
            content: aiContent,
          },
          finish_reason: openaiData.choices[0].finish_reason,
        },
      ],
      usage: openaiData.usage,
      metadata: {
        services_referenced: servicesReferenced,
        services_consulted: servicesConsulted,
        orchestrator: "openai-gpt-3.5-turbo",
        processing_mode: "hybrid-intelligent",
        backend_data_included: !!serviceData,
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
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Orion2 Hybrid MCP Orchestrator running on port ${PORT}`);
  console.log("Mode: OpenAI orchestrates backend services");
  console.log("Backend services configured:", Object.keys(BACKEND_SERVICES).join(", "));
});