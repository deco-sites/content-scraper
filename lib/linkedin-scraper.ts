// =============================================================================
// LinkedIn Scraper - Using Apify API
// =============================================================================

import type {
  LinkedInRawPost,
  LinkedInContentInsert,
  LinkedInSource,
} from "./types.ts";
import {
  linkedInContentExistsByPostId,
  createLinkedInContent,
  listLinkedInSources,
} from "./db.ts";
import { analyzeLinkedInPost } from "./llm.ts";
import { getPublicationWeek, sleep } from "./utils.ts";

// Apify API configuration
const APIFY_API_URL = "https://api.apify.com/v2";
const LINKEDIN_ACTOR_ID = "harvestapi/linkedin-profile-posts";

// Rate limiting
const DELAY_BETWEEN_POSTS = 300; // 300ms entre posts (análise LLM)

// Minimum post score to be considered relevant (0-100)
const MIN_RELEVANT_SCORE = 50;

/**
 * Obtém a chave da API Apify
 */
function getApifyToken(): string {
  const token = Deno.env.get("APIFY_API_TOKEN");
  if (!token) {
    throw new Error(
      "APIFY_API_TOKEN não configurada. Defina a variável de ambiente."
    );
  }
  return token;
}

/**
 * Chama a API da Apify para buscar posts de um perfil LinkedIn
 */
async function fetchLinkedInPosts(
  profileUrl: string,
  maxPosts = 5
): Promise<LinkedInRawPost[]> {
  const token = getApifyToken();

  const input = {
    targetUrls: [profileUrl],
    maxPosts,
    includeReposts: true,
    includeQuotePosts: true,
    scrapeComments: false,
    scrapeReactions: false,
  };

  // Inicia o Actor run
  const runResponse = await fetch(
    `${APIFY_API_URL}/acts/${LINKEDIN_ACTOR_ID}/runs?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify API error: ${runResponse.status} - ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  console.log(`[LinkedIn] Started Apify run: ${runId}`);

  // Aguarda o run completar (polling)
  let status = "RUNNING";
  let attempts = 0;
  const maxAttempts = 60; // 60 * 2s = 2 minutos max

  while (status === "RUNNING" && attempts < maxAttempts) {
    await sleep(2000);
    attempts++;

    const statusResponse = await fetch(
      `${APIFY_API_URL}/actor-runs/${runId}?token=${token}`
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check run status: ${statusResponse.status}`);
    }

    const statusData = await statusResponse.json();
    status = statusData.data.status;

    if (attempts % 5 === 0) {
      console.log(`[LinkedIn] Run status: ${status} (attempt ${attempts})`);
    }
  }

  if (status !== "SUCCEEDED") {
    throw new Error(`Apify run failed with status: ${status}`);
  }

  // Busca o dataset com os resultados
  const datasetResponse = await fetch(
    `${APIFY_API_URL}/actor-runs/${runId}/dataset/items?token=${token}`
  );

  if (!datasetResponse.ok) {
    throw new Error(`Failed to fetch dataset: ${datasetResponse.status}`);
  }

  const posts = await datasetResponse.json();
  return posts as LinkedInRawPost[];
}

/**
 * Determina o tipo de post (text, image, video)
 */
function getPostType(rawPost: LinkedInRawPost): string {
  if (rawPost.postVideo) return "video";
  if (rawPost.postImages && rawPost.postImages.length > 0) return "image";
  return "text";
}

/**
 * Obtém URL de mídia do post
 */
function getMediaUrl(rawPost: LinkedInRawPost): string | null {
  if (rawPost.postVideo) return rawPost.postVideo.videoUrl;
  if (rawPost.postImages && rawPost.postImages.length > 0) {
    return rawPost.postImages[0].url;
  }
  return null;
}

/**
 * Processa um post individual do LinkedIn
 * Nota: LinkedIn sempre salva como type "community"
 */
async function processLinkedInPost(
  rawPost: LinkedInRawPost,
  authorAuthority: number
): Promise<{ saved: boolean; relevant: boolean; score: number }> {
  // Verifica se já existe
  const exists = await linkedInContentExistsByPostId(rawPost.id);
  if (exists) {
    console.log(`    → Skipping (already exists): ${rawPost.id}`);
    return { saved: false, relevant: false, score: 0 };
  }

  // Valida conteúdo mínimo
  if (!rawPost.content || rawPost.content.length < 50) {
    console.log(`    → Skipping (content too short): ${rawPost.id}`);
    return { saved: false, relevant: false, score: 0 };
  }

  // Analisa com LLM
  const analysis = await analyzeLinkedInPost(
    rawPost.content,
    rawPost.author.name,
    authorAuthority,
    rawPost.engagement
  );

  // Calcula post_score (0-100 para a tabela)
  // Formula: 70% quality_score + 30% authority, convertido para 0-100
  const postScore = analysis.is_relevant
    ? Math.round((analysis.quality_score * 0.7 + authorAuthority * 0.3) * 100)
    : 0;

  // Determina se é repost
  const isRepost = !!rawPost.repostedBy;
  const authorName = isRepost ? rawPost.repostedBy!.name : rawPost.author.name;
  const authorUrl = isRepost
    ? rawPost.repostedBy!.linkedinUrl
    : rawPost.author.linkedinUrl;

  // Data do post
  const postedAt = isRepost && rawPost.repostedAt
    ? rawPost.repostedAt.date
    : rawPost.postedAt.date;

  // Calcula week_date
  const publishedDate = new Date(postedAt);
  const weekDate = getPublicationWeek(publishedDate);

  // Prepara os dados para salvar
  // LinkedIn sempre salva como type "community"
  const contentInsert: LinkedInContentInsert = {
    post_id: rawPost.id,
    url: rawPost.linkedinUrl,
    author_name: authorName,
    author_headline: rawPost.author.info || null,
    author_profile_url: authorUrl,
    author_profile_image: rawPost.author.avatar?.url || null,
    content: rawPost.content,
    num_likes: rawPost.engagement.likes,
    num_comments: rawPost.engagement.comments,
    num_reposts: rawPost.engagement.shares,
    post_type: getPostType(rawPost),
    media_url: getMediaUrl(rawPost),
    published_at: postedAt,
    post_score: postScore,
    type: "community",
    week_date: weekDate,
  };

  // Salva no banco
  await createLinkedInContent(contentInsert);

  const isRelevant = postScore >= MIN_RELEVANT_SCORE;

  if (isRelevant) {
    console.log(`    ✓ Saved (relevant, score: ${postScore}): ${rawPost.content.slice(0, 50)}...`);
  } else {
    console.log(`    ○ Saved (score: ${postScore}): ${rawPost.content.slice(0, 50)}...`);
  }

  return { saved: true, relevant: isRelevant, score: postScore };
}

/**
 * Resultado do scraping de um perfil
 */
export interface ScrapeResult {
  profileUrl: string;
  postsFound: number;
  postsSaved: number;
  postsRelevant: number;
  averageScore: number;
}

/**
 * Faz scraping de um perfil específico do LinkedIn
 * Nota: LinkedIn sempre salva como type "community"
 */
export async function scrapeLinkedInProfile(
  profileUrl: string,
  authorAuthority = 0.7,
  maxPosts = 5
): Promise<ScrapeResult> {
  console.log(`[LinkedIn] Fetching posts from: ${profileUrl}`);
  console.log(`    Authority: ${(authorAuthority * 100).toFixed(0)}%, Type: community`);

  // Busca posts via Apify
  const posts = await fetchLinkedInPosts(profileUrl, maxPosts);

  if (posts.length === 0) {
    console.log("    ⚠ No posts found");
    return {
      profileUrl,
      postsFound: 0,
      postsSaved: 0,
      postsRelevant: 0,
      averageScore: 0,
    };
  }

  console.log(`    Found ${posts.length} posts`);

  let savedCount = 0;
  let relevantCount = 0;
  let totalScore = 0;

  for (const post of posts) {
    try {
      const { saved, relevant, score } = await processLinkedInPost(
        post,
        authorAuthority
      );
      if (saved) {
        savedCount++;
        totalScore += score;
        if (relevant) {
          relevantCount++;
        }
      }
    } catch (error) {
      console.error(`    ✗ Error processing post ${post.id}: ${error}`);
    }

    // Rate limiting entre posts (por causa do LLM)
    await sleep(DELAY_BETWEEN_POSTS);
  }

  const averageScore = savedCount > 0 ? Math.round(totalScore / savedCount) : 0;

  return {
    profileUrl,
    postsFound: posts.length,
    postsSaved: savedCount,
    postsRelevant: relevantCount,
    averageScore,
  };
}

/**
 * Faz scraping de múltiplos perfis
 * Nota: LinkedIn sempre salva como type "community"
 */
export async function scrapeLinkedInProfiles(
  profiles: Array<{
    url: string;
    authority?: number;
  }>,
  maxPosts = 5
): Promise<ScrapeResult[]> {
  console.log("=".repeat(60));
  console.log("LinkedIn Scraper - Starting scraping process");
  console.log("=".repeat(60));
  console.log(`\nProcessing ${profiles.length} profiles (type: community)\n`);

  const results: ScrapeResult[] = [];

  for (let i = 0; i < profiles.length; i++) {
    const profile = profiles[i];
    console.log(`\n[${i + 1}/${profiles.length}] Processing: ${profile.url}`);

    try {
      const result = await scrapeLinkedInProfile(
        profile.url,
        profile.authority || 0.7,
        maxPosts
      );
      results.push(result);
      console.log(`    ✓ Done: ${result.postsSaved} saved, ${result.postsRelevant} relevant`);
    } catch (error) {
      console.error(`    ✗ Error: ${error}`);
      results.push({
        profileUrl: profile.url,
        postsFound: 0,
        postsSaved: 0,
        postsRelevant: 0,
        averageScore: 0,
      });
    }

    // Rate limiting entre perfis (2 segundos)
    if (i < profiles.length - 1) {
      await sleep(2000);
    }
  }

  const totalSaved = results.reduce((sum, r) => sum + r.postsSaved, 0);
  const totalRelevant = results.reduce((sum, r) => sum + r.postsRelevant, 0);

  console.log("\n" + "=".repeat(60));
  console.log(`Scraping complete! Total: ${totalSaved} posts saved, ${totalRelevant} relevant`);
  console.log("=".repeat(60));

  return results;
}

/**
 * Faz scraping de todas as fontes LinkedIn cadastradas no banco
 * Busca automaticamente da tabela linkedin_sources
 */
export async function scrapeAllLinkedInSources(maxPosts = 5): Promise<ScrapeResult[]> {
  console.log("=".repeat(60));
  console.log("LinkedIn Scraper - Scraping All Sources");
  console.log("=".repeat(60));

  // Busca fontes ativas do banco
  const sources = await listLinkedInSources(true);

  if (sources.length === 0) {
    console.log("\n⚠ No active LinkedIn sources found in database.");
    console.log("Run 'deno task scraper seed-linkedin' to add initial sources.\n");
    return [];
  }

  console.log(`\nFound ${sources.length} active LinkedIn sources\n`);

  // Converte para o formato esperado
  const profiles = sources.map((source: LinkedInSource) => ({
    url: source.profile_url,
    authority: source.authority,
  }));

  return await scrapeLinkedInProfiles(profiles, maxPosts);
}
