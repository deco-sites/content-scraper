// =============================================================================
// API: GET /api/blogs/:id/articles - Lista artigos de um blog
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { getBlog, listArticlesByBlog } from "../../../../lib/db.ts";

export const handler: Handlers = {
  /**
   * GET /api/blogs/:id/articles
   * Lista artigos de um blog específico
   */
  async GET(_req, ctx) {
    try {
      const { id } = ctx.params;

      // Verifica se o blog existe
      const blog = await getBlog(id);
      if (!blog) {
        return new Response(JSON.stringify({ error: "Blog not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const articles = await listArticlesByBlog(id);

      return new Response(JSON.stringify(articles), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error listing blog articles:", error);
      return new Response(
        JSON.stringify({ error: "Failed to list blog articles" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};

