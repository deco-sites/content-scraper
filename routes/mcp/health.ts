/**
 * MCP Health Check Endpoint
 * 
 * GET /mcp/health - Health check
 */

import { Handlers } from "$fresh/server.ts";
import { tools } from "../../mcp/tools/index.ts";

export const handler: Handlers = {
  GET(_req) {
    return Response.json(
      {
        status: "ok",
        server: "content-scraper",
        version: "1.0.0",
        tools: tools.length,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};

