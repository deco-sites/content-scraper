// =============================================================================
// Blog Scraper MCP - Seed Data
// =============================================================================

import type { BlogInsert, BlogType } from "./types.ts";
import { createBlog, listBlogs } from "./db.ts";

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

