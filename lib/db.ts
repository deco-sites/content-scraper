// =============================================================================
// Blog Scraper MCP - Database Layer (deco.cms MCP)
// =============================================================================

import type {
  Article,
  ArticleInsert,
  ArticleWithBlog,
  Blog,
  BlogInsert,
  BlogUpdate,
  DashboardStats,
  LinkedInContent,
  LinkedInContentInsert,
  LinkedInContentType,
  LinkedInSource,
  LinkedInSourceInsert,
  LinkedInSourceUpdate,
  RedditContent,
  RedditContentInsert,
  RedditContentType,
  RedditSource,
  RedditSourceInsert,
  RedditSourceUpdate,
} from "./types.ts";
import { generateId } from "./utils.ts";

// =============================================================================
// Database Client via deco.cms MCP
// =============================================================================

const DEFAULT_API_URL =
  "https://api.decocms.com/deco-team/deco-news/mcp/tool/DATABASES_RUN_SQL";

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

// deno-lint-ignore no-explicit-any
interface MCPResponse<T = any> {
  jsonrpc: "2.0";
  id: string | number;
  result?: {
    content?: Array<{
      type: string;
      text?: string;
      data?: T;
    }>;
    structuredContent?: {
      result?: Array<{
        results?: T[];
      }>;
    };
    isError?: boolean;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface DatabaseClientOptions {
  apiUrl?: string;
  token?: string;
}

interface QueryResult<T = Record<string, unknown>> {
  success: boolean;
  data?: T[];
  error?: {
    code: number;
    message: string;
  };
  rowCount?: number;
}

class DatabaseClient {
  private apiUrl: string;
  private token: string;
  private messageId = 0;

  constructor(options: DatabaseClientOptions = {}) {
    this.apiUrl = options.apiUrl ?? DEFAULT_API_URL;
    this.token = options.token ?? Deno.env.get("ADMIN_DB_TOKEN") ?? "";

    if (!this.token) {
      console.warn(
        "⚠️ [DatabaseClient] ADMIN_DB_TOKEN não encontrado. Configure a variável de ambiente."
      );
    }
  }

  private generateId(): number {
    return ++this.messageId;
  }

  private parseSSEResponse(text: string): MCPResponse {
    const lines = text.split("\n");
    let data = "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        data += line.slice(6);
      } else if (line.startsWith("data:")) {
        data += line.slice(5);
      }
    }

    if (!data) {
      return JSON.parse(text);
    }

    return JSON.parse(data);
  }

  async query<T = Record<string, unknown>>(sql: string): Promise<QueryResult<T>> {
    const requestBody: MCPRequest = {
      method: "tools/call",
      params: {
        name: "DATABASES_RUN_SQL",
        arguments: { sql },
      },
      jsonrpc: "2.0",
      id: this.generateId(),
    };

    try {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Accept: "application/json,text/event-stream",
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: response.status,
            message: `HTTP ${response.status}: ${response.statusText}`,
          },
        };
      }

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      let result: MCPResponse<T[]>;

      if (
        contentType.includes("text/event-stream") ||
        text.startsWith("event:") ||
        text.startsWith("data:")
      ) {
        result = this.parseSSEResponse(text) as MCPResponse<T[]>;
      } else {
        result = JSON.parse(text) as MCPResponse<T[]>;
      }

      if (result.error) {
        return {
          success: false,
          error: {
            code: result.error.code,
            message: result.error.message,
          },
        };
      }

      // Formato novo (structuredContent)
      const structuredData = result.result?.structuredContent?.result?.[0]?.results;
      if (structuredData) {
        return {
          success: true,
          data: structuredData as T[],
          rowCount: structuredData.length,
        };
      }

      // Formato antigo (content)
      const content = result.result?.content?.[0];
      if (content?.text) {
        try {
          const data = JSON.parse(content.text);

          if (
            data &&
            typeof data === "object" &&
            "message" in data &&
            "name" in data &&
            data.name === "Error"
          ) {
            return {
              success: false,
              error: {
                code: -1,
                message: data.message,
              },
            };
          }

          if (result.result?.isError) {
            return {
              success: false,
              error: {
                code: -1,
                message: typeof data === "string" ? data : JSON.stringify(data),
              },
            };
          }

          return {
            success: true,
            data: Array.isArray(data) ? data : [data],
            rowCount: Array.isArray(data) ? data.length : 1,
          };
        } catch {
          return {
            success: true,
            data: [{ result: content.text }] as unknown as T[],
          };
        }
      }

      return {
        success: true,
        data: [],
        rowCount: 0,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro desconhecido";
      return {
        success: false,
        error: {
          code: -1,
          message,
        },
      };
    }
  }
}

// Singleton do cliente
let _db: DatabaseClient | null = null;

function getDb(): DatabaseClient {
  if (!_db) {
    _db = new DatabaseClient();
  }
  return _db;
}

// =============================================================================
// Helpers SQL
// =============================================================================

function escapeString(value: string): string {
  return value.replace(/'/g, "''");
}

function toSqlValue(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return `'${escapeString(value)}'`;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `'${escapeString(JSON.stringify(value))}'`;
  if (typeof value === "object") return `'${escapeString(JSON.stringify(value))}'`;
  return String(value);
}

// =============================================================================
// Blog Operations (Tabela: blog_sources)
// =============================================================================

/**
 * Lista todos os blogs
 */
export async function listBlogs(): Promise<Blog[]> {
  const db = getDb();
  const result = await db.query<Blog>(
    `SELECT id, name, url, feed_url, authority, type, created_at 
     FROM blog_sources 
     ORDER BY name ASC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listBlogs] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Obtém um blog por ID
 */
export async function getBlog(id: string): Promise<Blog | null> {
  const db = getDb();
  const result = await db.query<Blog>(
    `SELECT id, name, url, feed_url, authority, type, created_at 
     FROM blog_sources 
     WHERE id = '${escapeString(id)}' 
     LIMIT 1`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Cria um novo blog
 */
export async function createBlog(input: BlogInsert): Promise<Blog> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO blog_sources (id, name, url, feed_url, authority, type, created_at)
    VALUES (
      ${toSqlValue(id)},
      ${toSqlValue(input.name)},
      ${toSqlValue(input.url)},
      ${toSqlValue(input.feed_url ?? null)},
      ${toSqlValue(input.authority)},
      ${toSqlValue(input.type)},
      ${toSqlValue(now)}
    )
    RETURNING *
  `;

  const result = await db.query<Blog>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar blog: ${result.error?.message}`);
  }

  return result.data[0];
}

/**
 * Atualiza um blog existente
 */
export async function updateBlog(id: string, input: BlogUpdate): Promise<Blog | null> {
  const existing = await getBlog(id);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const updates: string[] = [];

  if (input.name !== undefined) updates.push(`name = ${toSqlValue(input.name)}`);
  if (input.url !== undefined) updates.push(`url = ${toSqlValue(input.url)}`);
  if (input.feed_url !== undefined) updates.push(`feed_url = ${toSqlValue(input.feed_url)}`);
  if (input.authority !== undefined) updates.push(`authority = ${toSqlValue(input.authority)}`);
  if (input.type !== undefined) updates.push(`type = ${toSqlValue(input.type)}`);

  if (updates.length === 0) {
    return existing;
  }

  const sql = `
    UPDATE blog_sources 
    SET ${updates.join(", ")}
    WHERE id = '${escapeString(id)}'
    RETURNING *
  `;

  const result = await db.query<Blog>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Remove um blog e seus artigos associados
 */
export async function deleteBlog(id: string): Promise<boolean> {
  const existing = await getBlog(id);
  if (!existing) {
    return false;
  }

  const db = getDb();

  // Remove todos os conteúdos do blog primeiro
  await db.query(`DELETE FROM contents WHERE blog_id = '${escapeString(id)}'`);

  // Remove o blog
  const result = await db.query(`DELETE FROM blog_sources WHERE id = '${escapeString(id)}'`);

  return result.success;
}

// =============================================================================
// Article Operations (Tabela: contents)
// =============================================================================

/**
 * Lista artigos com paginação
 */
export async function listArticles(limit = 50): Promise<Article[]> {
  const db = getDb();
  const result = await db.query<Article>(
    `SELECT id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
     FROM contents 
     ORDER BY created_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listArticles] Erro:", result.error?.message);
    return [];
  }

  // Parse key_points de JSON string para array
  return result.data.map((article) => ({
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  }));
}

/**
 * Lista artigos por semana de publicação
 */
export async function listArticlesByWeek(week: string): Promise<Article[]> {
  const db = getDb();
  const result = await db.query<Article>(
    `SELECT id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
     FROM contents 
     WHERE publication_week = '${escapeString(week)}'
     ORDER BY post_score DESC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listArticlesByWeek] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((article) => ({
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  }));
}

/**
 * Lista artigos de um blog específico
 */
export async function listArticlesByBlog(blogId: string): Promise<Article[]> {
  const db = getDb();
  const result = await db.query<Article>(
    `SELECT id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
     FROM contents 
     WHERE blog_id = '${escapeString(blogId)}'
     ORDER BY published_at DESC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listArticlesByBlog] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((article) => ({
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  }));
}

/**
 * Obtém um artigo por ID
 */
export async function getArticle(id: string): Promise<Article | null> {
  const db = getDb();
  const result = await db.query<Article>(
    `SELECT id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
     FROM contents 
     WHERE id = ${escapeString(id)} 
     LIMIT 1`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  const article = result.data[0];
  return {
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  };
}

/**
 * Verifica se um artigo já existe pela URL
 */
export async function articleExistsByUrl(url: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM contents WHERE article_url = '${escapeString(url)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return false;
  }

  return Number(result.data[0].count) > 0;
}

/**
 * Cria um novo artigo
 */
export async function createArticle(input: ArticleInsert): Promise<Article> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO contents (blog_id, article_title, article_url, published_at, publication_week, summary, key_points, post_score, created_at)
    VALUES (
      ${toSqlValue(input.blog_id)},
      ${toSqlValue(input.title)},
      ${toSqlValue(input.url)},
      ${toSqlValue(input.published_at)},
      ${toSqlValue(input.publication_week)},
      ${toSqlValue(input.summary)},
      ${toSqlValue(input.key_points)},
      ${toSqlValue(input.post_score)},
      ${toSqlValue(now)}
    )
    RETURNING id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
  `;

  const result = await db.query<Article>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar artigo: ${result.error?.message}`);
  }

  const article = result.data[0];
  return {
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  };
}

/**
 * Cria ou atualiza um artigo (UPSERT por URL)
 */
export async function upsertArticle(input: ArticleInsert): Promise<Article> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO contents (blog_id, article_title, article_url, published_at, publication_week, summary, key_points, post_score, created_at)
    VALUES (
      ${toSqlValue(input.blog_id)},
      ${toSqlValue(input.title)},
      ${toSqlValue(input.url)},
      ${toSqlValue(input.published_at)},
      ${toSqlValue(input.publication_week)},
      ${toSqlValue(input.summary)},
      ${toSqlValue(input.key_points)},
      ${toSqlValue(input.post_score)},
      ${toSqlValue(now)}
    )
    ON CONFLICT (article_url) DO UPDATE SET
      article_title = EXCLUDED.article_title,
      summary = EXCLUDED.summary,
      key_points = EXCLUDED.key_points,
      post_score = EXCLUDED.post_score,
      updated_at = datetime('now')
    RETURNING id, blog_id, article_title as title, article_url as url, published_at, publication_week, summary, key_points, post_score, created_at as scraped_at
  `;

  const result = await db.query<Article>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao upsert artigo: ${result.error?.message}`);
  }

  const article = result.data[0];
  return {
    ...article,
    key_points:
      typeof article.key_points === "string"
        ? JSON.parse(article.key_points)
        : article.key_points,
  };
}

/**
 * Conta artigos por blog
 */
export async function countArticlesByBlog(blogId: string): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM contents WHERE blog_id = '${escapeString(blogId)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta total de artigos
 */
export async function countArticles(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM contents`);

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

// =============================================================================
// Stats & Utilities
// =============================================================================

/**
 * Obtém estatísticas do dashboard
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getDb();

  // Busca stats em uma única query
  const statsResult = await db.query<{
    total_blogs: number;
    total_articles: number;
    avg_authority: number;
    types_count: number;
  }>(`
    SELECT 
      (SELECT COUNT(*) FROM blog_sources) as total_blogs,
      (SELECT COUNT(*) FROM contents) as total_articles,
      (SELECT COALESCE(AVG(authority), 0) FROM blog_sources) as avg_authority,
      (SELECT COUNT(DISTINCT type) FROM blog_sources) as types_count
  `);

  if (!statsResult.success || !statsResult.data || statsResult.data.length === 0) {
    return {
      totalBlogs: 0,
      totalArticles: 0,
      averageAuthority: 0,
      typesCount: 0,
    };
  }

  const stats = statsResult.data[0];
  return {
    totalBlogs: Number(stats.total_blogs),
    totalArticles: Number(stats.total_articles),
    averageAuthority: Number(stats.avg_authority),
    typesCount: Number(stats.types_count),
  };
}

/**
 * Lista artigos com informações do blog
 */
export async function listArticlesWithBlog(limit = 50): Promise<ArticleWithBlog[]> {
  const db = getDb();
  const result = await db.query<Article & { blog_name: string; blog_url: string; blog_feed_url: string | null; blog_authority: number; blog_type: string; blog_created_at: string }>(
    `SELECT 
      a.id, a.blog_id, a.article_title as title, a.article_url as url, a.published_at, a.publication_week, a.summary, a.key_points, a.post_score, a.created_at as scraped_at,
      b.name as blog_name, b.url as blog_url, b.feed_url as blog_feed_url, b.authority as blog_authority, b.type as blog_type, b.created_at as blog_created_at
     FROM contents a
     JOIN blog_sources b ON a.blog_id = b.id
     ORDER BY a.created_at DESC, a.post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listArticlesWithBlog] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((row) => ({
    id: row.id,
    blog_id: row.blog_id,
    title: row.title,
    url: row.url,
    published_at: row.published_at,
    publication_week: row.publication_week,
    summary: row.summary,
    key_points: typeof row.key_points === "string" ? JSON.parse(row.key_points) : row.key_points,
    post_score: row.post_score,
    scraped_at: row.scraped_at,
    blog: {
      id: row.blog_id,
      name: row.blog_name,
      url: row.blog_url,
      feed_url: row.blog_feed_url,
      authority: row.blog_authority,
      type: row.blog_type as Blog["type"],
      created_at: row.blog_created_at,
    },
  }));
}

/**
 * Lista artigos por semana com informações do blog
 */
export async function listArticlesByWeekWithBlog(week: string): Promise<ArticleWithBlog[]> {
  const db = getDb();
  const result = await db.query<Article & { blog_name: string; blog_url: string; blog_feed_url: string | null; blog_authority: number; blog_type: string; blog_created_at: string }>(
    `SELECT 
      a.id, a.blog_id, a.article_title as title, a.article_url as url, a.published_at, a.publication_week, a.summary, a.key_points, a.post_score, a.created_at as scraped_at,
      b.name as blog_name, b.url as blog_url, b.feed_url as blog_feed_url, b.authority as blog_authority, b.type as blog_type, b.created_at as blog_created_at
     FROM contents a
     JOIN blog_sources b ON a.blog_id = b.id
     WHERE a.publication_week = '${escapeString(week)}'
     ORDER BY a.post_score DESC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listArticlesByWeekWithBlog] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((row) => ({
    id: row.id,
    blog_id: row.blog_id,
    title: row.title,
    url: row.url,
    published_at: row.published_at,
    publication_week: row.publication_week,
    summary: row.summary,
    key_points: typeof row.key_points === "string" ? JSON.parse(row.key_points) : row.key_points,
    post_score: row.post_score,
    scraped_at: row.scraped_at,
    blog: {
      id: row.blog_id,
      name: row.blog_name,
      url: row.blog_url,
      feed_url: row.blog_feed_url,
      authority: row.blog_authority,
      type: row.blog_type as Blog["type"],
      created_at: row.blog_created_at,
    },
  }));
}

/**
 * @deprecated Use as funções exportadas diretamente
 */
export function getKv(): Promise<never> {
  throw new Error("getKv() foi removido. Use as funções do banco SQL diretamente.");
}

/**
 * @deprecated Não é mais necessário com o cliente SQL
 */
export function closeKv(): void {
  // No-op para compatibilidade
}

// =============================================================================
// LinkedIn Source Operations (Tabela: linkedin_sources)
// =============================================================================

/**
 * Lista todas as fontes LinkedIn ativas
 */
export async function listLinkedInSources(activeOnly = true): Promise<LinkedInSource[]> {
  const db = getDb();
  const whereClause = activeOnly ? "WHERE active = 1" : "";
  const result = await db.query<LinkedInSource>(
    `SELECT id, name, profile_url, authority, type, active, created_at 
     FROM linkedin_sources 
     ${whereClause}
     ORDER BY authority DESC, name ASC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listLinkedInSources] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((source) => ({
    ...source,
    active: Boolean(source.active),
  }));
}

/**
 * Obtém uma fonte LinkedIn por ID
 */
export async function getLinkedInSource(id: string): Promise<LinkedInSource | null> {
  const db = getDb();
  const result = await db.query<LinkedInSource>(
    `SELECT id, name, profile_url, authority, type, active, created_at 
     FROM linkedin_sources 
     WHERE id = '${escapeString(id)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  const source = result.data[0];
  return {
    ...source,
    active: Boolean(source.active),
  };
}

/**
 * Cria uma nova fonte LinkedIn
 */
export async function createLinkedInSource(input: LinkedInSourceInsert): Promise<LinkedInSource> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO linkedin_sources (id, name, profile_url, authority, type, active, created_at)
    VALUES (
      ${toSqlValue(id)},
      ${toSqlValue(input.name)},
      ${toSqlValue(input.profile_url)},
      ${toSqlValue(input.authority)},
      ${toSqlValue(input.type)},
      ${toSqlValue(input.active !== false ? 1 : 0)},
      ${toSqlValue(now)}
    )
    RETURNING *
  `;

  const result = await db.query<LinkedInSource>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar fonte LinkedIn: ${result.error?.message}`);
  }

  return {
    ...result.data[0],
    active: Boolean(result.data[0].active),
  };
}

/**
 * Atualiza uma fonte LinkedIn existente
 */
export async function updateLinkedInSource(id: string, input: LinkedInSourceUpdate): Promise<LinkedInSource | null> {
  const existing = await getLinkedInSource(id);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const updates: string[] = [];

  if (input.name !== undefined) updates.push(`name = ${toSqlValue(input.name)}`);
  if (input.profile_url !== undefined) updates.push(`profile_url = ${toSqlValue(input.profile_url)}`);
  if (input.authority !== undefined) updates.push(`authority = ${toSqlValue(input.authority)}`);
  if (input.type !== undefined) updates.push(`type = ${toSqlValue(input.type)}`);
  if (input.active !== undefined) updates.push(`active = ${toSqlValue(input.active ? 1 : 0)}`);

  if (updates.length === 0) {
    return existing;
  }

  const sql = `
    UPDATE linkedin_sources 
    SET ${updates.join(", ")}
    WHERE id = '${escapeString(id)}'
    RETURNING *
  `;

  const result = await db.query<LinkedInSource>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return {
    ...result.data[0],
    active: Boolean(result.data[0].active),
  };
}

/**
 * Remove uma fonte LinkedIn
 */
export async function deleteLinkedInSource(id: string): Promise<boolean> {
  const existing = await getLinkedInSource(id);
  if (!existing) {
    return false;
  }

  const db = getDb();
  const result = await db.query(`DELETE FROM linkedin_sources WHERE id = '${escapeString(id)}'`);
  return result.success;
}

/**
 * Conta fontes LinkedIn
 */
export async function countLinkedInSources(activeOnly = true): Promise<number> {
  const db = getDb();
  const whereClause = activeOnly ? "WHERE active = 1" : "";
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_sources ${whereClause}`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

// =============================================================================
// Reddit Source Operations (Tabela: reddit_sources)
// =============================================================================

/**
 * Lista todas as fontes Reddit ativas
 */
export async function listRedditSources(activeOnly = true): Promise<RedditSource[]> {
  const db = getDb();
  const whereClause = activeOnly ? "WHERE active = 1" : "";
  const result = await db.query<RedditSource>(
    `SELECT id, name, subreddit, authority, type, active, created_at 
     FROM reddit_sources 
     ${whereClause}
     ORDER BY authority DESC, name ASC`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listRedditSources] Erro:", result.error?.message);
    return [];
  }

  return result.data.map((source) => ({
    ...source,
    active: Boolean(source.active),
  }));
}

/**
 * Obtém uma fonte Reddit por ID
 */
export async function getRedditSource(id: string): Promise<RedditSource | null> {
  const db = getDb();
  const result = await db.query<RedditSource>(
    `SELECT id, name, subreddit, authority, type, active, created_at 
     FROM reddit_sources 
     WHERE id = '${escapeString(id)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  const source = result.data[0];
  return {
    ...source,
    active: Boolean(source.active),
  };
}

/**
 * Cria uma nova fonte Reddit
 */
export async function createRedditSource(input: RedditSourceInsert): Promise<RedditSource> {
  const db = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO reddit_sources (id, name, subreddit, authority, type, active, created_at)
    VALUES (
      ${toSqlValue(id)},
      ${toSqlValue(input.name)},
      ${toSqlValue(input.subreddit)},
      ${toSqlValue(input.authority)},
      ${toSqlValue(input.type)},
      ${toSqlValue(input.active !== false ? 1 : 0)},
      ${toSqlValue(now)}
    )
    RETURNING *
  `;

  const result = await db.query<RedditSource>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar fonte Reddit: ${result.error?.message}`);
  }

  return {
    ...result.data[0],
    active: Boolean(result.data[0].active),
  };
}

/**
 * Atualiza uma fonte Reddit existente
 */
export async function updateRedditSource(id: string, input: RedditSourceUpdate): Promise<RedditSource | null> {
  const existing = await getRedditSource(id);
  if (!existing) {
    return null;
  }

  const db = getDb();
  const updates: string[] = [];

  if (input.name !== undefined) updates.push(`name = ${toSqlValue(input.name)}`);
  if (input.subreddit !== undefined) updates.push(`subreddit = ${toSqlValue(input.subreddit)}`);
  if (input.authority !== undefined) updates.push(`authority = ${toSqlValue(input.authority)}`);
  if (input.type !== undefined) updates.push(`type = ${toSqlValue(input.type)}`);
  if (input.active !== undefined) updates.push(`active = ${toSqlValue(input.active ? 1 : 0)}`);

  if (updates.length === 0) {
    return existing;
  }

  const sql = `
    UPDATE reddit_sources 
    SET ${updates.join(", ")}
    WHERE id = '${escapeString(id)}'
    RETURNING *
  `;

  const result = await db.query<RedditSource>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return {
    ...result.data[0],
    active: Boolean(result.data[0].active),
  };
}

/**
 * Remove uma fonte Reddit
 */
export async function deleteRedditSource(id: string): Promise<boolean> {
  const existing = await getRedditSource(id);
  if (!existing) {
    return false;
  }

  const db = getDb();
  const result = await db.query(`DELETE FROM reddit_sources WHERE id = '${escapeString(id)}'`);
  return result.success;
}

/**
 * Conta fontes Reddit
 */
export async function countRedditSources(activeOnly = true): Promise<number> {
  const db = getDb();
  const whereClause = activeOnly ? "WHERE active = 1" : "";
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_sources ${whereClause}`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

// =============================================================================
// LinkedIn Content Operations (Tabela: linkedin_content_scrape)
// =============================================================================

/**
 * Lista conteúdo do LinkedIn com paginação
 */
export async function listLinkedInContent(limit = 50): Promise<LinkedInContent[]> {
  const db = getDb();
  const result = await db.query<LinkedInContent>(
    `SELECT id, post_id, url, author_name, author_headline, author_profile_url, author_profile_image,
            content, num_likes, num_comments, num_reposts, post_type, media_url, published_at, 
            scraped_at, post_score, type, created_at, updated_at, week_date
     FROM linkedin_content_scrape 
     WHERE post_score > 0
     ORDER BY scraped_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listLinkedInContent] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Lista conteúdo do LinkedIn por tipo
 */
export async function listLinkedInContentByType(type: LinkedInContentType, limit = 50): Promise<LinkedInContent[]> {
  const db = getDb();
  const result = await db.query<LinkedInContent>(
    `SELECT id, post_id, url, author_name, author_headline, author_profile_url, author_profile_image,
            content, num_likes, num_comments, num_reposts, post_type, media_url, published_at, 
            scraped_at, post_score, type, created_at, updated_at, week_date
     FROM linkedin_content_scrape 
     WHERE type = '${escapeString(type)}'
     ORDER BY scraped_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listLinkedInContentByType] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Lista conteúdo do LinkedIn por semana
 */
export async function listLinkedInContentByWeek(weekDate: string, limit = 50): Promise<LinkedInContent[]> {
  const db = getDb();
  const result = await db.query<LinkedInContent>(
    `SELECT id, post_id, url, author_name, author_headline, author_profile_url, author_profile_image,
            content, num_likes, num_comments, num_reposts, post_type, media_url, published_at, 
            scraped_at, post_score, type, created_at, updated_at, week_date
     FROM linkedin_content_scrape 
     WHERE week_date = '${escapeString(weekDate)}'
     ORDER BY post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listLinkedInContentByWeek] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Obtém conteúdo do LinkedIn por ID
 */
export async function getLinkedInContent(id: number): Promise<LinkedInContent | null> {
  const db = getDb();
  const result = await db.query<LinkedInContent>(
    `SELECT id, post_id, url, author_name, author_headline, author_profile_url, author_profile_image,
            content, num_likes, num_comments, num_reposts, post_type, media_url, published_at, 
            scraped_at, post_score, type, created_at, updated_at, week_date
     FROM linkedin_content_scrape 
     WHERE id = ${id}
     LIMIT 1`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Verifica se um post já existe pelo post_id
 */
export async function linkedInContentExistsByPostId(postId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_content_scrape WHERE post_id = '${escapeString(postId)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return false;
  }

  return Number(result.data[0].count) > 0;
}

/**
 * Cria novo conteúdo do LinkedIn
 */
export async function createLinkedInContent(input: LinkedInContentInsert): Promise<LinkedInContent> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO linkedin_content_scrape (
      post_id, url, author_name, author_headline, author_profile_url, author_profile_image,
      content, num_likes, num_comments, num_reposts, post_type, media_url, published_at,
      scraped_at, post_score, type, week_date
    )
    VALUES (
      ${toSqlValue(input.post_id)},
      ${toSqlValue(input.url)},
      ${toSqlValue(input.author_name)},
      ${toSqlValue(input.author_headline)},
      ${toSqlValue(input.author_profile_url)},
      ${toSqlValue(input.author_profile_image)},
      ${toSqlValue(input.content)},
      ${toSqlValue(input.num_likes)},
      ${toSqlValue(input.num_comments)},
      ${toSqlValue(input.num_reposts)},
      ${toSqlValue(input.post_type)},
      ${toSqlValue(input.media_url)},
      ${toSqlValue(input.published_at)},
      ${toSqlValue(now)},
      ${toSqlValue(input.post_score)},
      ${toSqlValue(input.type)},
      ${toSqlValue(input.week_date)}
    )
    RETURNING *
  `;

  const result = await db.query<LinkedInContent>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar conteúdo LinkedIn: ${result.error?.message}`);
  }

  return result.data[0];
}

/**
 * Atualiza o post_score de um conteúdo LinkedIn
 */
export async function updateLinkedInContentScore(id: number, postScore: number): Promise<LinkedInContent | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    UPDATE linkedin_content_scrape 
    SET post_score = ${postScore}, updated_at = ${toSqlValue(now)}
    WHERE id = ${id}
    RETURNING *
  `;

  const result = await db.query<LinkedInContent>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Conta total de conteúdo LinkedIn
 */
export async function countLinkedInContent(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_content_scrape`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta conteúdo com score > 0 (relevante)
 */
export async function countLinkedInRelevantContent(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_content_scrape WHERE post_score > 0`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta conteúdo por tipo
 */
export async function countLinkedInContentByType(type: LinkedInContentType): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM linkedin_content_scrape WHERE type = '${escapeString(type)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

// =============================================================================
// Reddit Content Operations (Tabela: reddit_content_scrape)
// =============================================================================

/**
 * Lista conteúdo do Reddit com paginação
 */
export async function listRedditContent(limit = 50): Promise<RedditContent[]> {
  const db = getDb();
  const result = await db.query<RedditContent>(
    `SELECT id, title, author, subreddit, selftext, url, permalink,
            score, num_comments, created_at, scraped_at, updated_at,
            type, authority, post_score, week_date
     FROM reddit_content_scrape 
     WHERE post_score > 0
     ORDER BY scraped_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listRedditContent] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Lista conteúdo do Reddit por subreddit
 */
export async function listRedditContentBySubreddit(subreddit: string, limit = 50): Promise<RedditContent[]> {
  const db = getDb();
  const result = await db.query<RedditContent>(
    `SELECT id, title, author, subreddit, selftext, url, permalink,
            score, num_comments, created_at, scraped_at, updated_at,
            type, authority, post_score, week_date
     FROM reddit_content_scrape 
     WHERE subreddit = '${escapeString(subreddit)}'
     ORDER BY scraped_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listRedditContentBySubreddit] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Lista conteúdo do Reddit por tipo
 */
export async function listRedditContentByType(type: RedditContentType, limit = 50): Promise<RedditContent[]> {
  const db = getDb();
  const result = await db.query<RedditContent>(
    `SELECT id, title, author, subreddit, selftext, url, permalink,
            score, num_comments, created_at, scraped_at, updated_at,
            type, authority, post_score, week_date
     FROM reddit_content_scrape 
     WHERE type = '${escapeString(type)}'
     ORDER BY scraped_at DESC, post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listRedditContentByType] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Lista conteúdo do Reddit por semana
 */
export async function listRedditContentByWeek(weekDate: string, limit = 50): Promise<RedditContent[]> {
  const db = getDb();
  const result = await db.query<RedditContent>(
    `SELECT id, title, author, subreddit, selftext, url, permalink,
            score, num_comments, created_at, scraped_at, updated_at,
            type, authority, post_score, week_date
     FROM reddit_content_scrape 
     WHERE week_date = '${escapeString(weekDate)}'
     ORDER BY post_score DESC
     LIMIT ${limit}`
  );

  if (!result.success || !result.data) {
    console.error("❌ [listRedditContentByWeek] Erro:", result.error?.message);
    return [];
  }

  return result.data;
}

/**
 * Obtém conteúdo do Reddit por ID
 */
export async function getRedditContent(id: number): Promise<RedditContent | null> {
  const db = getDb();
  const result = await db.query<RedditContent>(
    `SELECT id, title, author, subreddit, selftext, url, permalink,
            score, num_comments, created_at, scraped_at, updated_at,
            type, authority, post_score, week_date
     FROM reddit_content_scrape 
     WHERE id = ${id}
     LIMIT 1`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Verifica se um post já existe pelo permalink
 */
export async function redditContentExistsByPermalink(permalink: string): Promise<boolean> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_content_scrape WHERE permalink = '${escapeString(permalink)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return false;
  }

  return Number(result.data[0].count) > 0;
}

/**
 * Cria novo conteúdo do Reddit
 */
export async function createRedditContent(input: RedditContentInsert): Promise<RedditContent> {
  const db = getDb();

  const sql = `
    INSERT INTO reddit_content_scrape (
      title, author, subreddit, selftext, url, permalink,
      score, num_comments, created_at, type, authority, post_score, week_date
    )
    VALUES (
      ${toSqlValue(input.title)},
      ${toSqlValue(input.author)},
      ${toSqlValue(input.subreddit)},
      ${toSqlValue(input.selftext)},
      ${toSqlValue(input.url)},
      ${toSqlValue(input.permalink)},
      ${toSqlValue(input.score)},
      ${toSqlValue(input.num_comments)},
      ${toSqlValue(input.created_at)},
      ${toSqlValue(input.type)},
      ${toSqlValue(input.authority)},
      ${toSqlValue(input.post_score)},
      ${toSqlValue(input.week_date)}
    )
    RETURNING *
  `;

  const result = await db.query<RedditContent>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    throw new Error(`Erro ao criar conteúdo Reddit: ${result.error?.message}`);
  }

  return result.data[0];
}

/**
 * Atualiza o post_score de um conteúdo Reddit
 */
export async function updateRedditContentScore(id: number, postScore: number): Promise<RedditContent | null> {
  const db = getDb();
  const now = new Date().toISOString();

  const sql = `
    UPDATE reddit_content_scrape 
    SET post_score = ${postScore}, updated_at = ${toSqlValue(now)}
    WHERE id = ${id}
    RETURNING *
  `;

  const result = await db.query<RedditContent>(sql);

  if (!result.success || !result.data || result.data.length === 0) {
    return null;
  }

  return result.data[0];
}

/**
 * Conta total de conteúdo Reddit
 */
export async function countRedditContent(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_content_scrape`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta conteúdo com score > 0 (relevante)
 */
export async function countRedditRelevantContent(): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_content_scrape WHERE post_score > 0`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta conteúdo por subreddit
 */
export async function countRedditContentBySubreddit(subreddit: string): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_content_scrape WHERE subreddit = '${escapeString(subreddit)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}

/**
 * Conta conteúdo por tipo
 */
export async function countRedditContentByType(type: RedditContentType): Promise<number> {
  const db = getDb();
  const result = await db.query<{ count: number }>(
    `SELECT COUNT(*) as count FROM reddit_content_scrape WHERE type = '${escapeString(type)}'`
  );

  if (!result.success || !result.data || result.data.length === 0) {
    return 0;
  }

  return Number(result.data[0].count);
}
