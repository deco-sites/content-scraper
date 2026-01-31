/**
 * Tools Index
 * 
 * Central export point for all MCP tools.
 */

import { scrapingTools } from "./scraping.ts";
import { sourcesTools } from "./sources.ts";
import { contentTools } from "./content.ts";

// Export all tools combined
export const tools = [...scrapingTools, ...sourcesTools, ...contentTools];

// Re-export for direct access
export { scrapingTools } from "./scraping.ts";
export { sourcesTools } from "./sources.ts";
export { contentTools } from "./content.ts";

