#!/usr/bin/env -S deno run -A --unstable-kv
// =============================================================================
// Blog Scraper MCP - CLI
// =============================================================================

import { parseArgs } from "@std/cli/parse-args";
import { seedBlogs, seedLinkedInSources, seedRedditSources, seedAll } from "./lib/seed.ts";
import { scrapeAllBlogs, generateWeeklyReport } from "./lib/scraper.ts";
import { scrapeAllLinkedInSources } from "./lib/linkedin-scraper.ts";
import { scrapeAllRedditSources } from "./lib/reddit-scraper.ts";
import {
  updateBlog,
  getBlog,
  listBlogs,
  listRedditContent,
  listLinkedInSources,
  listRedditSources,
  listLinkedInContent,
} from "./lib/db.ts";
import { getCurrentWeek } from "./lib/utils.ts";

const HELP_TEXT = `
📡 Content Scraper MCP - CLI

USAGE:
  deno task scraper <command> [options]

COMMANDS:
  scrape-all       Executa TODOS os scrapes (blogs + LinkedIn + Reddit)
  scrape-blogs     Executa scraping apenas de blogs
  scrape-linkedin  Executa scraping apenas de LinkedIn
  scrape-reddit    Executa scraping apenas de Reddit
  
  seed             Popula banco com TODAS as sources iniciais
  seed-blogs       Popula banco apenas com blogs
  seed-linkedin    Popula banco apenas com perfis LinkedIn
  seed-reddit      Popula banco apenas com subreddits
  
  list             Lista todos os blogs cadastrados
  list-linkedin    Lista perfis LinkedIn cadastrados
  list-reddit      Lista subreddits cadastrados
  
  posts-linkedin   Lista posts do LinkedIn salvos
  posts-reddit     Lista posts do Reddit salvos
  
  report [week]    Gera relatório da semana (ex: 2026-w04)
  set-authority    Ajusta authority de um blog
  ui               Inicia servidor web com interface
  help             Mostra esta ajuda

EXAMPLES:
  deno task scraper seed           # Popula todas as sources
  deno task scraper scrape-all     # Roda todos os scrapes
  deno task scraper list-linkedin  # Lista perfis LinkedIn
  deno task scraper posts-reddit   # Lista posts Reddit salvos

ENVIRONMENT:
  OPENROUTER_API_KEY    Chave da API OpenRouter (obrigatória para scraping)
  APIFY_API_TOKEN       Token da API Apify (obrigatório para LinkedIn)
  ADMIN_DB_TOKEN        Token do banco de dados
`;

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["week"],
    boolean: ["help"],
    alias: { h: "help", w: "week" },
  });

  const command = args._[0]?.toString() || "help";

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      console.log(HELP_TEXT);
      break;

    // ========================================
    // SEED COMMANDS
    // ========================================
    case "seed":
    case "seed-all":
      await seedAll();
      break;

    case "seed-blogs":
      await seedBlogs();
      break;

    case "seed-linkedin":
      await seedLinkedInSources();
      break;

    case "seed-reddit":
      await seedRedditSources();
      break;

    // ========================================
    // SCRAPE COMMANDS
    // ========================================
    case "scrape-all":
    case "all": {
      console.log("\n" + "═".repeat(60));
      console.log(" 🚀 RUNNING ALL SCRAPES");
      console.log("═".repeat(60));

      // 1. Blogs
      console.log("\n📰 [1/3] Scraping BLOGS...\n");
      try {
        await scrapeAllBlogs();
        console.log("\n✅ Blogs scrape complete!\n");
      } catch (error) {
        console.error("\n❌ Blogs scrape failed:", error);
      }

      // 2. LinkedIn
      console.log("\n💼 [2/3] Scraping LINKEDIN...\n");
      try {
        const linkedinResults = await scrapeAllLinkedInSources(5);
        const totalSaved = linkedinResults.reduce((sum, r) => sum + r.postsSaved, 0);
        const totalRelevant = linkedinResults.reduce((sum, r) => sum + r.postsRelevant, 0);
        console.log(`\n✅ LinkedIn scrape complete! ${totalSaved} posts saved, ${totalRelevant} relevant\n`);
      } catch (error) {
        console.error("\n❌ LinkedIn scrape failed:", error);
      }

      // 3. Reddit
      console.log("\n🤖 [3/3] Scraping REDDIT...\n");
      try {
        const redditResults = await scrapeAllRedditSources(10);
        const totalSaved = redditResults.reduce((sum, r) => sum + r.postsSaved, 0);
        const totalRelevant = redditResults.reduce((sum, r) => sum + r.postsRelevant, 0);
        console.log(`\n✅ Reddit scrape complete! ${totalSaved} posts saved, ${totalRelevant} relevant\n`);
      } catch (error) {
        console.error("\n❌ Reddit scrape failed:", error);
      }

      console.log("\n" + "═".repeat(60));
      console.log(" ✅ ALL SCRAPES COMPLETE");
      console.log("═".repeat(60) + "\n");
      break;
    }

    case "dev":
    case "scrape":
    case "scrape-blogs":
      console.log("\n🚀 Starting blogs scraping...\n");
      await scrapeAllBlogs();
      break;

    case "scrape-linkedin": {
      console.log("\n💼 Starting LinkedIn scraping...\n");
      try {
        const results = await scrapeAllLinkedInSources(5);
        const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
        const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);
        console.log(`\n✅ Complete! ${totalSaved} posts saved, ${totalRelevant} relevant\n`);
      } catch (error) {
        console.error("\n❌ LinkedIn scrape failed:", error);
      }
      break;
    }

    case "scrape-reddit": {
      console.log("\n🤖 Starting Reddit scraping...\n");
      try {
        const results = await scrapeAllRedditSources(10);
        const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
        const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);
        console.log(`\n✅ Complete! ${totalSaved} posts saved, ${totalRelevant} relevant\n`);
      } catch (error) {
        console.error("\n❌ Reddit scrape failed:", error);
      }
      break;
    }

    // ========================================
    // LIST SOURCES COMMANDS
    // ========================================
    case "list":
    case "list-blogs": {
      const blogs = await listBlogs();

      if (blogs.length === 0) {
        console.log("\n📭 No blogs registered. Run 'deno task scraper seed-blogs' to add initial blogs.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 📰 Registered Blogs");
      console.log("═".repeat(80));

      for (const blog of blogs) {
        console.log(`\n  ${blog.name}`);
        console.log(`    ID: ${blog.id}`);
        console.log(`    URL: ${blog.url}`);
        console.log(`    Type: ${blog.type}`);
        console.log(`    Authority: ${(blog.authority * 100).toFixed(0)}%`);
      }

      console.log("\n" + "═".repeat(80));
      console.log(` Total: ${blogs.length} blogs`);
      console.log("═".repeat(80) + "\n");
      break;
    }

    case "list-linkedin": {
      const sources = await listLinkedInSources(false);

      if (sources.length === 0) {
        console.log("\n📭 No LinkedIn sources registered. Run 'deno task scraper seed-linkedin' to add initial sources.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 💼 LinkedIn Sources");
      console.log("═".repeat(80));

      for (const source of sources) {
        const status = source.active ? "✓" : "○";
        console.log(`\n  ${status} ${source.name}`);
        console.log(`    URL: ${source.profile_url}`);
        console.log(`    Type: ${source.type} | Authority: ${(source.authority * 100).toFixed(0)}%`);
      }

      console.log("\n" + "═".repeat(80));
      const activeCount = sources.filter(s => s.active).length;
      console.log(` Total: ${sources.length} sources (${activeCount} active)`);
      console.log("═".repeat(80) + "\n");
      break;
    }

    case "list-reddit": {
      const sources = await listRedditSources(false);

      if (sources.length === 0) {
        console.log("\n📭 No Reddit sources registered. Run 'deno task scraper seed-reddit' to add initial sources.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 🤖 Reddit Sources");
      console.log("═".repeat(80));

      for (const source of sources) {
        const status = source.active ? "✓" : "○";
        console.log(`\n  ${status} ${source.name}`);
        console.log(`    Subreddit: r/${source.subreddit}`);
        console.log(`    Type: ${source.type} | Authority: ${(source.authority * 100).toFixed(0)}%`);
      }

      console.log("\n" + "═".repeat(80));
      const activeCount = sources.filter(s => s.active).length;
      console.log(` Total: ${sources.length} sources (${activeCount} active)`);
      console.log("═".repeat(80) + "\n");
      break;
    }

    // ========================================
    // LIST POSTS COMMANDS
    // ========================================
    case "posts-linkedin":
    case "linkedin-list": {
      const posts = await listLinkedInContent(20);

      if (posts.length === 0) {
        console.log("\n📭 No LinkedIn posts saved yet.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 💼 LinkedIn Posts (Top 20 by score)");
      console.log("═".repeat(80));

      for (const post of posts) {
        console.log(`\n  📝 ${post.author_name}`);
        console.log(`     Score: ${post.post_score}% | 👍 ${post.num_likes} | 💬 ${post.num_comments}`);
        console.log(`     ${(post.content || "").slice(0, 60)}...`);
      }

      console.log("\n" + "═".repeat(80));
      console.log(` Total displayed: ${posts.length} posts`);
      console.log("═".repeat(80) + "\n");
      break;
    }

    case "posts-reddit":
    case "reddit-list": {
      const posts = await listRedditContent(20);

      if (posts.length === 0) {
        console.log("\n📭 No Reddit posts saved yet.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 🤖 Reddit Posts (Top 20 by score)");
      console.log("═".repeat(80));

      for (const post of posts) {
        const scorePercent = ((post.post_score || 0) * 100).toFixed(0);
        console.log(`\n  📝 ${post.title.slice(0, 60)}${post.title.length > 60 ? "..." : ""}`);
        console.log(`     r/${post.subreddit} | Type: ${post.type} | Score: ${scorePercent}% | ⬆️ ${post.score} | 💬 ${post.num_comments}`);
        console.log(`     ${post.permalink}`);
      }

      console.log("\n" + "═".repeat(80));
      console.log(` Total displayed: ${posts.length} posts`);
      console.log("═".repeat(80) + "\n");
      break;
    }

    // ========================================
    // OTHER COMMANDS
    // ========================================
    case "report": {
      const week = args._[1]?.toString() || args.week || getCurrentWeek();
      const report = await generateWeeklyReport(week);
      console.log(report);
      break;
    }

    case "cron": {
      const schedule = Deno.env.get("CRON_SCHEDULE") || "0 8 * * *";
      console.log(`\n⏰ Starting cron job with schedule: ${schedule}`);
      console.log("Press Ctrl+C to stop\n");

      const runJob = async () => {
        console.log(`\n[${new Date().toISOString()}] Running scheduled scrape...`);
        try {
          await scrapeAllBlogs();
          await scrapeAllLinkedInSources(5);
          await scrapeAllRedditSources(10);
        } catch (error) {
          console.error("Scraping error:", error);
        }
      };

      await runJob();

      const parts = schedule.split(" ");
      const minute = parseInt(parts[0]) || 0;
      const hour = parseInt(parts[1]) || 8;

      const scheduleNextRun = () => {
        const now = new Date();
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);

        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }

        const delay = next.getTime() - now.getTime();
        console.log(`\nNext run scheduled for: ${next.toISOString()}`);

        setTimeout(async () => {
          await runJob();
          scheduleNextRun();
        }, delay);
      };

      scheduleNextRun();
      await new Promise(() => {});
      break;
    }

    case "ui":
    case "server": {
      const port = parseInt(Deno.env.get("PORT") || "3000");
      console.log(`\n🌐 Starting web UI on http://localhost:${port}\n`);
      console.log("Use 'deno task dev' for full development server with hot reload\n");

      const { start } = await import("$fresh/server.ts");
      const manifest = await import("./fresh.gen.ts");
      const config = await import("./fresh.config.ts");
      await start(manifest.default, config.default);
      break;
    }

    case "set-authority": {
      const blogId = args._[1]?.toString();
      const authorityStr = args._[2]?.toString();

      if (!blogId || !authorityStr) {
        console.error("\n❌ Usage: deno task scraper set-authority <blog_id> <authority>");
        console.error("   authority must be between 0 and 1 (e.g., 0.8)");
        Deno.exit(1);
      }

      const authority = parseFloat(authorityStr);
      if (isNaN(authority) || authority < 0 || authority > 1) {
        console.error("\n❌ Authority must be a number between 0 and 1");
        Deno.exit(1);
      }

      const blog = await getBlog(blogId);
      if (!blog) {
        console.error(`\n❌ Blog not found: ${blogId}`);
        Deno.exit(1);
      }

      const updated = await updateBlog(blogId, { authority });
      console.log(`\n✓ Updated ${updated?.name} authority to ${(authority * 100).toFixed(0)}%`);
      break;
    }

    default:
      console.error(`\n❌ Unknown command: ${command}`);
      console.log(HELP_TEXT);
      Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}
