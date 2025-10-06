# MCP Service

MCP (Model Context Protocol) Service for Lovable AI integration. This service handles chat requests and provides a standardized interface for AI model interactions.

## Endpoints

- `GET /health` - Health check endpoint
- `POST /api/v1/chat` - Chat endpoint for processing messages

## Environment Variables

- `PORT` - Port to run the service on (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Development

```bash
# Install dependencies
npm install

# Start the server
npm start

# Start in development mode
npm run dev
```

## Deployment

This service is configured for deployment on Render. The `render.yaml` file contains the deployment configuration.
