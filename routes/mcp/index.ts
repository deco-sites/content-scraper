/**
 * MCP HTTP Endpoint - Fresh Route
 * 
 * Endpoint MCP JSON-RPC servido via Fresh.
 * 
 * POST /mcp - MCP JSON-RPC endpoint
 */

import { Handlers } from "$fresh/server.ts";
import zodToJsonSchema from "npm:zod-to-json-schema@3.24.0";
import { tools } from "../../mcp/tools/index.ts";

// ============================================================================
// Configuration
// ============================================================================

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
// Auth Helper
// ============================================================================

function isAuthorized(req: Request): boolean {
  if (!AUTH_ENABLED) return true;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;

  return API_KEYS!.has(match[1]);
}

// ============================================================================
// Fresh Handlers
// ============================================================================

export const handler: Handlers = {
  // Handle CORS preflight
  OPTIONS(_req) {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  },

  // GET /mcp - Return server info
  GET(_req) {
    return Response.json(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: "Content Scraper MCP Server",
        tools: tools.length,
        endpoints: {
          mcp: "POST /mcp",
          health: "GET /mcp/health",
          tools: "GET /mcp/tools",
        },
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },

  // POST /mcp - MCP JSON-RPC endpoint
  async POST(req) {
    // Check auth
    if (!isAuthorized(req)) {
      return Response.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        {
          status: 401,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    try {
      const body = await req.json() as MCPRequest;
      console.log(`[MCP] >>> ${body.method}`);

      const response = await handleMCPRequest(body);

      console.log(`[MCP] <<< ${response.error ? "ERROR" : "OK"}`);

      return Response.json(response, {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      console.error(`[MCP] ERROR:`, error);

      return Response.json(
        {
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32700,
            message: "Parse error",
          },
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};

