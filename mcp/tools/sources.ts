/**
 * Sources Tools
 * 
 * Tools para listar fontes cadastradas no banco de dados.
 */

import { z } from "npm:zod@3.24.0";
import {
  listBlogs,
  listLinkedInSources,
  listRedditSources,
} from "../../lib/db.ts";

// Schema definitions
export const listBlogSourcesSchema = z.object({});

export const listLinkedInSourcesSchema = z.object({
  active_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("Se true, lista apenas fontes ativas (default: true)"),
});

export const listRedditSourcesSchema = z.object({
  active_only: z
    .boolean()
    .optional()
    .default(true)
    .describe("Se true, lista apenas fontes ativas (default: true)"),
});

// Tool handlers
export async function handleListBlogSources() {
  const blogs = await listBlogs();
  return {
    total: blogs.length,
    sources: blogs.map((blog) => ({
      id: blog.id,
      name: blog.name,
      url: blog.url,
      type: blog.type,
      authority: `${(blog.authority * 100).toFixed(0)}%`,
    })),
  };
}

export async function handleListLinkedInSources(args: z.infer<typeof listLinkedInSourcesSchema>) {
  const activeOnly = args.active_only !== false;
  const sources = await listLinkedInSources(activeOnly);
  return {
    total: sources.length,
    filter: activeOnly ? "active only" : "all",
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      profile_url: source.profile_url,
      type: source.type,
      authority: `${(source.authority * 100).toFixed(0)}%`,
      active: source.active,
    })),
  };
}

export async function handleListRedditSources(args: z.infer<typeof listRedditSourcesSchema>) {
  const activeOnly = args.active_only !== false;
  const sources = await listRedditSources(activeOnly);
  return {
    total: sources.length,
    filter: activeOnly ? "active only" : "all",
    sources: sources.map((source) => ({
      id: source.id,
      name: source.name,
      subreddit: `r/${source.subreddit}`,
      type: source.type,
      authority: `${(source.authority * 100).toFixed(0)}%`,
      active: source.active,
    })),
  };
}

// Tool definitions for MCP
export const sourcesTools = [
  {
    name: "list_blog_sources",
    description: "Lista todos os blogs cadastrados como fonte de conteúdo.",
    schema: listBlogSourcesSchema,
    handler: handleListBlogSources,
  },
  {
    name: "list_linkedin_sources",
    description: "Lista todos os perfis do LinkedIn cadastrados para monitoramento.",
    schema: listLinkedInSourcesSchema,
    handler: handleListLinkedInSources,
  },
  {
    name: "list_reddit_sources",
    description: "Lista todos os subreddits cadastrados para monitoramento.",
    schema: listRedditSourcesSchema,
    handler: handleListRedditSources,
  },
];

