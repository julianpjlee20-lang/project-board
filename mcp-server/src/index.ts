// src/index.ts
// Uphouse MCP Server - main entry point

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import express, { Request, Response } from 'express';

import { registerProjectTools } from './tools/projects.js';
import { registerPhaseTools } from './tools/phases.js';
import { registerCardTools } from './tools/cards.js';

// ── Helper: create and configure a new MCP server instance ──────────────────

function createServer(): McpServer {
  const server = new McpServer({
    name: 'uphouse-mcp-server',
    version: '1.0.0',
  });

  registerProjectTools(server);
  registerPhaseTools(server);
  registerCardTools(server);

  return server;
}

// ── Auth middleware ───────────────────────────────────────────────────────────

function checkAuth(req: Request, res: Response): boolean {
  const MCP_SECRET = process.env.MCP_SECRET_TOKEN;
  if (!MCP_SECRET) {
    if (process.env.NODE_ENV === 'production') {
      console.error('FATAL: MCP_SECRET_TOKEN is not set in production!');
      res.status(500).json({ error: 'Server misconfiguration' });
      return false;
    }
    return true;
  }

  const auth = req.headers['authorization'];
  if (!auth || auth !== `Bearer ${MCP_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing MCP_SECRET_TOKEN' });
    return false;
  }
  return true;
}

// ── HTTP transport (for remote use: Claude Desktop, OpenClaw, Cursor, etc.) ──

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', server: 'uphouse-mcp-server', version: '1.0.0' });
  });

  // MCP endpoint — each request gets its own server instance to avoid concurrency issues
  app.post('/mcp', async (req: Request, res: Response) => {
    if (!checkAuth(req, res)) return;

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.error(`Uphouse MCP Server running on http://localhost:${port}/mcp`);
    console.error(`  Health: http://localhost:${port}/health`);
    console.error(`  Auth: ${process.env.MCP_SECRET_TOKEN ? 'enabled' : 'disabled (dev mode)'}`);
  });
}

// ── stdio transport (for local Claude Desktop / Claude Code) ─────────────────

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Uphouse MCP Server running via stdio');
}

// ── Choose transport based on env ─────────────────────────────────────────────

const transportMode = process.env.TRANSPORT || 'http';

if (transportMode === 'http') {
  runHTTP().catch((err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error('Server error:', err);
    process.exit(1);
  });
}
