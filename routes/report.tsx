// =============================================================================
// Página de Relatório Semanal
// =============================================================================

import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { listArticlesByWeekWithBlog } from "../lib/db.ts";
import { getCurrentWeek } from "../lib/utils.ts";
import type { ArticleWithBlog, BlogType } from "../lib/types.ts";

interface PageData {
  articles: ArticleWithBlog[];
  week: string;
  currentWeek: string;
}

export const handler: Handlers<PageData> = {
  async GET(req, ctx) {
    const url = new URL(req.url);
    const week = url.searchParams.get("week") || getCurrentWeek();
    const currentWeek = getCurrentWeek();

    const articles = await listArticlesByWeekWithBlog(week);

    return ctx.render({ articles, week, currentWeek });
  },
};

const TYPE_COLORS: Record<BlogType, string> = {
  "MCP-First Startups": "#00d4ff",
  "Enterprise": "#a855f7",
  "Trendsetter": "#ec4899",
  "Community": "#22c55e",
};

export default function ReportPage({ data }: PageProps<PageData>) {
  const { articles, week, currentWeek } = data;

  // Calcula semana anterior e próxima
  const [yearStr, weekStr] = week.split("-w");
  const year = parseInt(yearStr);
  const weekNum = parseInt(weekStr);

  const prevWeek =
    weekNum <= 1
      ? `${year - 1}-w52`
      : `${year}-w${(weekNum - 1).toString().padStart(2, "0")}`;

  const nextWeek =
    weekNum >= 52
      ? `${year + 1}-w01`
      : `${year}-w${(weekNum + 1).toString().padStart(2, "0")}`;

  return (
    <>
      <Head>
        <title>Relatório Semanal {week} - Blog Scraper MCP</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
        <style>{`
          :root {
            --bg-primary: #0a0a0f;
            --bg-secondary: #12121a;
            --bg-card: #1a1a24;
            --bg-card-hover: #22222e;
            --border-color: #2a2a3a;
            --text-primary: #ffffff;
            --text-secondary: #a0a0b0;
            --text-muted: #606070;
            --accent-cyan: #00d4ff;
            --accent-purple: #a855f7;
            --accent-pink: #ec4899;
            --accent-green: #22c55e;
          }

          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }

          body {
            font-family: 'Outfit', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
          }

          .mono {
            font-family: 'JetBrains Mono', monospace;
          }

          .gradient-text {
            background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          }

          .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 0 24px;
          }

          .header {
            padding: 32px 0;
            border-bottom: 1px solid var(--border-color);
            background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
          }

          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 20px;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 16px;
            text-decoration: none;
            color: inherit;
          }

          .logo-icon {
            font-size: 32px;
            filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
          }

          .logo-text h1 {
            font-size: 24px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }

          .week-nav {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .nav-btn {
            padding: 8px 16px;
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            color: var(--text-primary);
            text-decoration: none;
            font-size: 14px;
            transition: all 0.2s;
          }

          .nav-btn:hover {
            border-color: var(--accent-cyan);
          }

          .nav-btn.disabled {
            opacity: 0.5;
            pointer-events: none;
          }

          .week-badge {
            padding: 8px 16px;
            background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
            border-radius: 8px;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
          }

          .main {
            padding: 40px 0 80px;
          }

          .report-header {
            text-align: center;
            margin-bottom: 40px;
          }

          .report-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .report-subtitle {
            color: var(--text-secondary);
            font-size: 16px;
          }

          .articles-list {
            display: flex;
            flex-direction: column;
            gap: 24px;
          }

          .article-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            transition: all 0.2s;
          }

          .article-card:hover {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.1);
          }

          .article-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 16px;
            margin-bottom: 16px;
          }

          .article-rank {
            font-size: 32px;
            font-weight: 700;
            color: var(--accent-cyan);
            font-family: 'JetBrains Mono', monospace;
            min-width: 48px;
          }

          .article-title-section {
            flex: 1;
          }

          .article-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 8px;
            line-height: 1.4;
          }

          .article-title a {
            color: inherit;
            text-decoration: none;
          }

          .article-title a:hover {
            color: var(--accent-cyan);
          }

          .article-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            flex-wrap: wrap;
          }

          .meta-item {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 13px;
            color: var(--text-secondary);
          }

          .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            border: 1px solid;
          }

          .score-container {
            text-align: right;
          }

          .score-bar {
            width: 120px;
            height: 8px;
            background: var(--bg-secondary);
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 4px;
          }

          .score-fill {
            height: 100%;
            background: linear-gradient(90deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
            border-radius: 4px;
          }

          .score-value {
            font-size: 14px;
            font-weight: 600;
            font-family: 'JetBrains Mono', monospace;
            color: var(--accent-cyan);
          }

          .article-summary {
            color: var(--text-secondary);
            font-size: 15px;
            line-height: 1.6;
            margin-bottom: 16px;
            padding-left: 64px;
          }

          .key-points {
            padding-left: 64px;
          }

          .key-points-title {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }

          .key-points-list {
            list-style: none;
          }

          .key-points-list li {
            position: relative;
            padding-left: 20px;
            margin-bottom: 6px;
            font-size: 14px;
            color: var(--text-secondary);
          }

          .key-points-list li::before {
            content: '→';
            position: absolute;
            left: 0;
            color: var(--accent-purple);
          }

          .empty-state {
            text-align: center;
            padding: 80px 24px;
            color: var(--text-muted);
          }

          .empty-state-icon {
            font-size: 64px;
            margin-bottom: 20px;
          }

          .empty-state-title {
            font-size: 20px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 8px;
          }

          .footer {
            border-top: 1px solid var(--border-color);
            padding: 24px 0;
            text-align: center;
            color: var(--text-muted);
            font-size: 13px;
          }

          .footer a {
            color: var(--accent-cyan);
            text-decoration: none;
          }

          @media (max-width: 600px) {
            .article-header {
              flex-direction: column;
            }

            .article-summary,
            .key-points {
              padding-left: 0;
            }

            .score-container {
              text-align: left;
            }
          }
        `}</style>
      </Head>

      <div class="app">
        <header class="header">
          <div class="container">
            <div class="header-content">
              <a href="/" class="logo">
                <span class="logo-icon">📡</span>
                <div class="logo-text">
                  <h1 class="gradient-text">Blog Scraper MCP</h1>
                </div>
              </a>

              <div class="week-nav">
                <a href={`/report?week=${prevWeek}`} class="nav-btn">
                  ← Anterior
                </a>
                <span class="week-badge">{week}</span>
                <a
                  href={`/report?week=${nextWeek}`}
                  class={`nav-btn ${nextWeek > currentWeek ? "disabled" : ""}`}
                >
                  Próxima →
                </a>
              </div>
            </div>
          </div>
        </header>

        <main class="main">
          <div class="container">
            <div class="report-header">
              <h2 class="report-title">📊 Relatório Semanal</h2>
              <p class="report-subtitle">
                {articles.length > 0
                  ? `${articles.length} artigos sobre MCP encontrados`
                  : "Nenhum artigo encontrado nesta semana"}
              </p>
            </div>

            {articles.length === 0 ? (
              <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p class="empty-state-title">Nenhum artigo nesta semana</p>
                <p>
                  Não foram encontrados artigos relacionados a MCP para a semana{" "}
                  {week}
                </p>
              </div>
            ) : (
              <div class="articles-list">
                {articles.map((article, index) => (
                  <article class="article-card" key={article.id}>
                    <div class="article-header">
                      <span class="article-rank">#{index + 1}</span>

                      <div class="article-title-section">
                        <h3 class="article-title">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {article.title}
                          </a>
                        </h3>
                        <div class="article-meta">
                          <span class="meta-item">
                            🏢 {article.blog.name}
                          </span>
                          <span class="meta-item">
                            📅 {article.published_at}
                          </span>
                          <span
                            class="badge"
                            style={{
                              color: TYPE_COLORS[article.blog.type],
                              borderColor: TYPE_COLORS[article.blog.type],
                              backgroundColor: `${TYPE_COLORS[article.blog.type]}15`,
                            }}
                          >
                            {article.blog.type}
                          </span>
                        </div>
                      </div>

                      <div class="score-container">
                        <div class="score-bar">
                          <div
                            class="score-fill"
                            style={{ width: `${article.post_score * 100}%` }}
                          />
                        </div>
                        <span class="score-value">
                          {(article.post_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    <p class="article-summary">{article.summary}</p>

                    {article.key_points.length > 0 && (
                      <div class="key-points">
                        <h4 class="key-points-title">Pontos-chave</h4>
                        <ul class="key-points-list">
                          {article.key_points.map((point, i) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>

        <footer class="footer">
          <div class="container">
            <p>
              <a href="/">← Voltar ao Dashboard</a> •{" "}
              Blog Scraper MCP — Feito com 💜 para a comunidade MCP
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

