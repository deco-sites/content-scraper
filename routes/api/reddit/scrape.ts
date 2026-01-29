// =============================================================================
// API: POST /api/reddit/scrape - Processa posts do Reddit
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import type { RedditRawPost, RedditContentType } from "../../../lib/types.ts";
import { processRedditPosts } from "../../../lib/reddit-scraper.ts";
import { REDDIT_CONTENT_TYPES } from "../../../lib/types.ts";

export const handler: Handlers = {
  /**
   * POST /api/reddit/scrape
   * Processa posts do Reddit (já coletados via MCP)
   * 
   * Body:
   *   - posts: Array de posts brutos do Reddit
   *   - type: Tipo do conteúdo (Trendsetters, Enterprise, MCP-First Startups, Community)
   *   - authority: Autoridade do conteúdo (0.0 a 1.0, default: 0.7)
   * 
   * Exemplo:
   * { 
   *   "posts": [...], 
   *   "type": "Community",
   *   "authority": 0.7
   * }
   */
  async POST(req) {
    try {
      const body = await req.json();

      // Validação de posts
      if (!body.posts || !Array.isArray(body.posts)) {
        return new Response(
          JSON.stringify({ error: "posts array is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validação de type
      const type = body.type || "Community";
      if (!REDDIT_CONTENT_TYPES.includes(type as RedditContentType)) {
        return new Response(
          JSON.stringify({ 
            error: `Invalid type. Must be one of: ${REDDIT_CONTENT_TYPES.join(", ")}` 
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Validação de authority
      const authority = typeof body.authority === "number"
        ? Math.max(0, Math.min(1, body.authority))
        : 0.7;

      console.log(`[API] Processing ${body.posts.length} Reddit posts (type: ${type}, authority: ${authority})`);
      const result = await processRedditPosts(
        body.posts as RedditRawPost[], 
        type as RedditContentType,
        authority
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${body.posts.length} posts`,
          type,
          authority,
          posts_saved: result.postsSaved,
          posts_relevant: result.postsRelevant,
          posts_skipped: result.postsSkipped,
          errors: result.errors.length > 0 ? result.errors : undefined,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error processing Reddit posts:", error);
      return new Response(
        JSON.stringify({
          error: "Reddit processing failed",
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

