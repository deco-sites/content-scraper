// =============================================================================
// API: GET /api/stats - Retorna estatísticas do dashboard
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { getDashboardStats } from "../../lib/db.ts";

export const handler: Handlers = {
  /**
   * GET /api/stats
   * Retorna estatísticas gerais do sistema
   */
  async GET() {
    try {
      const stats = await getDashboardStats();

      return new Response(JSON.stringify(stats), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error getting stats:", error);
      return new Response(JSON.stringify({ error: "Failed to get stats" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

