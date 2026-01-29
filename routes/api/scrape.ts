// =============================================================================
// API: POST /api/scrape - Executa scraping manualmente
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { scrapeAllBlogs, scrapeBlog } from "../../lib/scraper.ts";
import { getBlog } from "../../lib/db.ts";

export const handler: Handlers = {
  /**
   * POST /api/scrape
   * Executa scraping de todos os blogs ou de um blog específico
   * Body (opcional):
   *   - blog_id: ID de um blog específico para fazer scraping
   */
  async POST(req) {
    try {
      const contentType = req.headers.get("content-type");
      let blogId: string | null = null;

      if (contentType?.includes("application/json")) {
        const body = await req.json();
        blogId = body.blog_id || null;
      }

      if (blogId) {
        // Scrape de um blog específico
        const blog = await getBlog(blogId);
        if (!blog) {
          return new Response(JSON.stringify({ error: "Blog not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }

        console.log(`[API] Starting scrape for blog: ${blog.name}`);
        const savedCount = await scrapeBlog(blog);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Scraping complete for ${blog.name}`,
            articles_saved: savedCount,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Scrape de todos os blogs
      console.log("[API] Starting full scrape...");
      await scrapeAllBlogs();

      return new Response(
        JSON.stringify({
          success: true,
          message: "Scraping complete for all blogs",
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error during scraping:", error);
      return new Response(
        JSON.stringify({ error: "Scraping failed", details: String(error) }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  },
};

