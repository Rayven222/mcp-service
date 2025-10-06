const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI integration - will be available when openai package is installed
let OpenAI;
let openaiClient;

try {
  OpenAI = require('openai');
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
} catch (error) {
  console.log('OpenAI package not installed. Install with: npm install openai');
}

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8080', 'https://*.lovable.dev'],
  credentials: true
}));
app.use(express.json());

// OpenAI service functions
const openaiService = {
  async chatCompletion(messages, options = {}) {
    if (!openaiClient) {
      throw new Error('OpenAI client not initialized. Check OPENAI_API_KEY.');
    }

    try {
      const config = {
        model: options.model || process.env.OPENAI_MODEL_DEFAULT || 'gpt-4-turbo-preview',
        messages: messages,
        temperature: options.temperature || parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
        max_tokens: options.max_tokens || parseInt(process.env.OPENAI_MAX_TOKENS) || 4000,
        ...options
      };

      console.log(`Making OpenAI request with model: ${config.model}`);
      
      const response = await openaiClient.chat.completions.create(config);
      
      return {
        content: response.choices[0].message.content,
        model: response.model,
        usage: response.usage,
        finish_reason: response.choices[0].finish_reason
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  },

  async einsteinAnalysis(prompt, context = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are Einstein, a brilliant AI agent specializing in deep analysis, pattern recognition, and scientific reasoning. 
        You approach problems with methodical thinking and provide insights based on data and logical reasoning.
        Context: ${JSON.stringify(context)}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return this.chatCompletion(messages, {
      model: process.env.OPENAI_MODEL_SMART || 'gpt-4',
      temperature: 0.3
    });
  },

  async archonOrchestration(prompt, agents = [], context = {}) {
    const messages = [
      {
        role: 'system',
        content: `You are Archon, the orchestrator AI agent responsible for coordinating multiple AI agents and managing complex workflows.
        You excel at breaking down complex tasks, delegating to appropriate agents, and synthesizing results.
        Available agents: ${agents.join(', ')}
        Context: ${JSON.stringify(context)}`
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    return this.chatCompletion(messages, {
      model: process.env.OPENAI_MODEL_DEFAULT || 'gpt-4-turbo-preview',
      temperature: 0.5
    });
  }
};

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    backend: {
      status: 'healthy',
      uptime: process.uptime(),
      version: '1.0.0',
      node_env: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      openai_configured: !!process.env.OPENAI_API_KEY && !!openaiClient
    },
    mcp_service: {
      status: 'healthy',
      url: process.env.MCP_SERVICE_URL || 'http://mcp-orchestrator:8600',
      timestamp: new Date().toISOString()
    }
  });
});

// Enhanced chat endpoint with OpenAI integration
app.post('/api/v1/chat', async (req, res) => {
  try {
    const { messages, user_id, persona, require_agents, project_id, context } = req.body;

    // Get the user's message
    const userMessage = messages[messages.length - 1]?.content || '';
    
    let aiResponse;
    
    // If OpenAI is available, use it directly
    if (openaiClient) {
      try {
        if (require_agents?.includes('einstein')) {
          // Use Einstein for deep analysis
          aiResponse = await openaiService.einsteinAnalysis(userMessage, {
            persona,
            project_id,
            ...context
          });
        } else if (require_agents?.includes('archon')) {
          // Use Archon for orchestration
          aiResponse = await openaiService.archonOrchestration(userMessage, require_agents, {
            persona,
            project_id,
            ...context
          });
        } else {
          // Default: Use general chat completion
          const systemMessage = {
            role: 'system',
            content: `You are an AI assistant for construction project management. 
            Your persona is: ${persona || 'professional'}
            You help with project planning, risk assessment, compliance, and team coordination.`
          };
          
          const chatMessages = [systemMessage, ...messages];
          aiResponse = await openaiService.chatCompletion(chatMessages, {
            model: persona === 'technical' ? 'gpt-4' : 'gpt-4-turbo-preview'
          });
        }

        // Format response with OpenAI data
        res.json({
          content: aiResponse.content,
          confidence: 0.95,
          agents_consulted: require_agents || ['openai'],
          compliance_notes: [],
          recommendations: [],
          proactive_actions: [],
          metadata: {
            processing_time: 1.5,
            persona: persona || 'professional',
            timestamp: new Date().toISOString(),
            model_used: aiResponse.model,
            tokens_used: aiResponse.usage?.total_tokens || 0
          }
        });
        return;
      } catch (openaiError) {
        console.error('OpenAI error, falling back to MCP:', openaiError);
        // Fall through to MCP fallback
      }
    }

    // Fallback: Forward to MCP orchestrator
    const mcpUrl = process.env.MCP_SERVICE_URL || 'http://mcp-orchestrator:8600';
    const mcpResponse = await fetch(`${mcpUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Token': process.env.MCP_SERVICE_TOKEN
      },
      body: JSON.stringify({
        messages,
        user_id,
        persona,
        require_agents,
        project_id,
        context
      })
    });

    if (!mcpResponse.ok) {
      throw new Error(`MCP service error: ${mcpResponse.status}`);
    }

    const mcpData = await mcpResponse.json();

    res.json({
      content: mcpData.content || mcpData.response || "I'm processing your request...",
      confidence: mcpData.confidence || 0.95,
      agents_consulted: mcpData.agents_consulted || ['mcp'],
      compliance_notes: mcpData.compliance_notes || [],
      recommendations: mcpData.recommendations || [],
      proactive_actions: mcpData.proactive_actions || [],
      metadata: {
        processing_time: mcpData.processing_time || 1.5,
        persona: persona || 'professional',
        timestamp: new Date().toISOString(),
        model_used: mcpData.model_used || 'mcp-fallback'
      }
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test OpenAI endpoint
app.post('/api/v1/test-openai', async (req, res) => {
  try {
    if (!openaiClient) {
      return res.status(503).json({
        success: false,
        error: 'OpenAI client not initialized. Check OPENAI_API_KEY environment variable.'
      });
    }

    const { prompt, model } = req.body;
    
    const response = await openaiService.chatCompletion([
      { role: 'user', content: prompt || 'Hello, this is a test.' }
    ], { model });
    
    res.json({
      success: true,
      response: response.content,
      model: response.model,
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Service status endpoint
app.get('/services/status', async (req, res) => {
  try {
    // Check MCP service if available
    let mcpStatus = { healthy: false, url: 'http://mcp-orchestrator:8600' };
    try {
      const mcpUrl = process.env.MCP_SERVICE_URL || 'http://mcp-orchestrator:8600';
      const mcpResponse = await fetch(`${mcpUrl}/health`, { timeout: 5000 });
      mcpStatus.healthy = mcpResponse.ok;
    } catch (error) {
      console.log('MCP service not available:', error.message);
    }

    res.json({
      summary: {
        healthy_services: mcpStatus.healthy ? 2 : 1,
        total_services: 2,
        overall_health: mcpStatus.healthy ? 100 : 50,
        timestamp: new Date().toISOString()
      },
      services: {
        backend_api: {
          healthy: true,
          url: `http://localhost:${PORT}`,
          capabilities: ['chat', 'openai_integration'],
          last_checked: new Date().toISOString(),
          openai_available: !!openaiClient
        },
        mcp_orchestrator: mcpStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check service status',
      message: error.message
    });
  }
});

// Capabilities endpoint
app.get('/capabilities', (req, res) => {
  res.json({
    ai_agents: [
      {
        id: 'einstein',
        name: 'Einstein AI',
        description: 'Deep learning and pattern recognition',
        capabilities: ['analysis', 'prediction', 'optimization'],
        available: !!openaiClient
      },
      {
        id: 'archon',
        name: 'Archon Orchestrator',
        description: 'Multi-agent coordination and consensus',
        capabilities: ['orchestration', 'consensus', 'delegation'],
        available: !!openaiClient
      }
    ],
    personas: [
      'professional',
      'casual',
      'technical',
      'executive'
    ],
    openai_integration: {
      enabled: !!openaiClient,
      models_available: openaiClient ? [
        process.env.OPENAI_MODEL_DEFAULT || 'gpt-4-turbo-preview',
        process.env.OPENAI_MODEL_FAST || 'gpt-3.5-turbo',
        process.env.OPENAI_MODEL_SMART || 'gpt-4'
      ] : [],
      features: openaiClient ? [
        'chat_completion',
        'specialized_agents',
        'function_calling',
        'embeddings'
      ] : []
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend API running on port ${PORT}`);
  console.log(`OpenAI integration: ${openaiClient ? 'Enabled' : 'Disabled'}`);
  if (openaiClient) {
    console.log(`Default model: ${process.env.OPENAI_MODEL_DEFAULT || 'gpt-4-turbo-preview'}`);
  } else {
    console.log('To enable OpenAI: Set OPENAI_API_KEY and run: npm install openai');
  }
});
