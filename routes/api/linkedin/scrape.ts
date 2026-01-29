// =============================================================================
// API: POST /api/linkedin/scrape - Executa scraping do LinkedIn
// =============================================================================

import { Handlers } from "$fresh/server.ts";
import {
  scrapeLinkedInProfile,
  scrapeLinkedInProfiles,
} from "../../../lib/linkedin-scraper.ts";

export const handler: Handlers = {
  /**
   * POST /api/linkedin/scrape
   * Executa scraping de perfis do LinkedIn
   * Nota: LinkedIn sempre salva como type "community"
   * 
   * Body:
   *   - profile_url: URL de um perfil específico (string)
   *   - profiles: Array de perfis para scraping (alternativa ao profile_url)
   *   - authority: Autoridade do autor (0.0 a 1.0, default: 0.7)
   *   - max_posts: Número máximo de posts por perfil (default: 5)
   * 
   * Exemplo single:
   * { "profile_url": "https://www.linkedin.com/in/vitorbal/", "authority": 0.8 }
   * 
   * Exemplo múltiplos:
   * { "profiles": [
   *     { "url": "https://www.linkedin.com/in/vitorbal/", "authority": 0.8 },
   *     { "url": "https://www.linkedin.com/in/satyanadella/", "authority": 0.9 }
   *   ],
   *   "max_posts": 5
   * }
   */
  async POST(req) {
    try {
      const body = await req.json();
      const maxPosts = body.max_posts || 5;

      // Múltiplos perfis
      if (body.profiles && Array.isArray(body.profiles)) {
        const profiles = body.profiles.map((p: { url: string; authority?: number }) => ({
          url: p.url,
          authority: typeof p.authority === "number" ? p.authority : 0.7,
        }));

        if (profiles.length === 0) {
          return new Response(
            JSON.stringify({ error: "No valid profiles provided" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json" },
            }
          );
        }

        console.log(`[API] Starting LinkedIn scrape for ${profiles.length} profiles (type: community)`);
        const results = await scrapeLinkedInProfiles(profiles, maxPosts);

        const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
        const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);

        return new Response(
          JSON.stringify({
            success: true,
            message: `Scraping complete for ${profiles.length} profiles`,
            type: "community",
            total_posts_saved: totalSaved,
            total_posts_relevant: totalRelevant,
            results,
          }),
          {
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Perfil único
      if (!body.profile_url || typeof body.profile_url !== "string") {
        return new Response(
          JSON.stringify({ error: "profile_url is required" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Valida URL do LinkedIn
      if (!body.profile_url.includes("linkedin.com")) {
        return new Response(
          JSON.stringify({ error: "Invalid LinkedIn URL" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Valida authority
      const authority = typeof body.authority === "number"
        ? Math.max(0, Math.min(1, body.authority))
        : 0.7;

      console.log(`[API] Starting LinkedIn scrape for: ${body.profile_url} (type: community)`);
      const result = await scrapeLinkedInProfile(
        body.profile_url,
        authority,
        maxPosts
      );

      return new Response(
        JSON.stringify({
          success: true,
          message: `Scraping complete`,
          type: "community",
          ...result,
        }),
        {
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error during LinkedIn scraping:", error);
      return new Response(
        JSON.stringify({
          error: "LinkedIn scraping failed",
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
