// =============================================================================
// Blog Scraper MCP - Scraping System
// =============================================================================

import type { AnalyzedArticle, Blog, ScrapedArticle } from "./types.ts";
import {
  upsertArticle,
  listBlogs,
} from "./db.ts";
import { extractArticlesFromPage, analyzeArticle } from "./llm.ts";
import {
  extractTextWithLinks,
  extractPlainText,
  fetchWithRetry,
  sleep,
  hasMinimumContent,
  isWithinLastWeek,
  formatDate,
  getPublicationWeek,
  calculatePostScore,
  parseDate,
} from "./utils.ts";

// Rate limiting
const DELAY_BETWEEN_BLOGS = 2000; // 2 segundos entre blogs
const DELAY_BETWEEN_ARTICLES = 500; // 500ms entre artigos

/**
 * Executa o scraping de todos os blogs cadastrados
 */
export async function scrapeAllBlogs(): Promise<void> {
  console.log("=".repeat(60));
  console.log("Blog Scraper MCP - Starting scraping process");
  console.log("=".repeat(60));

  const blogs = await listBlogs();
  console.log(`\nFound ${blogs.length} blogs to scrape\n`);

  let totalArticlesSaved = 0;

  for (let i = 0; i < blogs.length; i++) {
    const blog = blogs[i];
    console.log(`\n[${i + 1}/${blogs.length}] Processing: ${blog.name}`);
    console.log(`    URL: ${blog.url}`);
    console.log(`    Authority: ${(blog.authority * 100).toFixed(0)}%`);

    try {
      const savedCount = await scrapeBlog(blog);
      totalArticlesSaved += savedCount;
      console.log(`    ✓ Saved ${savedCount} new articles`);
    } catch (error) {
      console.error(`    ✗ Error: ${error}`);
    }

    // Rate limiting entre blogs
    if (i < blogs.length - 1) {
      await sleep(DELAY_BETWEEN_BLOGS);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Scraping complete! Total articles saved: ${totalArticlesSaved}`);
  console.log("=".repeat(60));
}

/**
 * Faz scraping de um blog específico
 */
export async function scrapeBlog(blog: Blog): Promise<number> {
  // 1. Fetch da página principal
  const response = await fetchWithRetry(blog.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch blog page: ${response.status}`);
  }

  const html = await response.text();

  // 2. Extrai texto com links para o LLM identificar artigos
  const pageContent = extractTextWithLinks(html, blog.url);

  if (!hasMinimumContent(pageContent, 200)) {
    console.log("    ⚠ Page content too short, skipping");
    return 0;
  }

  // 3. Usa LLM para extrair lista de artigos
  const { articles: articleList } = await extractArticlesFromPage(
    pageContent,
    blog.name
  );

  if (articleList.length === 0) {
    console.log("    ⚠ No articles found");
    return 0;
  }

  console.log(`    Found ${articleList.length} article links`);

  // 4. Processa cada artigo
  let savedCount = 0;

  for (const articleInfo of articleList) {
    try {
      const saved = await processArticle(blog, articleInfo);
      if (saved) {
        savedCount++;
        console.log(`    ✓ Saved/Updated: ${articleInfo.title.slice(0, 40)}...`);
      }
    } catch (error) {
      console.error(`    ✗ Error processing "${articleInfo.title}": ${error}`);
    }

    // Rate limiting entre artigos
    await sleep(DELAY_BETWEEN_ARTICLES);
  }

  return savedCount;
}

/**
 * Processa um artigo individual
 */
async function processArticle(
  blog: Blog,
  articleInfo: { title: string; url: string; published_at: string | null }
): Promise<boolean> {
  // 1. Fetch do conteúdo do artigo
  const response = await fetchWithRetry(articleInfo.url);
  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status}`);
  }

  const html = await response.text();
  const content = extractPlainText(html);

  // 2. Valida conteúdo mínimo
  if (!hasMinimumContent(content)) {
    console.log(`    → Skipping (content too short): ${articleInfo.title.slice(0, 40)}...`);
    return false;
  }

  // 3. Analisa com LLM
  const analysis = await analyzeArticle(articleInfo.title, content, blog.authority);

  // 4. Filtra apenas artigos MCP-related
  if (!analysis.is_mcp_related) {
    console.log(`    → Skipping (not MCP-related): ${articleInfo.title.slice(0, 40)}...`);
    return false;
  }

  // 5. Determina data de publicação
  let publishedDate: Date;
  if (articleInfo.published_at) {
    const parsed = parseDate(articleInfo.published_at);
    publishedDate = parsed || new Date();
  } else {
    // Se não tem data, assume hoje
    publishedDate = new Date();
  }

  // 6. Filtra por data (última semana)
  if (!isWithinLastWeek(publishedDate)) {
    console.log(`    → Skipping (older than 1 week): ${articleInfo.title.slice(0, 40)}...`);
    return false;
  }

  // 7. Calcula post_score
  const postScore = calculatePostScore(analysis.quality_score, blog.authority);

  // 8. Salva no banco (upsert para evitar duplicados)
  await upsertArticle({
    blog_id: blog.id,
    title: articleInfo.title,
    url: articleInfo.url,
    published_at: formatDate(publishedDate),
    publication_week: getPublicationWeek(publishedDate),
    summary: analysis.summary,
    key_points: analysis.key_points,
    post_score: postScore,
  });

  return true;
}

/**
 * Gera relatório de uma semana específica
 */
export async function generateWeeklyReport(week?: string): Promise<string> {
  const targetWeek = week || getPublicationWeek(new Date());

  // Import dinâmico para evitar dependência circular
  const { listArticlesByWeekWithBlog } = await import("./db.ts");
  const articles = await listArticlesByWeekWithBlog(targetWeek);

  if (articles.length === 0) {
    return `\n📭 No MCP-related articles found for week ${targetWeek}\n`;
  }

  const lines: string[] = [
    "",
    "═".repeat(70),
    `📡 Blog Scraper MCP - Weekly Report: ${targetWeek}`,
    "═".repeat(70),
    "",
    `Found ${articles.length} MCP-related articles, ranked by quality:`,
    "",
  ];

  articles.forEach((article, index) => {
    const rank = index + 1;
    const scoreBar = "█".repeat(Math.round(article.post_score * 20));
    const emptyBar = "░".repeat(20 - Math.round(article.post_score * 20));

    lines.push(`${rank}. ${article.title}`);
    lines.push(`   📎 ${article.url}`);
    lines.push(`   🏢 ${article.blog.name} (Authority: ${(article.blog.authority * 100).toFixed(0)}%)`);
    lines.push(`   📊 Score: [${scoreBar}${emptyBar}] ${(article.post_score * 100).toFixed(0)}%`);
    lines.push(`   📅 Published: ${article.published_at}`);
    lines.push("");
    lines.push(`   📝 ${article.summary}`);
    lines.push("");
    lines.push("   Key Points:");
    article.key_points.forEach((point) => {
      lines.push(`   • ${point}`);
    });
    lines.push("");
    lines.push("─".repeat(70));
    lines.push("");
  });

  return lines.join("\n");
}

