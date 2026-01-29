// =============================================================================
// API: GET /api/blogs - Lista todos os blogs
// API: POST /api/blogs - Cria um novo blog
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { listBlogs, createBlog, countArticlesByBlog } from "../../../lib/db.ts";
import type { BlogInsert } from "../../../lib/types.ts";
import { BLOG_TYPES } from "../../../lib/types.ts";

export const handler: Handlers = {
  /**
   * GET /api/blogs
   * Lista todos os blogs com contagem de artigos
   */
  async GET(_req) {
    try {
      const blogs = await listBlogs();

      // Adiciona contagem de artigos para cada blog
      const blogsWithCount = await Promise.all(
        blogs.map(async (blog) => ({
          ...blog,
          articles_count: await countArticlesByBlog(blog.id),
        }))
      );

      return new Response(JSON.stringify(blogsWithCount), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error listing blogs:", error);
      return new Response(JSON.stringify({ error: "Failed to list blogs" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },

  /**
   * POST /api/blogs
   * Cria um novo blog
   */
  async POST(req) {
    try {
      const body = await req.json();

      // Validação básica
      if (!body.name || typeof body.name !== "string") {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!body.url || typeof body.url !== "string") {
        return new Response(JSON.stringify({ error: "URL is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Valida URL
      try {
        new URL(body.url);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid URL format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Valida authority (0.0 a 1.0)
      const authority = typeof body.authority === "number" ? body.authority : 0.5;
      if (authority < 0 || authority > 1) {
        return new Response(
          JSON.stringify({ error: "Authority must be between 0 and 1" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Valida tipo
      const blogType = body.type || "Community";
      if (!BLOG_TYPES.includes(blogType)) {
        return new Response(
          JSON.stringify({ error: `Invalid type. Must be one of: ${BLOG_TYPES.join(", ")}` }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const blogInsert: BlogInsert = {
        name: body.name.trim(),
        url: body.url.trim(),
        feed_url: body.feed_url?.trim() || null,
        authority,
        type: blogType,
      };

      const blog = await createBlog(blogInsert);

      return new Response(JSON.stringify(blog), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error creating blog:", error);
      return new Response(JSON.stringify({ error: "Failed to create blog" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};

