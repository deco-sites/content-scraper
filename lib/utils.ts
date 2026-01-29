// =============================================================================
// Blog Scraper MCP - Utilitários
// =============================================================================

/**
 * Gera um ID único usando crypto
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Calcula a semana de publicação no formato ISO (YYYY-wWW)
 */
export function getPublicationWeek(date: Date): string {
  const year = date.getFullYear();
  const firstDayOfYear = new Date(year, 0, 1);
  const pastDaysOfYear =
    (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil(
    (pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7
  );
  return `${year}-w${weekNumber.toString().padStart(2, "0")}`;
}

/**
 * Verifica se uma data está dentro da última semana
 */
export function isWithinLastWeek(date: Date): boolean {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  return date >= oneWeekAgo;
}

/**
 * Converte data para formato YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Parseia data de string para Date
 */
export function parseDate(dateStr: string): Date | null {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Obtém a semana atual no formato YYYY-wWW
 */
export function getCurrentWeek(): string {
  return getPublicationWeek(new Date());
}

/**
 * Calcula o post_score final
 * 70% quality_score + 30% authority
 */
export function calculatePostScore(
  qualityScore: number,
  authority: number
): number {
  const score = qualityScore * 0.7 + authority * 0.3;
  return Math.round(score * 100) / 100; // Arredonda para 2 casas decimais
}

/**
 * Extrai texto com links em formato markdown de HTML
 * Preserva URLs para o LLM poder identificar artigos
 */
export function extractTextWithLinks(html: string, baseUrl: string): string {
  // Remove script, style, noscript, nav, footer, header
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ");

  // Converte links para markdown [text](url)
  const base = new URL(baseUrl);
  text = text.replace(
    /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href, linkText) => {
      // Limpa o texto do link
      const cleanText = linkText.replace(/<[^>]+>/g, "").trim();
      if (!cleanText || !href) return cleanText;

      // Converte URL relativa para absoluta
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, base).href;
      } catch {
        absoluteUrl = href;
      }

      return `[${cleanText}](${absoluteUrl})`;
    }
  );

  // Remove demais tags HTML
  text = text.replace(/<[^>]+>/g, " ");

  // Decodifica entidades HTML comuns
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)));

  // Limpa whitespace excessivo
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Extrai texto limpo de HTML (sem links)
 * Usado para extrair conteúdo de artigos
 */
export function extractPlainText(html: string): string {
  // Remove script, style, noscript, nav, footer, header, aside
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, " ")
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, " ")
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, " ")
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, " ")
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, " ");

  // Remove todas as tags HTML
  text = text.replace(/<[^>]+>/g, " ");

  // Decodifica entidades HTML
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(parseInt(code)));

  // Limpa whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

/**
 * Aguarda um tempo em ms
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch com retry e backoff exponencial
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<Response> {
  const delays = [1000, 2000, 3000]; // 1s, 2s, 3s

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          ...options.headers,
        },
      });

      if (response.ok) {
        return response;
      }

      // Se não for OK e ainda temos retries, tenta novamente
      if (attempt < maxRetries) {
        console.log(
          `[Retry ${attempt + 1}/${maxRetries}] Status ${response.status} for ${url}`
        );
        await sleep(delays[attempt]);
        continue;
      }

      return response; // Retorna a resposta mesmo com erro
    } catch (error) {
      if (attempt < maxRetries) {
        console.log(
          `[Retry ${attempt + 1}/${maxRetries}] Error fetching ${url}: ${error}`
        );
        await sleep(delays[attempt]);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Valida se o conteúdo tem tamanho mínimo aceitável
 */
export function hasMinimumContent(content: string, minLength = 100): boolean {
  return content.length >= minLength;
}

/**
 * Formata número como percentual
 */
export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Trunca texto com ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

