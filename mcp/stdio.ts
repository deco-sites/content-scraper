#!/usr/bin/env -S deno run -A --unstable-kv
/**
 * Content Scraper MCP Server - Stdio Transport
 *
 * Este é o entry point principal para rodar o MCP via stdio,
 * que é o transporte padrão para Claude Desktop, Cursor e Mesh.
 *
 * Usage:
 *   deno task mcp
 *
 * No Cursor, adicionar como MCP server:
 *   Command: deno
 *   Args: run -A --unstable-kv --env mcp/stdio.ts
 *
 * Environment variables:
 *   OPENROUTER_API_KEY  - Chave da API OpenRouter (obrigatória para análise de conteúdo)
 *   APIFY_API_TOKEN     - Token da API Apify (obrigatório para LinkedIn)
 *   ADMIN_DB_TOKEN      - Token do banco de dados deco.cms
 */

import { McpServer } from "npm:@modelcontextprotocol/sdk@1.12.1/server/mcp.js";
import { StdioServerTransport } from "npm:@modelcontextprotocol/sdk@1.12.1/server/stdio.js";
import zodToJsonSchema from "npm:zod-to-json-schema@3.24.0";

import { tools } from "./tools/index.ts";

// ============================================================================
// MCP Server Setup
// ============================================================================

async function main() {
  console.error("[content-scraper] Starting Content Scraper MCP via stdio transport...");

  const server = new McpServer({
    name: "content-scraper",
    version: "1.0.0",
  });

  // ============================================================================
  // Register all tools dynamically
  // ============================================================================

  for (const tool of tools) {
    // Convert Zod schema to JSON Schema for MCP
    const jsonSchema = zodToJsonSchema(tool.schema, { $refStrategy: "none" });
    
    // Remove $schema property as MCP doesn't need it
    const { $schema: _, ...schemaProps } = jsonSchema as Record<string, unknown>;
    
    server.tool(
      tool.name,
      tool.description,
      schemaProps,
      async (args) => {
        try {
          const result = await tool.handler(args);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: true,
                  message: error instanceof Error ? error.message : String(error),
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }

  // ============================================================================
  // Connect to stdio transport
  // ============================================================================

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log available tools
  const toolNames = tools.map((t) => t.name).join(", ");
  console.error(`[content-scraper] ✅ MCP server running via stdio`);
  console.error(`[content-scraper] Tools: ${toolNames}`);

  // Log environment status
  const hasOpenRouter = !!Deno.env.get("OPENROUTER_API_KEY");
  const hasApify = !!Deno.env.get("APIFY_API_TOKEN");
  const hasDb = !!Deno.env.get("ADMIN_DB_TOKEN");

  console.error(`[content-scraper] Environment:`);
  console.error(`  OPENROUTER_API_KEY: ${hasOpenRouter ? "✅ set" : "⚠️ not set (scraping will fail)"}`);
  console.error(`  APIFY_API_TOKEN: ${hasApify ? "✅ set" : "⚠️ not set (LinkedIn scraping will fail)"}`);
  console.error(`  ADMIN_DB_TOKEN: ${hasDb ? "✅ set" : "⚠️ not set (database access will fail)"}`);
}

main().catch((error) => {
  console.error("[content-scraper] Fatal error:", error);
  Deno.exit(1);
});

