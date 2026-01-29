// =============================================================================
// API: GET /api/blogs/:id - Obtém um blog específico
// API: PUT /api/blogs/:id - Atualiza um blog
// API: DELETE /api/blogs/:id - Remove um blog
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { getBlog, updateBlog, deleteBlog, countArticlesByBlog } from "../../../lib/db.ts";
import type { BlogUpdate } from "../../../lib/types.ts";
import { BLOG_TYPES } from "../../../lib/types.ts";

export const handler: Handlers = {
  /**
   * GET /api/blogs/:id
   * Obtém um blog específico
   */
  async GET(_req, ctx) {
    try {
      const { id } = ctx.params;
      const blog = await getBlog(id);

      if (!blog) {
        return new Response(JSON.stringify({ error: "Blog not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const articlesCount = await countArticlesByBlog(id);

      return new Response(
        JSON.stringify({ ...blog, articles_count: articlesCount }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error getting blog:", error);
      return new Response(JSON.stringify({ error: "Failed to get blog" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  /**
   * PUT /api/blogs/:id
   * Atualiza um blog existente
   */
  async PUT(req, ctx) {
    try {
      const { id } = ctx.params;
      const body = await req.json();

      // Verifica se o blog existe
      const existing = await getBlog(id);
      if (!existing) {
        return new Response(JSON.stringify({ error: "Blog not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      const updates: BlogUpdate = {};

      // Validações opcionais
      if (body.name !== undefined) {
        if (typeof body.name !== "string" || body.name.trim() === "") {
          return new Response(JSON.stringify({ error: "Name cannot be empty" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        updates.name = body.name.trim();
      }

      if (body.url !== undefined) {
        try {
          new URL(body.url);
          updates.url = body.url.trim();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid URL format" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }

      if (body.feed_url !== undefined) {
        if (body.feed_url === null || body.feed_url === "") {
          updates.feed_url = null;
        } else {
          try {
            new URL(body.feed_url);
            updates.feed_url = body.feed_url.trim();
          } catch {
            return new Response(
              JSON.stringify({ error: "Invalid feed URL format" }),
              {
                status: 400,
                headers: { "Content-Type": "application/json" },
              }
            );
          }
        }
      }

      if (body.authority !== undefined) {
        if (typeof body.authority !== "number" || body.authority < 0 || body.authority > 1) {
          return new Response(
            JSON.stringify({ error: "Authority must be a number between 0 and 1" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        updates.authority = body.authority;
      }

      if (body.type !== undefined) {
        if (!BLOG_TYPES.includes(body.type)) {
          return new Response(
            JSON.stringify({ error: `Invalid type. Must be one of: ${BLOG_TYPES.join(", ")}` }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        updates.type = body.type;
      }

      const updated = await updateBlog(id, updates);

      return new Response(JSON.stringify(updated), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error updating blog:", error);
      return new Response(JSON.stringify({ error: "Failed to update blog" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  /**
   * DELETE /api/blogs/:id
   * Remove um blog e seus artigos
   */
  async DELETE(_req, ctx) {
    try {
      const { id } = ctx.params;
      const deleted = await deleteBlog(id);

      if (!deleted) {
        return new Response(JSON.stringify({ error: "Blog not found" }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error deleting blog:", error);
      return new Response(JSON.stringify({ error: "Failed to delete blog" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

