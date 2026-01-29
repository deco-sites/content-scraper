// =============================================================================
// API: GET /api/linkedin/posts - Lista conteúdo do LinkedIn (sempre type: community)
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import {
  listLinkedInContent,
  listLinkedInContentByWeek,
  countLinkedInContent,
  countLinkedInRelevantContent,
} from "../../../lib/db.ts";

export const handler: Handlers = {
  /**
   * GET /api/linkedin/posts
   * Lista conteúdo do LinkedIn (sempre type: community)
   * 
   * Query params:
   *   - limit: número máximo de posts (default: 50)
   *   - week: filtrar por semana (formato YYYY-wWW, ex: 2026-w05)
   */
  async GET(req) {
    try {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const week = url.searchParams.get("week");

      let posts;

      if (week) {
        posts = await listLinkedInContentByWeek(week, limit);
      } else {
        posts = await listLinkedInContent(limit);
      }

      const [total, totalRelevant] = await Promise.all([
        countLinkedInContent(),
        countLinkedInRelevantContent(),
      ]);

      return new Response(
        JSON.stringify({
          posts,
          type: "community",
          total,
          total_relevant: totalRelevant,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error listing LinkedIn content:", error);
      return new Response(
        JSON.stringify({ error: "Failed to list LinkedIn content" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};
