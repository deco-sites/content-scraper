// =============================================================================
// Reddit Scraper - Fetch and process Reddit posts
// =============================================================================

import type {
  BlogType,
  RedditContentInsert,
  RedditRawPost,
  RedditSource,
} from "./types.ts";
import {
  createRedditContent,
  redditContentExistsByPermalink,
  redditContentExistsByHash,
  listRedditSources,
} from "./db.ts";
import { analyzeRedditPost } from "./llm.ts";
import { sleep, generateContentHash } from "./utils.ts";

// Rate limiting
const DELAY_BETWEEN_POSTS = 300; // 300ms entre posts (análise LLM)
const DELAY_BETWEEN_SUBREDDITS = 2000; // 2s entre subreddits

/**
 * Calcula a semana do ano no formato YYYY-wWW
 */
function getWeekDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(
    ((date.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7
  );
  return `${year}-w${String(weekNum).padStart(2, "0")}`;
}

/**
 * Converte BlogType para RedditContentType
 */
function blogTypeToRedditType(type: BlogType): "Trendsetters" | "Enterprise" | "MCP-First Startups" | "Community" {
  switch (type) {
    case "Trendsetter":
      return "Trendsetters";
    case "Enterprise":
      return "Enterprise";
    case "MCP-First Startups":
      return "MCP-First Startups";
    case "Community":
    default:
      return "Community";
  }
}

/**
 * Busca posts de um subreddit via API pública do Reddit
 */
async function fetchSubredditPosts(
  subreddit: string,
  limit = 10,
  sort: "hot" | "new" | "top" = "hot"
): Promise<RedditRawPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}`;

  console.log(`[Reddit] Fetching from: ${url}`);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "ContentScraper/1.0 (by /u/content-scraper)",
    },
  });

  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status} - ${response.statusText}`);
  }

  const data = await response.json();

  if (!data.data?.children) {
    return [];
  }

  // Converte para o formato RedditRawPost
  // deno-lint-ignore no-explicit-any
  return data.data.children.map((child: any) => {
    const post = child.data;
    return {
      id: post.id,
      title: post.title,
      author: post.author,
      subreddit: post.subreddit,
      selftext: post.selftext || "",
      url: post.url,
      permalink: `https://reddit.com${post.permalink}`,
      score: post.score,
      num_comments: post.num_comments,
      created_utc: post.created_utc,
      is_self: post.is_self,
      flair: post.link_flair_text || null,
      nsfw: post.over_18,
    } as RedditRawPost;
  });
}

/**
 * Resultado do scraping de um subreddit
 */
export interface SubredditScrapeResult {
  subreddit: string;
  postsFound: number;
  postsSaved: number;
  postsRelevant: number;
  postsSkipped: number;
  errors: string[];
}

/**
 * Processa e salva posts do Reddit (já baixados)
 */
export async function processRedditPosts(
  posts: RedditRawPost[],
  type: "Trendsetters" | "Enterprise" | "MCP-First Startups" | "Community",
  authority: number = 0.7
): Promise<{
  postsSaved: number;
  postsRelevant: number;
  postsSkipped: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let postsSaved = 0;
  let postsRelevant = 0;
  let postsSkipped = 0;

  console.log(`[Reddit] Processing ${posts.length} posts (type: ${type})`);

  for (const post of posts) {
    try {
      // Verifica se já existe pelo permalink
      const existsByPermalink = await redditContentExistsByPermalink(post.permalink);
      if (existsByPermalink) {
        console.log(`    → Skipping (already exists): ${post.title.slice(0, 40)}...`);
        postsSkipped++;
        continue;
      }

      // Gera hash do conteúdo para detectar cross-posting
      const content = post.selftext || post.title;
      const contentHash = await generateContentHash(post.title + " " + content);

      // Verifica se já existe conteúdo igual em outro subreddit
      const existsByHash = await redditContentExistsByHash(contentHash);
      if (existsByHash) {
        console.log(`    → Skipping (cross-post detected): ${post.title.slice(0, 40)}...`);
        postsSkipped++;
        continue;
      }

      // Analisa com LLM
      const analysis = await analyzeRedditPost(
        post.title,
        content,
        post.subreddit,
        { upvotes: post.score, comments: post.num_comments }
      );

      // Se não for relevante, pula (mas conta)
      if (!analysis.is_relevant) {
        console.log(`    → Skipping (not relevant): ${post.title.slice(0, 40)}...`);
        postsSkipped++;
        continue;
      }

      postsRelevant++;

      // post_score é 0.0 a 1.0 (REAL no banco)
      const postScore = analysis.quality_score;

      // Prepara dados para inserção
      const insertData: RedditContentInsert = {
        title: post.title,
        author: post.author,
        subreddit: post.subreddit,
        selftext: post.selftext || null,
        url: post.url,
        permalink: post.permalink,
        score: post.score,
        num_comments: post.num_comments,
        created_at: post.created_utc,
        type: type,
        authority: authority,
        post_score: postScore,
        week_date: getWeekDate(post.created_utc),
        content_hash: contentHash,
      };

      // Salva no banco
      await createRedditContent(insertData);
      postsSaved++;
      console.log(`    ✓ Saved (score: ${(postScore * 100).toFixed(0)}%): ${post.title.slice(0, 40)}...`);

      // Rate limiting entre posts
      await sleep(DELAY_BETWEEN_POSTS);

    } catch (error) {
      const errorMsg = `Error processing post ${post.id}: ${error}`;
      console.error(`    ✗ ${errorMsg}`);
      errors.push(errorMsg);
    }
  }

  console.log(`[Reddit] Finished: ${postsSaved} saved, ${postsRelevant} relevant, ${postsSkipped} skipped`);

  return {
    postsSaved,
    postsRelevant,
    postsSkipped,
    errors,
  };
}

/**
 * Faz scraping de um subreddit específico
 */
export async function scrapeSubreddit(
  subreddit: string,
  authority = 0.7,
  type: "Trendsetters" | "Enterprise" | "MCP-First Startups" | "Community" = "Community",
  limit = 10
): Promise<SubredditScrapeResult> {
  console.log(`[Reddit] Scraping r/${subreddit}`);
  console.log(`    Authority: ${(authority * 100).toFixed(0)}%, Type: ${type}`);

  try {
    // Busca posts do subreddit
    const posts = await fetchSubredditPosts(subreddit, limit, "hot");

    if (posts.length === 0) {
      console.log("    ⚠ No posts found");
      return {
        subreddit,
        postsFound: 0,
        postsSaved: 0,
        postsRelevant: 0,
        postsSkipped: 0,
        errors: [],
      };
    }

    console.log(`    Found ${posts.length} posts`);

    // Processa os posts
    const result = await processRedditPosts(posts, type, authority);

    return {
      subreddit,
      postsFound: posts.length,
      postsSaved: result.postsSaved,
      postsRelevant: result.postsRelevant,
      postsSkipped: result.postsSkipped,
      errors: result.errors,
    };
  } catch (error) {
    console.error(`    ✗ Error: ${error}`);
    return {
      subreddit,
      postsFound: 0,
      postsSaved: 0,
      postsRelevant: 0,
      postsSkipped: 0,
      errors: [String(error)],
    };
  }
}

/**
 * Faz scraping de múltiplos subreddits
 */
export async function scrapeSubreddits(
  subreddits: Array<{
    subreddit: string;
    authority?: number;
    type?: "Trendsetters" | "Enterprise" | "MCP-First Startups" | "Community";
  }>,
  limit = 10
): Promise<SubredditScrapeResult[]> {
  console.log("=".repeat(60));
  console.log("Reddit Scraper - Starting scraping process");
  console.log("=".repeat(60));
  console.log(`\nProcessing ${subreddits.length} subreddits\n`);

  const results: SubredditScrapeResult[] = [];

  for (let i = 0; i < subreddits.length; i++) {
    const sub = subreddits[i];
    console.log(`\n[${i + 1}/${subreddits.length}] Processing: r/${sub.subreddit}`);

    const result = await scrapeSubreddit(
      sub.subreddit,
      sub.authority || 0.7,
      sub.type || "Community",
      limit
    );
    results.push(result);

    console.log(`    ✓ Done: ${result.postsSaved} saved, ${result.postsRelevant} relevant`);

    // Rate limiting entre subreddits
    if (i < subreddits.length - 1) {
      await sleep(DELAY_BETWEEN_SUBREDDITS);
    }
  }

  const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
  const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);

  console.log("\n" + "=".repeat(60));
  console.log(`Scraping complete! Total: ${totalSaved} posts saved, ${totalRelevant} relevant`);
  console.log("=".repeat(60));

  return results;
}

/**
 * Faz scraping de todas as fontes Reddit cadastradas no banco
 * Busca automaticamente da tabela reddit_sources
 */
export async function scrapeAllRedditSources(limit = 10): Promise<SubredditScrapeResult[]> {
  console.log("=".repeat(60));
  console.log("Reddit Scraper - Scraping All Sources");
  console.log("=".repeat(60));

  // Busca fontes ativas do banco
  const sources = await listRedditSources(true);

  if (sources.length === 0) {
    console.log("\n⚠ No active Reddit sources found in database.");
    console.log("Run 'deno task scraper seed-reddit' to add initial sources.\n");
    return [];
  }

  console.log(`\nFound ${sources.length} active Reddit sources\n`);

  // Converte para o formato esperado
  const subreddits = sources.map((source: RedditSource) => ({
    subreddit: source.subreddit,
    authority: source.authority,
    type: blogTypeToRedditType(source.type),
  }));

  return await scrapeSubreddits(subreddits, limit);
}
