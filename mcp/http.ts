#!/usr/bin/env -S deno run -A --unstable-kv
/**
 * Content Scraper MCP Server - HTTP Transport
 *
 * Servidor HTTP para acessar o MCP via URL.
 * Útil para deploy e acesso remoto.
 *
 * Usage:
 *   deno task mcp:http
 *
 * Endpoints:
 *   POST /mcp          - MCP JSON-RPC endpoint
 *   GET  /mcp/health   - Health check
 *   GET  /mcp/tools    - List available tools
 *
 * Environment variables:
 *   PORT               - Porta do servidor (default: 8001)
 *   MCP_API_KEYS       - Chaves de API separadas por vírgula (opcional)
 *   OPENROUTER_API_KEY - Chave da API OpenRouter
 *   APIFY_API_TOKEN    - Token da API Apify
 *   ADMIN_DB_TOKEN     - Token do banco de dados
 */

import { Hono } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { bearerAuth } from "@hono/hono/bearer-auth";
import zodToJsonSchema from "npm:zod-to-json-schema@3.24.0";

import { tools } from "./tools/index.ts";

// ============================================================================
// Configuration
// ============================================================================

const PORT = parseInt(Deno.env.get("PORT") || "8001");
const SERVER_NAME = "content-scraper";
const SERVER_VERSION = "1.0.0";

// Parse API keys from env (comma-separated)
const API_KEYS_RAW = Deno.env.get("MCP_API_KEYS");
const API_KEYS = API_KEYS_RAW
  ? new Set(API_KEYS_RAW.split(",").map((k) => k.trim()).filter(Boolean))
  : null;
const AUTH_ENABLED = API_KEYS !== null && API_KEYS.size > 0;

// ============================================================================
// MCP JSON-RPC Types
// ============================================================================

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// Tool Registry
// ============================================================================

// Build tool registry with JSON schemas
const toolRegistry = new Map<string, {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}>();

for (const tool of tools) {
  const jsonSchema = zodToJsonSchema(tool.schema, { $refStrategy: "none" });
  const { $schema: _, ...schemaProps } = jsonSchema as Record<string, unknown>;
  
  toolRegistry.set(tool.name, {
    name: tool.name,
    description: tool.description,
    inputSchema: schemaProps,
    handler: tool.handler,
  });
}

// ============================================================================
// MCP Method Handlers
// ============================================================================

async function handleMCPRequest(request: MCPRequest): Promise<MCPResponse> {
  const { id, method, params } = request;

  try {
    switch (method) {
      case "initialize": {
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            serverInfo: {
              name: SERVER_NAME,
              version: SERVER_VERSION,
            },
            capabilities: {
              tools: {},
            },
          },
        };
      }

      case "tools/list": {
        const toolList = Array.from(toolRegistry.values()).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));

        return {
          jsonrpc: "2.0",
          id,
          result: { tools: toolList },
        };
      }

      case "tools/call": {
        const toolName = params?.name as string;
        const args = (params?.arguments || {}) as Record<string, unknown>;

        const tool = toolRegistry.get(toolName);
        if (!tool) {
          return {
            jsonrpc: "2.0",
            id,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`,
            },
          };
        }

        const result = await tool.handler(args);

        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      case "ping": {
        return {
          jsonrpc: "2.0",
          id,
          result: {},
        };
      }

      default: {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
      }
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ============================================================================
// HTTP Server
// ============================================================================

const app = new Hono();

// CORS
app.use("*", cors({
  origin: "*",
  allowMethods: ["GET", "POST", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

// Optional Bearer Auth
if (AUTH_ENABLED) {
  app.use("/mcp", bearerAuth({
    verifyToken: (token) => API_KEYS!.has(token),
  }));
}

// Health check
app.get("/mcp/health", (c) => {
  return c.json({
    status: "ok",
    server: SERVER_NAME,
    version: SERVER_VERSION,
    tools: tools.length,
  });
});

// List tools (convenience endpoint)
app.get("/mcp/tools", (c) => {
  const toolList = Array.from(toolRegistry.values()).map((t) => ({
    name: t.name,
    description: t.description,
  }));

  return c.json({
    total: toolList.length,
    tools: toolList,
  });
});

// MCP JSON-RPC endpoint
app.post("/mcp", async (c) => {
  const reqId = Math.random().toString(36).slice(2, 8);
  
  try {
    const body = await c.req.json() as MCPRequest;
    console.log(`[${reqId}] >>> ${body.method}`);

    const response = await handleMCPRequest(body);
    
    console.log(`[${reqId}] <<< ${response.error ? "ERROR" : "OK"}`);
    
    return c.json(response);
  } catch (error) {
    console.error(`[${reqId}] ERROR:`, error);
    
    return c.json({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
      },
    }, 400);
  }
});

// Root redirect
app.get("/", (c) => {
  return c.json({
    name: SERVER_NAME,
    version: SERVER_VERSION,
    mcp_endpoint: "/mcp",
    health_endpoint: "/mcp/health",
    tools_endpoint: "/mcp/tools",
  });
});

// ============================================================================
// Start Server
// ============================================================================

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║             Content Scraper MCP - HTTP Server                 ║
╠═══════════════════════════════════════════════════════════════╣
║  MCP Endpoint:  http://localhost:${PORT}/mcp                      ║
║  Health Check:  http://localhost:${PORT}/mcp/health               ║
║  List Tools:    http://localhost:${PORT}/mcp/tools                ║
╠═══════════════════════════════════════════════════════════════╣
║  Auth: ${AUTH_ENABLED ? `enabled (${API_KEYS!.size} keys)`.padEnd(54) : "disabled (set MCP_API_KEYS to enable)".padEnd(54)}║
╚═══════════════════════════════════════════════════════════════╝
`);

console.log(`Tools available (${tools.length}):`);
for (const tool of tools) {
  console.log(`  • ${tool.name} - ${tool.description.slice(0, 50)}...`);
}
console.log("");

// Environment check
const hasOpenRouter = !!Deno.env.get("OPENROUTER_API_KEY");
const hasApify = !!Deno.env.get("APIFY_API_TOKEN");
const hasDb = !!Deno.env.get("ADMIN_DB_TOKEN");

console.log(`Environment:`);
console.log(`  OPENROUTER_API_KEY: ${hasOpenRouter ? "✅" : "⚠️  not set"}`);
console.log(`  APIFY_API_TOKEN:    ${hasApify ? "✅" : "⚠️  not set"}`);
console.log(`  ADMIN_DB_TOKEN:     ${hasDb ? "✅" : "⚠️  not set"}`);
console.log("");

Deno.serve({ port: PORT }, app.fetch);

