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

  // Remove todos os artigos do blog primeiro
  await db.query(`DELETE FROM articles WHERE blog_id = '${escapeString(id)}'`);

  // Remove o blog
  const result = await db.query(`DELETE FROM blog_sources WHERE id = '${escapeString(id)}'`);

  return result.success;
}

// =============================================================================
// Article Operations (Tabela: articles)
// =============================================================================

/**
 * Lista artigos com paginação
 */
export async function listArticles(limit = 50): Promise<Article[]> {
  const db = getDb();
  const result = await db.query<Article>(
    `SELECT id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at
     FROM articles 
     ORDER BY scraped_at DESC, post_score DESC
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
    `SELECT id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at
     FROM articles 
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
    `SELECT id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at
     FROM articles 
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
    `SELECT id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at
     FROM articles 
     WHERE id = '${escapeString(id)}' 
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
    `SELECT COUNT(*) as count FROM articles WHERE url = '${escapeString(url)}'`
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
  const id = generateId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO articles (id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at)
    VALUES (
      ${toSqlValue(id)},
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
    RETURNING *
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
  const id = generateId();
  const now = new Date().toISOString();

  const sql = `
    INSERT INTO articles (id, blog_id, title, url, published_at, publication_week, summary, key_points, post_score, scraped_at)
    VALUES (
      ${toSqlValue(id)},
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
    ON CONFLICT (url) DO UPDATE SET
      title = EXCLUDED.title,
      summary = EXCLUDED.summary,
      key_points = EXCLUDED.key_points,
      post_score = EXCLUDED.post_score,
      scraped_at = EXCLUDED.scraped_at
    RETURNING *
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
    `SELECT COUNT(*) as count FROM articles WHERE blog_id = '${escapeString(blogId)}'`
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
  const result = await db.query<{ count: number }>(`SELECT COUNT(*) as count FROM articles`);

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
      (SELECT COUNT(*) FROM articles) as total_articles,
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
      a.id, a.blog_id, a.title, a.url, a.published_at, a.publication_week, a.summary, a.key_points, a.post_score, a.scraped_at,
      b.name as blog_name, b.url as blog_url, b.feed_url as blog_feed_url, b.authority as blog_authority, b.type as blog_type, b.created_at as blog_created_at
     FROM articles a
     JOIN blog_sources b ON a.blog_id = b.id
     ORDER BY a.scraped_at DESC, a.post_score DESC
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
      a.id, a.blog_id, a.title, a.url, a.published_at, a.publication_week, a.summary, a.key_points, a.post_score, a.scraped_at,
      b.name as blog_name, b.url as blog_url, b.feed_url as blog_feed_url, b.authority as blog_authority, b.type as blog_type, b.created_at as blog_created_at
     FROM articles a
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
