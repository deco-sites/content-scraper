// =============================================================================
// Blog Scraper MCP - Seed Data
// =============================================================================

import type { BlogInsert, BlogType, LinkedInSourceInsert, RedditSourceInsert } from "./types.ts";
import {
  createBlog,
  listBlogs,
  createLinkedInSource,
  listLinkedInSources,
  createRedditSource,
  listRedditSources,
} from "./db.ts";

/**
 * Blogs iniciais para seeding
 */
const INITIAL_BLOGS: BlogInsert[] = [
  {
    name: "Claude (Anthropic)",
    url: "https://www.anthropic.com/news",
    authority: 1.0,
    type: "Enterprise" as BlogType,
  },
  {
    name: "MintMCP",
    url: "https://www.mintmcp.com/blog",
    authority: 0.95,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Fiberplane",
    url: "https://fiberplane.com/blog",
    authority: 0.9,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Arcade",
    url: "https://blog.arcade.dev/",
    authority: 0.85,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Zuplo",
    url: "https://zuplo.com/blog",
    authority: 0.8,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "TrueFoundry",
    url: "https://www.truefoundry.com/blog",
    authority: 0.75,
    type: "Enterprise" as BlogType,
  },
  {
    name: "Lunar",
    url: "https://www.lunar.dev/lunar-blog",
    authority: 0.7,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "RunLayer",
    url: "https://www.runlayer.com/blog",
    authority: 0.7,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Lasso Security",
    url: "https://www.lasso.security/blog",
    authority: 0.7,
    type: "Enterprise" as BlogType,
  },
  {
    name: "ScaleKit",
    url: "https://www.scalekit.com/blog",
    authority: 0.65,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Vendia",
    url: "https://www.vendia.com/blog",
    authority: 0.6,
    type: "Enterprise" as BlogType,
  },
  {
    name: "FastN",
    url: "https://fastn.ai/blog",
    authority: 0.6,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Hacker News",
    url: "https://news.ycombinator.com/",
    authority: 0.5,
    type: "Community" as BlogType,
  },
];

/**
 * Popula o banco de dados com os blogs iniciais
 */
export async function seedBlogs(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Blog Scraper MCP - Seeding Database");
  console.log("=".repeat(60));

  // Verifica se já existem blogs
  const existingBlogs = await listBlogs();
  if (existingBlogs.length > 0) {
    console.log(`\n⚠ Database already has ${existingBlogs.length} blogs.`);
    console.log("To re-seed, first clear the database.\n");
    return;
  }

  console.log(`\nAdding ${INITIAL_BLOGS.length} blogs...\n`);

  for (const blogData of INITIAL_BLOGS) {
    const blog = await createBlog(blogData);
    console.log(`✓ Added: ${blog.name} (Authority: ${(blog.authority * 100).toFixed(0)}%)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Seeding complete! Added ${INITIAL_BLOGS.length} blogs.`);
  console.log("=".repeat(60));
}

// =============================================================================
// LinkedIn Sources Seed Data
// =============================================================================

/**
 * Perfis do LinkedIn iniciais para seeding
 */
const INITIAL_LINKEDIN_SOURCES: LinkedInSourceInsert[] = [
  {
    name: "Satya Nadella",
    profile_url: "https://www.linkedin.com/in/satyanadella/",
    authority: 0.95,
    type: "Enterprise" as BlogType,
  },
  {
    name: "Alex Albert",
    profile_url: "https://www.linkedin.com/in/alexalbert/",
    authority: 0.9,
    type: "Trendsetter" as BlogType,
  },
  {
    name: "Dario Amodei",
    profile_url: "https://www.linkedin.com/in/darioamodei/",
    authority: 0.95,
    type: "Enterprise" as BlogType,
  },
  {
    name: "Amanda Askell",
    profile_url: "https://www.linkedin.com/in/amanda-askell/",
    authority: 0.85,
    type: "Enterprise" as BlogType,
  },
  {
    name: "Simon Willison",
    profile_url: "https://www.linkedin.com/in/simonwillison/",
    authority: 0.85,
    type: "Trendsetter" as BlogType,
  },
  {
    name: "Harrison Chase",
    profile_url: "https://www.linkedin.com/in/harrison-chase-961287118/",
    authority: 0.85,
    type: "MCP-First Startups" as BlogType,
  },
  {
    name: "Swyx",
    profile_url: "https://www.linkedin.com/in/swyx/",
    authority: 0.8,
    type: "Trendsetter" as BlogType,
  },
];

/**
 * Popula o banco de dados com os perfis LinkedIn iniciais
 */
export async function seedLinkedInSources(): Promise<void> {
  console.log("=".repeat(60));
  console.log("LinkedIn Sources - Seeding Database");
  console.log("=".repeat(60));

  // Verifica se já existem sources
  const existingSources = await listLinkedInSources(false);
  if (existingSources.length > 0) {
    console.log(`\n⚠ Database already has ${existingSources.length} LinkedIn sources.`);
    console.log("To re-seed, first clear the database.\n");
    return;
  }

  console.log(`\nAdding ${INITIAL_LINKEDIN_SOURCES.length} LinkedIn profiles...\n`);

  for (const sourceData of INITIAL_LINKEDIN_SOURCES) {
    const source = await createLinkedInSource(sourceData);
    console.log(`✓ Added: ${source.name} (Authority: ${(source.authority * 100).toFixed(0)}%)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Seeding complete! Added ${INITIAL_LINKEDIN_SOURCES.length} LinkedIn sources.`);
  console.log("=".repeat(60));
}

// =============================================================================
// Reddit Sources Seed Data
// =============================================================================

/**
 * Subreddits iniciais para seeding
 */
const INITIAL_REDDIT_SOURCES: RedditSourceInsert[] = [
  {
    name: "LLM Developers",
    subreddit: "LLMDevs",
    authority: 0.75,
    type: "Community" as BlogType,
  },
  {
    name: "AI Agents",
    subreddit: "AI_Agents",
    authority: 0.75,
    type: "Community" as BlogType,
  },
  {
    name: "MCP Protocol",
    subreddit: "mcp",
    authority: 0.85,
    type: "Community" as BlogType,
  },
  {
    name: "Local LLaMA",
    subreddit: "LocalLLaMA",
    authority: 0.7,
    type: "Community" as BlogType,
  },
  {
    name: "Machine Learning",
    subreddit: "MachineLearning",
    authority: 0.7,
    type: "Community" as BlogType,
  },
];

/**
 * Popula o banco de dados com os subreddits iniciais
 */
export async function seedRedditSources(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Reddit Sources - Seeding Database");
  console.log("=".repeat(60));

  // Verifica se já existem sources
  const existingSources = await listRedditSources(false);
  if (existingSources.length > 0) {
    console.log(`\n⚠ Database already has ${existingSources.length} Reddit sources.`);
    console.log("To re-seed, first clear the database.\n");
    return;
  }

  console.log(`\nAdding ${INITIAL_REDDIT_SOURCES.length} subreddits...\n`);

  for (const sourceData of INITIAL_REDDIT_SOURCES) {
    const source = await createRedditSource(sourceData);
    console.log(`✓ Added: r/${source.subreddit} (Authority: ${(source.authority * 100).toFixed(0)}%)`);
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Seeding complete! Added ${INITIAL_REDDIT_SOURCES.length} Reddit sources.`);
  console.log("=".repeat(60));
}

/**
 * Popula o banco de dados com todos os dados iniciais
 */
export async function seedAll(): Promise<void> {
  console.log("\n" + "═".repeat(60));
  console.log(" 🌱 SEEDING ALL DATA SOURCES");
  console.log("═".repeat(60) + "\n");

  await seedBlogs();
  console.log("");
  await seedLinkedInSources();
  console.log("");
  await seedRedditSources();

  console.log("\n" + "═".repeat(60));
  console.log(" ✅ ALL SEEDS COMPLETE");
  console.log("═".repeat(60) + "\n");
}

