#!/usr/bin/env -S deno run -A --unstable-kv
// =============================================================================
// Blog Scraper MCP - CLI
// =============================================================================

import { parseArgs } from "@std/cli/parse-args";
import { seedBlogs } from "./lib/seed.ts";
import { scrapeAllBlogs, generateWeeklyReport } from "./lib/scraper.ts";
import { updateBlog, getBlog, listBlogs } from "./lib/db.ts";
import { getCurrentWeek } from "./lib/utils.ts";

const HELP_TEXT = `
📡 Blog Scraper MCP - CLI

USAGE:
  deno task scraper <command> [options]

COMMANDS:
  dev              Executa scraping uma vez (modo desenvolvimento)
  seed             Popula banco com blogs iniciais
  cron             Inicia job agendado de scraping
  report [week]    Gera relatório da semana (ex: 2026-w04)
  ui               Inicia servidor web com interface
  set-authority    Ajusta authority de um blog
  list             Lista todos os blogs cadastrados
  help             Mostra esta ajuda

EXAMPLES:
  deno task scraper seed
  deno task scraper dev
  deno task scraper report 2026-w04
  deno task scraper set-authority <id> 0.8

ENVIRONMENT:
  OPENROUTER_API_KEY    Chave da API OpenRouter (obrigatória para scraping)
  CRON_SCHEDULE         Expressão cron (padrão: "0 8 * * *")
  PORT                  Porta do servidor web (padrão: 3000)
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

    case "seed":
      await seedBlogs();
      break;

    case "dev":
    case "scrape":
      console.log("\n🚀 Starting scraping...\n");
      await scrapeAllBlogs();
      break;

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

      // Simple cron implementation
      const runJob = async () => {
        console.log(`\n[${new Date().toISOString()}] Running scheduled scrape...`);
        try {
          await scrapeAllBlogs();
        } catch (error) {
          console.error("Scraping error:", error);
        }
      };

      // Run immediately
      await runJob();

      // Then run on schedule (simplified: every 24 hours at specified hour)
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

      // Keep process alive
      await new Promise(() => {});
      break;
    }

    case "ui":
    case "server": {
      const port = parseInt(Deno.env.get("PORT") || "3000");
      console.log(`\n🌐 Starting web UI on http://localhost:${port}\n`);
      console.log("Use 'deno task dev' for full development server with hot reload\n");

      // Import and start Fresh server
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

    case "list": {
      const blogs = await listBlogs();

      if (blogs.length === 0) {
        console.log("\n📭 No blogs registered. Run 'deno task scraper seed' to add initial blogs.\n");
        break;
      }

      console.log("\n" + "═".repeat(80));
      console.log(" 📡 Registered Blogs");
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

    default:
      console.error(`\n❌ Unknown command: ${command}`);
      console.log(HELP_TEXT);
      Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

