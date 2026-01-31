/**
 * Content Tools
 * 
 * Tools para listar conteúdo já scrapeado do banco de dados.
 */

import { z } from "npm:zod@3.24.0";
import {
  listArticles,
  listArticlesWithBlog,
  listLinkedInContent,
  listLinkedInContentByWeek,
  listRedditContent,
  listRedditContentBySubreddit,
  getDashboardStats,
  countLinkedInContent,
  countRedditContent,
  listLinkedInSources,
  listRedditSources,
} from "../../lib/db.ts";

// Schema definitions
export const listArticlesSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Limite de artigos (default: 20)"),
  include_blog_info: z
    .boolean()
    .optional()
    .default(false)
    .describe("Se true, inclui informações do blog junto com cada artigo"),
});

export const listLinkedInPostsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Limite de posts (default: 20)"),
  week: z
    .string()
    .optional()
    .describe("Filtrar por semana no formato YYYY-wWW (ex: 2026-w05). Opcional."),
});

export const listRedditPostsSchema = z.object({
  limit: z
    .number()
    .optional()
    .default(20)
    .describe("Limite de posts (default: 20)"),
  subreddit: z
    .string()
    .optional()
    .describe("Filtrar por subreddit específico (sem 'r/'). Opcional."),
});

export const getStatsSchema = z.object({});

// Tool handlers
export async function handleListArticles(args: z.infer<typeof listArticlesSchema>) {
  const limit = args.limit || 20;
  const includeBlogInfo = args.include_blog_info === true;

  if (includeBlogInfo) {
    const articles = await listArticlesWithBlog(limit);
    return {
      total: articles.length,
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        url: article.url,
        published_at: article.published_at,
        post_score: `${(article.post_score * 100).toFixed(0)}%`,
        summary: article.summary,
        blog: {
          name: article.blog.name,
          type: article.blog.type,
          authority: `${(article.blog.authority * 100).toFixed(0)}%`,
        },
      })),
    };
  } else {
    const articles = await listArticles(limit);
    return {
      total: articles.length,
      articles: articles.map((article) => ({
        id: article.id,
        title: article.title,
        url: article.url,
        published_at: article.published_at,
        post_score: `${(article.post_score * 100).toFixed(0)}%`,
        summary: article.summary,
      })),
    };
  }
}

export async function handleListLinkedInPosts(args: z.infer<typeof listLinkedInPostsSchema>) {
  const limit = args.limit || 20;
  const week = args.week;

  const posts = week
    ? await listLinkedInContentByWeek(week, limit)
    : await listLinkedInContent(limit);

  return {
    total: posts.length,
    filter: week ? `week: ${week}` : "all",
    posts: posts.map((post) => ({
      id: post.id,
      author: post.author_name,
      author_headline: post.author_headline,
      content_preview: post.content?.slice(0, 200) + (post.content && post.content.length > 200 ? "..." : ""),
      url: post.url,
      engagement: {
        likes: post.num_likes,
        comments: post.num_comments,
        reposts: post.num_reposts,
      },
      post_score: `${(post.post_score * 100).toFixed(0)}%`,
      published_at: post.published_at,
      week: post.week_date,
    })),
  };
}

export async function handleListRedditPosts(args: z.infer<typeof listRedditPostsSchema>) {
  const limit = args.limit || 20;
  const subreddit = args.subreddit;

  const posts = subreddit
    ? await listRedditContentBySubreddit(subreddit, limit)
    : await listRedditContent(limit);

  return {
    total: posts.length,
    filter: subreddit ? `r/${subreddit}` : "all",
    posts: posts.map((post) => ({
      id: post.id,
      title: post.title,
      author: post.author,
      subreddit: `r/${post.subreddit}`,
      url: post.permalink,
      engagement: {
        score: post.score,
        comments: post.num_comments,
      },
      post_score: `${((post.post_score || 0) * 100).toFixed(0)}%`,
      type: post.type,
      week: post.week_date,
    })),
  };
}

export async function handleGetStats() {
  const dashboardStats = await getDashboardStats();
  const linkedinCount = await countLinkedInContent();
  const redditCount = await countRedditContent();
  const linkedinSources = await listLinkedInSources(false);
  const redditSources = await listRedditSources(false);

  return {
    sources: {
      blogs: dashboardStats.totalBlogs,
      linkedin_profiles: linkedinSources.length,
      linkedin_profiles_active: linkedinSources.filter((s) => s.active).length,
      reddit_subreddits: redditSources.length,
      reddit_subreddits_active: redditSources.filter((s) => s.active).length,
    },
    content: {
      articles: dashboardStats.totalArticles,
      linkedin_posts: linkedinCount,
      reddit_posts: redditCount,
    },
    averageAuthority: `${(dashboardStats.averageAuthority * 100).toFixed(0)}%`,
  };
}

// Tool definitions for MCP
export const contentTools = [
  {
    name: "list_articles",
    description: "Lista artigos de blogs já scrapeados, ordenados por score.",
    schema: listArticlesSchema,
    handler: handleListArticles,
  },
  {
    name: "list_linkedin_posts",
    description: "Lista posts do LinkedIn já scrapeados, ordenados por score de relevância.",
    schema: listLinkedInPostsSchema,
    handler: handleListLinkedInPosts,
  },
  {
    name: "list_reddit_posts",
    description: "Lista posts do Reddit já scrapeados, ordenados por score de relevância.",
    schema: listRedditPostsSchema,
    handler: handleListRedditPosts,
  },
  {
    name: "get_stats",
    description: "Retorna estatísticas gerais do sistema: total de fontes, posts scrapeados, etc.",
    schema: getStatsSchema,
    handler: handleGetStats,
  },
];

