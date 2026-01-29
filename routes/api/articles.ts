// =============================================================================
// API: GET /api/articles - Lista artigos
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { listArticlesWithBlog, listArticlesByWeekWithBlog } from "../../lib/db.ts";

export const handler: Handlers = {
  /**
   * GET /api/articles
   * Lista artigos com filtro opcional por semana
   * Query params:
   *   - week: filtrar por semana (YYYY-wWW)
   *   - limit: limitar quantidade de resultados (padrão: 50)
   */
  async GET(req) {
    try {
      const url = new URL(req.url);
      const week = url.searchParams.get("week");
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);

      let articles;
      if (week) {
        // Valida formato da semana
        if (!/^\d{4}-w\d{2}$/.test(week)) {
          return new Response(
            JSON.stringify({ error: "Invalid week format. Use YYYY-wWW (e.g., 2026-w04)" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        articles = await listArticlesByWeekWithBlog(week);
      } else {
        articles = await listArticlesWithBlog(limit);
      }

      return new Response(JSON.stringify(articles), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error listing articles:", error);
      return new Response(JSON.stringify({ error: "Failed to list articles" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

