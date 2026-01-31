/**
 * Scraping Tools
 * 
 * Tools para executar scraping de diferentes fontes.
 */

import { z } from "npm:zod@3.24.0";
import { scrapeAllBlogs } from "../../lib/scraper.ts";
import { scrapeAllLinkedInSources, scrapeLinkedInProfile } from "../../lib/linkedin-scraper.ts";
import { scrapeAllRedditSources, scrapeSubreddit } from "../../lib/reddit-scraper.ts";

// Schema definitions
export const scrapeAllSchema = z.object({
  linkedin_max_posts: z
    .number()
    .optional()
    .default(5)
    .describe("Máximo de posts por perfil do LinkedIn (default: 5)"),
  reddit_limit: z
    .number()
    .optional()
    .default(10)
    .describe("Limite de posts por subreddit (default: 10)"),
});

export const scrapeBlogsSchema = z.object({});

export const scrapeLinkedInSchema = z.object({
  max_posts: z
    .number()
    .optional()
    .default(5)
    .describe("Máximo de posts por perfil (default: 5)"),
  profile_url: z
    .string()
    .optional()
    .describe("URL específica de um perfil para scrape. Se não informado, scrape todos os perfis cadastrados."),
});

export const scrapeRedditSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(10)
    .describe("Limite de posts por subreddit (default: 10)"),
  subreddit: z
    .string()
    .optional()
    .describe("Subreddit específico para scrape (sem 'r/'). Se não informado, scrape todos os cadastrados."),
});

// Tool handlers
export async function handleScrapeAll(args: z.infer<typeof scrapeAllSchema>) {
  const linkedinMaxPosts = args.linkedin_max_posts || 5;
  const redditLimit = args.reddit_limit || 10;

  const results = {
    blogs: { success: false, message: "" },
    linkedin: { success: false, message: "", saved: 0, relevant: 0 },
    reddit: { success: false, message: "", saved: 0, relevant: 0 },
  };

  // Blogs
  try {
    await scrapeAllBlogs();
    results.blogs = { success: true, message: "Blogs scrape complete" };
  } catch (error) {
    results.blogs = { success: false, message: String(error) };
  }

  // LinkedIn
  try {
    const linkedinResults = await scrapeAllLinkedInSources(linkedinMaxPosts);
    const totalSaved = linkedinResults.reduce((sum, r) => sum + r.postsSaved, 0);
    const totalRelevant = linkedinResults.reduce((sum, r) => sum + r.postsRelevant, 0);
    results.linkedin = {
      success: true,
      message: `LinkedIn scrape complete`,
      saved: totalSaved,
      relevant: totalRelevant,
    };
  } catch (error) {
    results.linkedin = { success: false, message: String(error), saved: 0, relevant: 0 };
  }

  // Reddit
  try {
    const redditResults = await scrapeAllRedditSources(redditLimit);
    const totalSaved = redditResults.reduce((sum, r) => sum + r.postsSaved, 0);
    const totalRelevant = redditResults.reduce((sum, r) => sum + r.postsRelevant, 0);
    results.reddit = {
      success: true,
      message: `Reddit scrape complete`,
      saved: totalSaved,
      relevant: totalRelevant,
    };
  } catch (error) {
    results.reddit = { success: false, message: String(error), saved: 0, relevant: 0 };
  }

  return results;
}

export async function handleScrapeBlogs() {
  try {
    await scrapeAllBlogs();
    return { success: true, message: "Blogs scraping completed successfully" };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function handleScrapeLinkedIn(args: z.infer<typeof scrapeLinkedInSchema>) {
  const maxPosts = args.max_posts || 5;
  const profileUrl = args.profile_url;

  try {
    if (profileUrl) {
      const result = await scrapeLinkedInProfile(profileUrl, 0.7, maxPosts);
      return {
        success: true,
        profile: profileUrl,
        posts_found: result.postsFound,
        posts_saved: result.postsSaved,
        posts_relevant: result.postsRelevant,
      };
    } else {
      const results = await scrapeAllLinkedInSources(maxPosts);
      const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
      const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);
      return {
        success: true,
        profiles_processed: results.length,
        total_saved: totalSaved,
        total_relevant: totalRelevant,
        details: results,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function handleScrapeReddit(args: z.infer<typeof scrapeRedditSchema>) {
  const limit = args.limit || 10;
  const subreddit = args.subreddit;

  try {
    if (subreddit) {
      const result = await scrapeSubreddit(subreddit, 0.7, "Community", limit);
      return {
        success: true,
        subreddit: subreddit,
        posts_found: result.postsFound,
        posts_saved: result.postsSaved,
        posts_relevant: result.postsRelevant,
      };
    } else {
      const results = await scrapeAllRedditSources(limit);
      const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
      const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);
      return {
        success: true,
        subreddits_processed: results.length,
        total_saved: totalSaved,
        total_relevant: totalRelevant,
        details: results,
      };
    }
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

// Tool definitions for MCP
export const scrapingTools = [
  {
    name: "scrape_all",
    description: "Executa scraping de TODAS as fontes cadastradas (blogs, LinkedIn e Reddit). Pode demorar alguns minutos.",
    schema: scrapeAllSchema,
    handler: handleScrapeAll,
  },
  {
    name: "scrape_blogs",
    description: "Executa scraping apenas dos blogs cadastrados. Busca artigos novos sobre MCP.",
    schema: scrapeBlogsSchema,
    handler: handleScrapeBlogs,
  },
  {
    name: "scrape_linkedin",
    description: "Executa scraping de perfis do LinkedIn cadastrados. Requer APIFY_API_TOKEN configurado.",
    schema: scrapeLinkedInSchema,
    handler: handleScrapeLinkedIn,
  },
  {
    name: "scrape_reddit",
    description: "Executa scraping de subreddits cadastrados. Busca posts relevantes sobre MCP/AI.",
    schema: scrapeRedditSchema,
    handler: handleScrapeReddit,
  },
];

