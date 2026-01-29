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

// =============================================================================
// LinkedIn Source (tabela linkedin_sources - perfis a monitorar)
// =============================================================================

/**
 * Perfil do LinkedIn para monitorar (tabela linkedin_sources)
 */
export interface LinkedInSource {
  id: string;
  name: string;
  profile_url: string;
  authority: number; // 0.0 a 1.0
  type: BlogType; // Usa os mesmos tipos de Blog
  active: boolean;
  created_at: string; // ISO 8601
}

/**
 * Input para criar fonte LinkedIn
 */
export interface LinkedInSourceInsert {
  name: string;
  profile_url: string;
  authority: number;
  type: BlogType;
  active?: boolean;
}

/**
 * Input para atualizar fonte LinkedIn
 */
export interface LinkedInSourceUpdate {
  name?: string;
  profile_url?: string;
  authority?: number;
  type?: BlogType;
  active?: boolean;
}

// =============================================================================
// LinkedIn Content Types (usando tabela linkedin_content_scrape existente)
// =============================================================================

/**
 * Tipos de conteúdo LinkedIn
 */
export type LinkedInContentType = "mcp-startups" | "enterprise" | "trendsetter" | "community";

export const LINKEDIN_CONTENT_TYPES: LinkedInContentType[] = [
  "mcp-startups",
  "enterprise",
  "trendsetter",
  "community",
];

/**
 * Post do LinkedIn salvo no banco (tabela linkedin_content_scrape)
 */
export interface LinkedInContent {
  id: number;
  post_id: string;
  url: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_profile_url: string | null;
  author_profile_image: string | null;
  content: string | null;
  num_likes: number;
  num_comments: number;
  num_reposts: number;
  post_type: string;
  media_url: string | null;
  published_at: string | null;
  scraped_at: string | null;
  post_score: number; // 0-100 (integer)
  type: LinkedInContentType;
  created_at: string;
  updated_at: string;
  week_date: string | null;
}

/**
 * Input para criar conteúdo LinkedIn
 */
export interface LinkedInContentInsert {
  post_id: string;
  url: string | null;
  author_name: string | null;
  author_headline: string | null;
  author_profile_url: string | null;
  author_profile_image: string | null;
  content: string | null;
  num_likes: number;
  num_comments: number;
  num_reposts: number;
  post_type: string;
  media_url: string | null;
  published_at: string | null;
  post_score: number;
  type: LinkedInContentType;
  week_date: string | null;
}

/**
 * Resposta do LLM para análise de post LinkedIn
 */
export interface LLMLinkedInPostAnalysisResponse {
  is_relevant: boolean;
  summary: string;
  key_points: string[];
  quality_score: number; // 0.0 a 1.0
  relevance_reason: string;
}

/**
 * Post bruto da API do LinkedIn (Apify)
 */
export interface LinkedInRawPost {
  type: string;
  id: string;
  linkedinUrl: string;
  content: string;
  author: {
    name: string;
    publicIdentifier: string;
    linkedinUrl: string;
    info?: string;
    avatar?: {
      url: string;
    };
  };
  postedAt: {
    timestamp: number;
    date: string;
  };
  repostedBy?: {
    name: string;
    publicIdentifier: string;
    linkedinUrl: string;
  };
  repostedAt?: {
    timestamp: number;
    date: string;
  };
  engagement: {
    likes: number;
    comments: number;
    shares: number;
  };
  postImages?: Array<{ url: string }>;
  postVideo?: { videoUrl: string; thumbnailUrl: string };
}

// =============================================================================
// Reddit Source (tabela reddit_sources - subreddits a monitorar)
// =============================================================================

/**
 * Subreddit para monitorar (tabela reddit_sources)
 */
export interface RedditSource {
  id: string;
  name: string; // Nome do subreddit (sem r/)
  subreddit: string; // Nome exato do subreddit
  authority: number; // 0.0 a 1.0
  type: BlogType; // Usa os mesmos tipos de Blog
  active: boolean;
  created_at: string; // ISO 8601
}

/**
 * Input para criar fonte Reddit
 */
export interface RedditSourceInsert {
  name: string;
  subreddit: string;
  authority: number;
  type: BlogType;
  active?: boolean;
}

/**
 * Input para atualizar fonte Reddit
 */
export interface RedditSourceUpdate {
  name?: string;
  subreddit?: string;
  authority?: number;
  type?: BlogType;
  active?: boolean;
}

// =============================================================================
// Reddit Content Types (usando tabela reddit_content_scrape existente)
// =============================================================================

/**
 * Comunidades do Reddit monitoradas
 */
export type RedditCommunity = "LLMDevs" | "AI_Agents" | "mcp";

export const REDDIT_COMMUNITIES: RedditCommunity[] = [
  "LLMDevs",
  "AI_Agents",
  "mcp",
];

/**
 * Tipos de conteúdo Reddit (mesmo padrão do Blog)
 */
export type RedditContentType = "Trendsetters" | "Enterprise" | "MCP-First Startups" | "Community";

export const REDDIT_CONTENT_TYPES: RedditContentType[] = [
  "Trendsetters",
  "Enterprise",
  "MCP-First Startups",
  "Community",
];

/**
 * Post do Reddit salvo no banco (tabela reddit_content_scrape)
 */
export interface RedditContent {
  id: number;
  title: string;
  author: string;
  subreddit: string;
  selftext: string | null;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_at: number; // Unix timestamp
  scraped_at: string;
  updated_at: string;
  type: RedditContentType;
  authority: number; // 0.0 a 1.0
  post_score: number; // 0.0 a 1.0 (qualidade calculada pelo LLM)
  week_date: string | null;
}

/**
 * Input para criar conteúdo do Reddit
 */
export interface RedditContentInsert {
  title: string;
  author: string;
  subreddit: string;
  selftext: string | null;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_at: number; // Unix timestamp
  type: RedditContentType;
  authority: number;
  post_score: number;
  week_date: string | null;
}

/**
 * Post bruto da API do Reddit
 */
export interface RedditRawPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  selftext: string;
  url: string;
  permalink: string;
  score: number;
  num_comments: number;
  created_utc: number;
  is_self: boolean;
  flair: string | null;
  nsfw: boolean;
}

/**
 * Resposta do LLM para análise de post Reddit
 */
export interface LLMRedditPostAnalysisResponse {
  is_relevant: boolean;
  summary: string;
  key_points: string[];
  quality_score: number; // 0.0 a 1.0
  relevance_reason: string;
}

