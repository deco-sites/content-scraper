/**
 * MCP Tools List Endpoint
 * 
 * GET /mcp/tools - List available tools
 */

import { Handlers } from "$fresh/server.ts";
import { tools } from "../../mcp/tools/index.ts";

export const handler: Handlers = {
  GET(_req) {
    const toolList = tools.map((t) => ({
      name: t.name,
      description: t.description,
    }));

    return Response.json(
      {
        total: toolList.length,
        tools: toolList,
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  },
};

