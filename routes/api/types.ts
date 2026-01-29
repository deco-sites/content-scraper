// =============================================================================
// API: GET /api/types - Lista tipos de blog disponíveis
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { BLOG_TYPES } from "../../lib/types.ts";

export const handler: Handlers = {
  /**
   * GET /api/types
   * Retorna os tipos de blog disponíveis
   */
  GET() {
    return new Response(JSON.stringify(BLOG_TYPES), {
      headers: { "Content-Type": "application/json" },
    });
  },
};

