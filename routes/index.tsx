// =============================================================================
// Página Principal - Blog Scraper MCP Dashboard
// =============================================================================

import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
import { listBlogs, getDashboardStats, countArticlesByBlog } from "../lib/db.ts";
import type { Blog, DashboardStats } from "../lib/types.ts";
import BlogManager from "../islands/BlogManager.tsx";

interface PageData {
  blogs: Array<Blog & { articles_count: number }>;
  stats: DashboardStats;
}

export const handler: Handlers<PageData> = {
  async GET(_req, ctx) {
    const blogs = await listBlogs();
    const stats = await getDashboardStats();

    // Adiciona contagem de artigos
    const blogsWithCount = await Promise.all(
      blogs.map(async (blog) => ({
        ...blog,
        articles_count: await countArticlesByBlog(blog.id),
      }))
    );

    return ctx.render({ blogs: blogsWithCount, stats });
  },
};

export default function HomePage({ data }: PageProps<PageData>) {
  const { blogs, stats } = data;

  return (
    <>
      <Head>
        <title>Blog Scraper MCP - Dashboard</title>
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
            --accent-yellow: #eab308;
            --accent-orange: #f97316;
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
            max-width: 1400px;
            margin: 0 auto;
            padding: 0 24px;
          }

          /* Header */
          .header {
            padding: 32px 0;
            border-bottom: 1px solid var(--border-color);
            background: linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-primary) 100%);
          }

          .header-content {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }

          .logo {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .logo-icon {
            font-size: 40px;
            filter: drop-shadow(0 0 20px rgba(0, 212, 255, 0.5));
          }

          .logo-text h1 {
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }

          .logo-text p {
            font-size: 14px;
            color: var(--text-secondary);
            margin-top: 4px;
          }

          /* Stats Grid */
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin: 40px 0;
          }

          @media (max-width: 900px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }

          @media (max-width: 500px) {
            .stats-grid {
              grid-template-columns: 1fr;
            }
          }

          .stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 24px;
            transition: all 0.2s;
          }

          .stat-card:hover {
            border-color: var(--accent-cyan);
            box-shadow: 0 0 30px rgba(0, 212, 255, 0.1);
          }

          .stat-label {
            font-size: 13px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }

          .stat-value {
            font-size: 36px;
            font-weight: 700;
          }

          .stat-value.cyan { color: var(--accent-cyan); }
          .stat-value.purple { color: var(--accent-purple); }
          .stat-value.pink { color: var(--accent-pink); }
          .stat-value.green { color: var(--accent-green); }

          /* Main Content */
          .main {
            padding: 40px 0 80px;
          }

          .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 600;
          }

          /* Footer */
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

          .footer a:hover {
            text-decoration: underline;
          }
        `}</style>
      </Head>

      <div class="app">
        {/* Header */}
        <header class="header">
          <div class="container">
            <div class="header-content">
              <div class="logo">
                <span class="logo-icon">📡</span>
                <div class="logo-text">
                  <h1 class="gradient-text">Blog Scraper MCP</h1>
                  <p>Monitore artigos sobre MCP automaticamente</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Stats */}
        <div class="container">
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Blogs Monitorados</div>
              <div class="stat-value cyan mono">{stats.totalBlogs}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Artigos Coletados</div>
              <div class="stat-value purple mono">{stats.totalArticles}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Authority Média</div>
              <div class="stat-value pink mono">{(stats.averageAuthority * 100).toFixed(0)}%</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Tipos de Fonte</div>
              <div class="stat-value green mono">{stats.typesCount}</div>
            </div>
          </div>
        </div>

        {/* Main Content - Blog Manager Island */}
        <main class="main">
          <div class="container">
            <BlogManager initialBlogs={blogs} />
          </div>
        </main>

        {/* Footer */}
        <footer class="footer">
          <div class="container">
            <p>
              Blog Scraper MCP — Feito com 💜 para a comunidade{" "}
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener">
                MCP
              </a>
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

