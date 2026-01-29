// =============================================================================
// Blog Scraper MCP - Type Definitions
// =============================================================================

/**
 * Tipos de fonte de blog
 */
export type BlogType =
  | "MCP-First Startups"
  | "Enterprise"
  | "Trendsetter"
  | "Community";

export const BLOG_TYPES: BlogType[] = [
  "MCP-First Startups",
  "Enterprise",
  "Trendsetter",
  "Community",
];

/**
 * Blog (fonte de conteúdo)
 */
export interface Blog {
  id: string;
  name: string;
  url: string;
  feed_url: string | null;
  authority: number; // 0.0 a 1.0
  type: BlogType;
  created_at: string; // ISO 8601
}

/**
 * Input para criar blog
 */
export interface BlogInsert {
  name: string;
  url: string;
  feed_url?: string | null;
  authority: number;
  type: BlogType;
}

/**
 * Input para atualizar blog
 */
export interface BlogUpdate {
  name?: string;
  url?: string;
  feed_url?: string | null;
  authority?: number;
  type?: BlogType;
}

/**
 * Artigo salvo no banco
 */
export interface Article {
  id: string;
  blog_id: string;
  title: string;
  url: string;
  published_at: string; // YYYY-MM-DD
  publication_week: string; // YYYY-wWW
  summary: string;
  key_points: string[];
  post_score: number; // 0.0 a 1.0
  scraped_at: string; // ISO 8601
}

/**
 * Input para criar artigo
 */
export interface ArticleInsert {
  blog_id: string;
  title: string;
  url: string;
  published_at: string;
  publication_week: string;
  summary: string;
  key_points: string[];
  post_score: number;
}

/**
 * Artigo extraído durante scraping (antes da análise LLM)
 */
export interface ScrapedArticle {
  title: string;
  url: string;
  published_at: string | null;
  content: string;
}

/**
 * Artigo após análise do LLM
 */
export interface AnalyzedArticle {
  title: string;
  url: string;
  published_at: string;
  publication_week: string;
  summary: string;
  key_points: string[];
  is_mcp_related: boolean;
  post_score: number;
}

/**
 * Resposta do LLM para extração de artigos
 */
export interface LLMArticleListResponse {
  articles: Array<{
    title: string;
    url: string;
    published_at: string | null;
  }>;
}

/**
 * Resposta do LLM para análise de artigo
 */
export interface LLMArticleAnalysisResponse {
  is_mcp_related: boolean;
  summary: string;
  key_points: string[];
  quality_score: number;
}

/**
 * Estatísticas do dashboard
 */
export interface DashboardStats {
  totalBlogs: number;
  totalArticles: number;
  averageAuthority: number;
  typesCount: number;
}

/**
 * Artigo com informações do blog
 */
export interface ArticleWithBlog extends Article {
  blog: Blog;
}

