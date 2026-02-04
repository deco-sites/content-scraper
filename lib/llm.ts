// =============================================================================
// Blog Scraper MCP - LLM Integration (OpenRouter)
// =============================================================================

import type {
  LLMArticleAnalysisResponse,
  LLMArticleListResponse,
  LLMLinkedInPostAnalysisResponse,
  LLMRedditPostAnalysisResponse,
} from "./types.ts";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4";
const TEMPERATURE = 0.3;
const MAX_TOKENS = 4000;

async function loadPrompt(path: string): Promise<string> {
  return await Deno.readTextFile(new URL(path, import.meta.url));
}

/**
 * Renderiza templates simples no formato {{var}}
 */
function renderPromptTemplate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined ? `{{${key}}}` : String(value);
  });
}

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

const ARTICLE_LIST_SYSTEM_PROMPT = await loadPrompt(
  "./prompts/article_list_system.md",
);
const ARTICLE_ANALYSIS_SYSTEM_PROMPT_TEMPLATE = await loadPrompt(
  "./prompts/article_analysis_system.md",
);
const LINKEDIN_POST_ANALYSIS_SYSTEM_PROMPT_TEMPLATE = await loadPrompt(
  "./prompts/linkedin_post_analysis_system.md",
);
const REDDIT_POST_ANALYSIS_SYSTEM_PROMPT_TEMPLATE = await loadPrompt(
  "./prompts/reddit_post_analysis_system.md",
);

const ARTICLE_ANALYSIS_SYSTEM_PROMPT = (authority: number) =>
  renderPromptTemplate(ARTICLE_ANALYSIS_SYSTEM_PROMPT_TEMPLATE, {
    authority: authority.toFixed(2),
  });

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

// =============================================================================
// LinkedIn Post Analysis
// =============================================================================

const LINKEDIN_POST_ANALYSIS_SYSTEM_PROMPT = (authority: number) =>
  renderPromptTemplate(LINKEDIN_POST_ANALYSIS_SYSTEM_PROMPT_TEMPLATE, {
    authority: authority.toFixed(2),
  });

/**
 * Analisa um post do LinkedIn para determinar relevância e qualidade
 */
export async function analyzeLinkedInPost(
  content: string,
  authorName: string,
  authority: number,
  engagement: { likes: number; comments: number; shares: number }
): Promise<LLMLinkedInPostAnalysisResponse> {
  console.log(`[LLM] Analyzing LinkedIn post from: ${authorName}...`);

  const systemPrompt = LINKEDIN_POST_ANALYSIS_SYSTEM_PROMPT(authority);
  const userMessage = `Analyze this LinkedIn post:

Author: ${authorName}
Engagement: ${engagement.likes} likes, ${engagement.comments} comments, ${engagement.shares} shares

Content:
${content.slice(0, 5000)}`; // Limita a 5k chars (posts são menores que artigos)

  const response = await callLLM(systemPrompt, userMessage);

  try {
    const parsed = parseJsonResponse<LLMLinkedInPostAnalysisResponse>(response);

    // Valida e normaliza campos
    return {
      is_relevant: Boolean(parsed.is_relevant),
      summary: parsed.summary || "",
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      quality_score: Math.max(0, Math.min(1, parsed.quality_score || 0)),
      relevance_reason: parsed.relevance_reason || "",
    };
  } catch (error) {
    console.error(`[LLM] Failed to parse LinkedIn post analysis response: ${error}`);
    console.error(`[LLM] Raw response: ${response.slice(0, 500)}...`);

    // Retorna valores padrão em caso de erro
    return {
      is_relevant: false,
      summary: "",
      key_points: [],
      quality_score: 0,
      relevance_reason: "Failed to analyze post",
    };
  }
}

// =============================================================================
// Reddit Post Analysis
// =============================================================================

const REDDIT_POST_ANALYSIS_SYSTEM_PROMPT = (
  subreddit: string,
  upvotes: number,
  comments: number,
) =>
  renderPromptTemplate(REDDIT_POST_ANALYSIS_SYSTEM_PROMPT_TEMPLATE, {
    subreddit,
    upvotes,
    comments,
  });

/**
 * Analisa um post do Reddit para determinar relevância e qualidade
 */
export async function analyzeRedditPost(
  title: string,
  content: string,
  subreddit: string,
  engagement: { upvotes: number; comments: number }
): Promise<LLMRedditPostAnalysisResponse> {
  console.log(`[LLM] Analyzing Reddit post: ${title.slice(0, 50)}...`);

  const systemPrompt = REDDIT_POST_ANALYSIS_SYSTEM_PROMPT(subreddit, engagement.upvotes, engagement.comments);
  const userMessage = `Analyze this Reddit post:

Title: ${title}
Subreddit: r/${subreddit}
Engagement: ${engagement.upvotes} upvotes, ${engagement.comments} comments

Content:
${content.slice(0, 8000)}`; // Limita a 8k chars (posts do Reddit podem ser maiores)

  const response = await callLLM(systemPrompt, userMessage);

  try {
    const parsed = parseJsonResponse<LLMRedditPostAnalysisResponse>(response);

    // Valida e normaliza campos
    return {
      is_relevant: Boolean(parsed.is_relevant),
      summary: parsed.summary || "",
      key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
      quality_score: Math.max(0, Math.min(1, parsed.quality_score || 0)),
      relevance_reason: parsed.relevance_reason || "",
    };
  } catch (error) {
    console.error(`[LLM] Failed to parse Reddit post analysis response: ${error}`);
    console.error(`[LLM] Raw response: ${response.slice(0, 500)}...`);

    // Retorna valores padrão em caso de erro
    return {
      is_relevant: false,
      summary: "",
      key_points: [],
      quality_score: 0,
      relevance_reason: "Failed to analyze post",
    };
  }
}

