// =============================================================================
// API: GET /api/reddit/posts - Lista posts do Reddit
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import {
  listRedditContent,
  listRedditContentBySubreddit,
  listRedditContentByType,
  listRedditContentByWeek,
  countRedditContent,
  countRedditRelevantContent,
} from "../../../lib/db.ts";
import type { RedditContentType } from "../../../lib/types.ts";
import { REDDIT_COMMUNITIES, REDDIT_CONTENT_TYPES } from "../../../lib/types.ts";

export const handler: Handlers = {
  /**
   * GET /api/reddit/posts
   * Lista posts do Reddit salvos
   * 
   * Query params:
   *   - subreddit: Filtrar por subreddit (LLMDevs, AI_Agents, mcp)
   *   - type: Filtrar por tipo (Trendsetters, Enterprise, MCP-First Startups, Community)
   *   - week: Filtrar por semana (ex: 2026-w05)
   *   - limit: Limite de resultados (default: 50)
   */
  async GET(req) {
    try {
      const url = new URL(req.url);
      const subreddit = url.searchParams.get("subreddit");
      const type = url.searchParams.get("type");
      const week = url.searchParams.get("week");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      // Stats
      const totalCount = await countRedditContent();
      const relevantCount = await countRedditRelevantContent();

      // Fetch posts based on filters
      let posts;
      
      if (subreddit) {
        posts = await listRedditContentBySubreddit(subreddit, limit);
      } else if (type && REDDIT_CONTENT_TYPES.includes(type as RedditContentType)) {
        posts = await listRedditContentByType(type as RedditContentType, limit);
      } else if (week) {
        posts = await listRedditContentByWeek(week, limit);
      } else {
        posts = await listRedditContent(limit);
      }

      return new Response(
        JSON.stringify({
          success: true,
          stats: {
            total: totalCount,
            relevant: relevantCount,
            communities: REDDIT_COMMUNITIES,
            types: REDDIT_CONTENT_TYPES,
          },
          count: posts.length,
          posts,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error fetching Reddit posts:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to fetch Reddit posts",
          details: String(error),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};

