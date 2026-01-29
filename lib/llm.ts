// =============================================================================
// Blog Scraper MCP - LLM Integration (OpenRouter)
// =============================================================================

import type {
  LLMArticleAnalysisResponse,
  LLMArticleListResponse,
} from "./types.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 4000;

/**
 * Obtém a chave da API OpenRouter
 */
function getApiKey(): string {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) {
    throw new Error(
      "OPENROUTER_API_KEY não configurada. Defina a variável de ambiente."
    );
  }
  return key;
}

/**
 * Faz uma chamada ao LLM via OpenRouter
 */
async function callLLM(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://blog-scraper-mcp.local",
      "X-Title": "Blog Scraper MCP",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.choices || !data.choices[0]?.message?.content) {
    throw new Error("Invalid response from OpenRouter");
  }

  return data.choices[0].message.content;
}

/**
 * Parseia JSON de resposta do LLM (lida com markdown code blocks)
 */
function parseJsonResponse<T>(content: string): T {
  // Remove possíveis code blocks de markdown
  let jsonStr = content.trim();

  if (jsonStr.startsWith("```json")) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith("```")) {
    jsonStr = jsonStr.slice(0, -3);
  }

  return JSON.parse(jsonStr.trim());
}

// =============================================================================
// Prompts
// =============================================================================

const ARTICLE_LIST_SYSTEM_PROMPT = `You are an expert at extracting blog article information from web page content.
Given the page content, extract all visible blog articles/posts.

IMPORTANT: The page content contains links in markdown format: [link text](url)
You MUST use the EXACT URLs from these links. Do NOT guess or invent URLs.

For each article, provide:
- title: The article title
- url: The EXACT full URL from the link (do not modify or guess URLs)
- published_at: The publication date if visible (in YYYY-MM-DD format, or null if not found)

Respond ONLY with valid JSON in this exact format:
{
  "articles": [
    { "title": "string", "url": "string", "published_at": "string or null" }
  ]
}

Only include actual blog posts/articles, not navigation links, author pages, or category pages.
Limit to the 10 most recent articles visible on the page.
CRITICAL: Use the exact URLs from the markdown links in the content. Never invent URLs.`;

const ARTICLE_ANALYSIS_SYSTEM_PROMPT = (authority: number) => `You are an expert at analyzing blog articles about technology.
Your task is to:
1. Determine if the article is related to MCP (Model Context Protocol) - this includes articles about AI agents, LLM tools, AI integrations, Claude, Anthropic, or similar AI/ML infrastructure topics.
2. Generate a concise summary (2-3 sentences)
3. Extract 3-5 key points from the article
4. Calculate a quality_score from 0.0 to 1.0 based on:
   - How well-written and informative the article is
   - Technical depth and accuracy
   - Practical value and actionable insights
   - Relevance to MCP/AI topics

The source has an authority rating of ${authority.toFixed(2)} (0.0 = low trust, 1.0 = high trust).
Factor this into your quality assessment - higher authority sources should be weighted more favorably.

Respond ONLY with valid JSON in this exact format:
{
  "is_mcp_related": boolean,
  "summary": "string",
  "key_points": ["point1", "point2", "point3"],
  "quality_score": number
}

quality_score should be between 0.0 and 1.0.
If you cannot determine if the article is MCP-related or if there's insufficient content, set is_mcp_related to false.`;

// =============================================================================
// Public API
// =============================================================================

/**
 * Extrai lista de artigos do conteúdo de uma página
 */
export async function extractArticlesFromPage(
  pageContent: string,
  blogName: string
): Promise<LLMArticleListResponse> {
  console.log(`[LLM] Extracting articles from ${blogName}...`);

  const userMessage = `Extract the blog articles from this page content of "${blogName}":\n\n${pageContent}`;

  const response = await callLLM(ARTICLE_LIST_SYSTEM_PROMPT, userMessage);

  try {
    const parsed = parseJsonResponse<LLMArticleListResponse>(response);

    // Valida estrutura básica
    if (!parsed.articles || !Array.isArray(parsed.articles)) {
      console.warn(`[LLM] Invalid response structure, returning empty list`);
      return { articles: [] };
    }

    console.log(`[LLM] Found ${parsed.articles.length} articles`);
    return parsed;
  } catch (error) {
    console.error(`[LLM] Failed to parse response: ${error}`);
    console.error(`[LLM] Raw response: ${response.slice(0, 500)}...`);
    return { articles: [] };
  }
}

/**
 * Analisa um artigo para determinar relevância e qualidade
 */
export async function analyzeArticle(
  title: string,
  content: string,
  authority: number
): Promise<LLMArticleAnalysisResponse> {
  console.log(`[LLM] Analyzing article: ${title.slice(0, 50)}...`);

  const systemPrompt = ARTICLE_ANALYSIS_SYSTEM_PROMPT(authority);
  const userMessage = `Analyze this article:\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 10000)}`; // Limita a 10k chars

  const response = await callLLM(systemPrompt, userMessage);

  try {
    const parsed = parseJsonResponse<LLMArticleAnalysisResponse>(response);

    // Valida e normaliza campos
    return {
      is_mcp_related: Boolean(parsed.is_mcp_related),
      summary: parsed.summary || "",
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      quality_score: Math.max(0, Math.min(1, parsed.quality_score || 0)),
    };
  } catch (error) {
    console.error(`[LLM] Failed to parse analysis response: ${error}`);
    console.error(`[LLM] Raw response: ${response.slice(0, 500)}...`);

    // Retorna valores padrão em caso de erro
    return {
      is_mcp_related: false,
      summary: "",
      key_points: [],
      quality_score: 0,
    };
  }
}

