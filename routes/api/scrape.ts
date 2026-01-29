// =============================================================================
// API: POST /api/scrape - Endpoint unificado para todos os scrapes
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import { scrapeAllBlogs, scrapeBlog } from "../../lib/scraper.ts";
import {
  scrapeAllLinkedInSources,
  scrapeLinkedInProfiles,
  type ScrapeResult as LinkedInScrapeResult,
} from "../../lib/linkedin-scraper.ts";
import {
  scrapeAllRedditSources,
  scrapeSubreddits,
  type SubredditScrapeResult,
} from "../../lib/reddit-scraper.ts";
import { getBlog, countLinkedInSources, countRedditSources } from "../../lib/db.ts";

interface ScrapeAllResult {
  blogs?: {
    success: boolean;
    message: string;
    articles_saved?: number;
    error?: string;
  };
  linkedin?: {
    success: boolean;
    message: string;
    sources_count?: number;
    total_posts_saved?: number;
    total_posts_relevant?: number;
    results?: LinkedInScrapeResult[];
    error?: string;
  };
  reddit?: {
    success: boolean;
    message: string;
    sources_count?: number;
    total_posts_saved?: number;
    total_posts_relevant?: number;
    results?: SubredditScrapeResult[];
    error?: string;
  };
}

export const handler: Handlers = {
  /**
   * POST /api/scrape
   * Endpoint unificado para executar scrapes
   * 
   * Body:
   *   - run_all: boolean - Roda TODOS os scrapes (blogs, linkedin, reddit) usando as tabelas de sources
   *   - blogs: boolean - Roda scrape de blogs
   *   - blog_id: string - Roda scrape de um blog específico
   *   - linkedin: boolean | object - Roda scrape de LinkedIn
   *     - Se true: usa fontes da tabela linkedin_sources
   *     - Se object: usa perfis custom { profiles: [...], max_posts: 5 }
   *   - reddit: boolean | object - Roda scrape de Reddit
   *     - Se true: usa fontes da tabela reddit_sources
   *     - Se object: usa subreddits custom { subreddits: [...], limit: 10 }
   *   - max_posts: number - Máximo de posts por fonte (default: 5 para LinkedIn, 10 para Reddit)
   * 
   * Exemplos:
   * 
   * 1. Rodar TUDO automaticamente (usa tabelas de sources):
   * { "run_all": true }
   * 
   * 2. Apenas blogs:
   * { "blogs": true }
   * 
   * 3. Apenas LinkedIn (fontes do banco):
   * { "linkedin": true }
   * 
   * 4. Apenas Reddit (fontes do banco):
   * { "reddit": true }
   * 
   * 5. LinkedIn + Reddit com configuração custom:
   * { 
   *   "linkedin": { "profiles": [...], "max_posts": 10 },
   *   "reddit": { "subreddits": [...], "limit": 15 }
   * }
   */
  async POST(req) {
    try {
      const contentType = req.headers.get("content-type");
      let body: Record<string, unknown> = {};

      if (contentType?.includes("application/json")) {
        body = await req.json();
      }

      const result: ScrapeAllResult = {};
      const runAll = body.run_all === true;
      const maxPostsLinkedIn = typeof body.max_posts === "number" ? body.max_posts : 5;
      const maxPostsReddit = typeof body.max_posts === "number" ? body.max_posts : 10;

      // ============================================================
      // 1. BLOGS SCRAPE
      // ============================================================
      if (runAll || body.blogs === true || body.blog_id) {
        console.log("\n" + "=".repeat(60));
        console.log("📰 STARTING BLOGS SCRAPE");
        console.log("=".repeat(60));

        try {
          if (body.blog_id && typeof body.blog_id === "string") {
            // Blog específico
            const blog = await getBlog(body.blog_id);
        if (!blog) {
              result.blogs = {
                success: false,
                message: "Blog not found",
                error: `Blog with ID ${body.blog_id} not found`,
              };
            } else {
              const savedCount = await scrapeBlog(blog);
              result.blogs = {
                success: true,
                message: `Scraping complete for ${blog.name}`,
                articles_saved: savedCount,
              };
            }
          } else {
            // Todos os blogs
            await scrapeAllBlogs();
            result.blogs = {
              success: true,
              message: "Scraping complete for all blogs",
            };
          }
        } catch (error) {
          console.error("[Blogs] Error:", error);
          result.blogs = {
            success: false,
            message: "Blogs scraping failed",
            error: String(error),
          };
        }
      }

      // ============================================================
      // 2. LINKEDIN SCRAPE
      // ============================================================
      if (runAll || body.linkedin) {
        console.log("\n" + "=".repeat(60));
        console.log("💼 STARTING LINKEDIN SCRAPE");
        console.log("=".repeat(60));

        try {
          let linkedinResults: LinkedInScrapeResult[];
          let sourcesCount = 0;

          if (body.linkedin === true || runAll) {
            // Usa fontes do banco
            sourcesCount = await countLinkedInSources(true);
            linkedinResults = await scrapeAllLinkedInSources(maxPostsLinkedIn);
          } else if (typeof body.linkedin === "object" && body.linkedin !== null) {
            // Usa configuração custom
            const config = body.linkedin as Record<string, unknown>;
            
            if (Array.isArray(config.profiles)) {
              const profiles = config.profiles.map((p: Record<string, unknown>) => ({
                url: String(p.url),
                authority: typeof p.authority === "number" ? p.authority : 0.7,
              }));
              sourcesCount = profiles.length;
              const maxPosts = typeof config.max_posts === "number" ? config.max_posts : maxPostsLinkedIn;
              linkedinResults = await scrapeLinkedInProfiles(profiles, maxPosts);
            } else {
              throw new Error("linkedin.profiles must be an array");
            }
          } else {
            throw new Error("Invalid linkedin configuration");
          }

          const totalSaved = linkedinResults.reduce((sum, r) => sum + r.postsSaved, 0);
          const totalRelevant = linkedinResults.reduce((sum, r) => sum + r.postsRelevant, 0);

          result.linkedin = {
            success: true,
            message: `Scraping complete for ${sourcesCount} LinkedIn sources`,
            sources_count: sourcesCount,
            total_posts_saved: totalSaved,
            total_posts_relevant: totalRelevant,
            results: linkedinResults,
          };
        } catch (error) {
          console.error("[LinkedIn] Error:", error);
          result.linkedin = {
            success: false,
            message: "LinkedIn scraping failed",
            error: String(error),
          };
        }
      }

      // ============================================================
      // 3. REDDIT SCRAPE
      // ============================================================
      if (runAll || body.reddit) {
        console.log("\n" + "=".repeat(60));
        console.log("🤖 STARTING REDDIT SCRAPE");
        console.log("=".repeat(60));

        try {
          let redditResults: SubredditScrapeResult[];
          let sourcesCount = 0;

          if (body.reddit === true || runAll) {
            // Usa fontes do banco
            sourcesCount = await countRedditSources(true);
            redditResults = await scrapeAllRedditSources(maxPostsReddit);
          } else if (typeof body.reddit === "object" && body.reddit !== null) {
            // Usa configuração custom
            const config = body.reddit as Record<string, unknown>;
            
            if (Array.isArray(config.subreddits)) {
              const subreddits = config.subreddits.map((s: Record<string, unknown>) => ({
                subreddit: String(s.subreddit || s.name),
                authority: typeof s.authority === "number" ? s.authority : 0.7,
                type: (s.type as "Community") || "Community",
              }));
              sourcesCount = subreddits.length;
              const limit = typeof config.limit === "number" ? config.limit : maxPostsReddit;
              redditResults = await scrapeSubreddits(subreddits, limit);
            } else {
              throw new Error("reddit.subreddits must be an array");
            }
          } else {
            throw new Error("Invalid reddit configuration");
          }

          const totalSaved = redditResults.reduce((sum, r) => sum + r.postsSaved, 0);
          const totalRelevant = redditResults.reduce((sum, r) => sum + r.postsRelevant, 0);

          result.reddit = {
            success: true,
            message: `Scraping complete for ${sourcesCount} Reddit sources`,
            sources_count: sourcesCount,
            total_posts_saved: totalSaved,
            total_posts_relevant: totalRelevant,
            results: redditResults,
          };
        } catch (error) {
          console.error("[Reddit] Error:", error);
          result.reddit = {
            success: false,
            message: "Reddit scraping failed",
            error: String(error),
          };
        }
      }

      // ============================================================
      // RESPONSE
      // ============================================================
      const hasAnyResult = Object.keys(result).length > 0;

      if (!hasAnyResult) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No scrape action specified",
            help: {
              run_all: "Set to true to run ALL scrapes using database sources",
              blogs: "Set to true to scrape all blogs",
              blog_id: "Provide blog ID to scrape specific blog",
              linkedin: "Set to true (use DB sources) or object with profiles array",
              reddit: "Set to true (use DB sources) or object with subreddits array",
              max_posts: "Max posts per source (default: 5 for LinkedIn, 10 for Reddit)",
            },
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      const allSucceeded = Object.values(result).every((r) => r?.success);

      console.log("\n" + "=".repeat(60));
      console.log("✅ SCRAPE COMPLETE");
      console.log("=".repeat(60));

      return new Response(
        JSON.stringify({
          success: allSucceeded,
          message: runAll ? "Full scrape completed" : "Scrape completed",
          results: result,
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

  /**
   * GET /api/scrape
   * Retorna informações sobre o endpoint e sources disponíveis
   */
  async GET(_req) {
    const linkedInCount = await countLinkedInSources(true);
    const redditCount = await countRedditSources(true);

    return new Response(
      JSON.stringify({
        endpoint: "/api/scrape",
        method: "POST",
        description: "Unified scraping endpoint for blogs, LinkedIn, and Reddit",
        sources: {
          linkedin: `${linkedInCount} active profiles in database`,
          reddit: `${redditCount} active subreddits in database`,
        },
        options: {
          run_all: {
            type: "boolean",
            description: "Run ALL scrapes using database sources (blogs + linkedin + reddit)",
          },
          blogs: {
            type: "boolean",
            description: "Scrape all registered blogs",
          },
          blog_id: {
            type: "string",
            description: "Scrape a specific blog by ID",
          },
          linkedin: {
            type: "boolean | object",
            description: "true = use DB sources, object = custom profiles",
            object_properties: {
              profiles: "Array<{ url: string, authority?: number }>",
              max_posts: "number (default: 5)",
            },
          },
          reddit: {
            type: "boolean | object",
            description: "true = use DB sources, object = custom subreddits",
            object_properties: {
              subreddits: "Array<{ subreddit: string, authority?: number, type?: string }>",
              limit: "number (default: 10)",
            },
          },
          max_posts: {
            type: "number",
            description: "Global max posts per source",
          },
        },
        examples: {
          run_all: { run_all: true },
          blogs_only: { blogs: true },
          linkedin_from_db: { linkedin: true },
          reddit_from_db: { reddit: true },
          linkedin_custom: {
            linkedin: {
              profiles: [
                { url: "https://linkedin.com/in/example/", authority: 0.8 },
              ],
              max_posts: 10,
            },
          },
          reddit_custom: {
            reddit: {
              subreddits: [
                { subreddit: "MachineLearning", authority: 0.7 },
              ],
              limit: 15,
            },
          },
        },
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  },
};
