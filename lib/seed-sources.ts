// =============================================================================
// Seed Sources - Adiciona fontes de Blog, LinkedIn e Reddit no banco de dados
// =============================================================================

import {
  createBlog,
  createLinkedInSource,
  createRedditSource,
  listBlogs,
  listLinkedInSources,
  listRedditSources,
} from "./db.ts";
import type { BlogType } from "./types.ts";

// =============================================================================
// Mapeamento de prioridade para authority
// =============================================================================

function priorityToAuthority(priority: string): number {
  switch (priority) {
    case "critical":
      return 1.0;
    case "high":
      return 0.8;
    case "medium":
      return 0.5;
    case "low":
      return 0.3;
    default:
      return 0.5;
  }
}

// =============================================================================
// Dados das Fontes
// =============================================================================

interface SourceData {
  name: string;
  slug: string;
  priority: string;
  note: string;
  type: BlogType;
  urls: {
    blog?: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
    website?: string;
    reddit?: string;
    [key: string]: string | undefined;
  };
}

// Big Tech Companies
const bigTechSources: SourceData[] = [
  {
    name: "Anthropic",
    slug: "anthropic",
    priority: "critical",
    note: "MCP creators - highest priority",
    type: "Enterprise",
    urls: {
      blog: "https://www.anthropic.com/news",
      linkedin: "https://www.linkedin.com/company/anthropicresearch/",
    },
  },
  {
    name: "OpenAI",
    slug: "openai",
    priority: "high",
    note: "Major AI player - watch for MCP adoption/response",
    type: "Enterprise",
    urls: {
      blog: "https://openai.com/blog",
      linkedin: "https://www.linkedin.com/company/openai/",
    },
  },
  {
    name: "Google DeepMind",
    slug: "google-deepmind",
    priority: "high",
    note: "Google's AI research division",
    type: "Enterprise",
    urls: {
      blog: "https://deepmind.google/discover/blog/",
      linkedin: "https://www.linkedin.com/company/googledeepmind/",
    },
  },
  {
    name: "Google AI",
    slug: "google-ai",
    priority: "high",
    note: "Google AI products and Vertex AI",
    type: "Enterprise",
    urls: {
      blog: "https://blog.google/technology/ai/",
      linkedin: "https://www.linkedin.com/showcase/google-cloud-ai/",
    },
  },
  {
    name: "Microsoft",
    slug: "microsoft",
    priority: "high",
    note: "Azure AI, Copilot, and MCP Gateway",
    type: "Enterprise",
    urls: {
      blog: "https://blogs.microsoft.com/ai/",
      linkedin: "https://www.linkedin.com/company/microsoft/",
    },
  },
  {
    name: "AWS",
    slug: "aws",
    priority: "high",
    note: "Amazon Bedrock, AI services",
    type: "Enterprise",
    urls: {
      blog: "https://aws.amazon.com/blogs/machine-learning/",
      linkedin: "https://www.linkedin.com/company/amazon-web-services/",
    },
  },
  {
    name: "Meta AI",
    slug: "meta-ai",
    priority: "high",
    note: "Llama models, open source AI",
    type: "Enterprise",
    urls: {
      blog: "https://ai.meta.com/blog/",
      linkedin: "https://www.linkedin.com/company/meta/",
    },
  },
  {
    name: "NVIDIA",
    slug: "nvidia",
    priority: "medium",
    note: "AI infrastructure, NIM, developer tools",
    type: "Enterprise",
    urls: {
      blog: "https://blogs.nvidia.com/blog/category/deep-learning/",
      linkedin: "https://www.linkedin.com/company/nvidia/",
    },
  },
  {
    name: "IBM",
    slug: "ibm",
    priority: "medium",
    note: "watsonx, MCP Context Forge",
    type: "Enterprise",
    urls: {
      blog: "https://www.ibm.com/blog/",
      linkedin: "https://www.linkedin.com/company/ibm/",
    },
  },
  {
    name: "Salesforce",
    slug: "salesforce",
    priority: "medium",
    note: "Agentforce, Einstein AI",
    type: "Enterprise",
    urls: {
      blog: "https://www.salesforce.com/blog/",
      linkedin: "https://www.linkedin.com/company/salesforce/",
    },
  },
  {
    name: "Cohere",
    slug: "cohere",
    priority: "medium",
    note: "Enterprise AI, Command models",
    type: "Enterprise",
    urls: {
      blog: "https://cohere.com/blog",
      linkedin: "https://www.linkedin.com/company/coehq/",
    },
  },
  {
    name: "Mistral AI",
    slug: "mistral",
    priority: "medium",
    note: "Open-weight models, European AI",
    type: "Enterprise",
    urls: {
      blog: "https://mistral.ai/news/",
      linkedin: "https://www.linkedin.com/company/mistral-ai/",
    },
  },
  {
    name: "Hugging Face",
    slug: "huggingface",
    priority: "medium",
    note: "AI community hub, model hosting",
    type: "Enterprise",
    urls: {
      blog: "https://huggingface.co/blog",
      linkedin: "https://www.linkedin.com/company/huggingface/",
    },
  },
  {
    name: "GitHub",
    slug: "github",
    priority: "high",
    note: "Copilot, developer tools, MCP discussions",
    type: "Enterprise",
    urls: {
      blog: "https://github.blog/",
      linkedin: "https://www.linkedin.com/company/github/",
    },
  },
  {
    name: "Vercel",
    slug: "vercel",
    priority: "medium",
    note: "AI SDK, v0, developer tools",
    type: "Trendsetter",
    urls: {
      blog: "https://vercel.com/blog",
      linkedin: "https://www.linkedin.com/company/vercel/",
    },
  },
  {
    name: "Databricks",
    slug: "databricks",
    priority: "medium",
    note: "Data + AI platform, Mosaic ML",
    type: "Enterprise",
    urls: {
      blog: "https://www.databricks.com/blog",
      linkedin: "https://www.linkedin.com/company/databricks/",
    },
  },
  {
    name: "Snowflake",
    slug: "snowflake",
    priority: "medium",
    note: "Data cloud, Cortex AI",
    type: "Enterprise",
    urls: {
      blog: "https://www.snowflake.com/blog/",
      linkedin: "https://www.linkedin.com/company/snowflake-computing/",
    },
  },
  {
    name: "Cloudflare",
    slug: "cloudflare",
    priority: "medium",
    note: "Workers AI, edge computing",
    type: "Enterprise",
    urls: {
      blog: "https://blog.cloudflare.com/",
      linkedin: "https://www.linkedin.com/company/cloudflare-inc-/",
    },
  },
];

// MCP Gateways & Infrastructure
const mcpGatewaysSources: SourceData[] = [
  {
    name: "Arcade",
    slug: "arcade",
    priority: "high",
    note: "MCP Gateway, tool-calling, agent auth",
    type: "MCP-First Startups",
    urls: {
      blog: "https://blog.arcade.dev",
      linkedin: "https://www.linkedin.com/company/arcadeai/",
    },
  },
  {
    name: "Solo.io",
    slug: "solo-io",
    priority: "high",
    note: "Agent Gateway, Agent Mesh, MCP + A2A protocol",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.solo.io/blog",
      linkedin: "https://www.linkedin.com/company/solo.io/",
    },
  },
  {
    name: "Zuplo",
    slug: "zuplo",
    priority: "high",
    note: "MCP Gateway, API-to-MCP conversion",
    type: "MCP-First Startups",
    urls: {
      blog: "https://zuplo.com/blog",
      linkedin: "https://www.linkedin.com/company/zuplo/",
    },
  },
  {
    name: "TrueFoundry",
    slug: "truefoundry",
    priority: "high",
    note: "MCP Gateway, MLOps platform",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.truefoundry.com/blog",
      linkedin: "https://www.linkedin.com/company/truefoundry/",
    },
  },
  {
    name: "Obot",
    slug: "obot",
    priority: "high",
    note: "Open source MCP Gateway for enterprise",
    type: "MCP-First Startups",
    urls: {
      blog: "https://obot.ai/blog",
      linkedin: "https://www.linkedin.com/company/obot-ai/",
    },
  },
  {
    name: "Fiberplane",
    slug: "fiberplane",
    priority: "high",
    note: "MCP Gateway, MCP debugging tools",
    type: "MCP-First Startups",
    urls: {
      blog: "https://blog.fiberplane.com",
      linkedin: "https://www.linkedin.com/company/fiberplane/",
    },
  },
  {
    name: "MintMCP",
    slug: "mintmcp",
    priority: "high",
    note: "MCP infrastructure, virtual servers",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.mintmcp.com/blog",
      linkedin: "https://www.linkedin.com/company/mintmcp/",
    },
  },
  {
    name: "Lunar.dev",
    slug: "lunar-dev",
    priority: "medium",
    note: "MCP Gateway, API consumption management",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.lunar.dev/lunar-blog",
      linkedin: "https://www.linkedin.com/company/lunar-dev/",
    },
  },
  {
    name: "Tyk",
    slug: "tyk",
    priority: "medium",
    note: "API Gateway with AI Studio, MCP support",
    type: "MCP-First Startups",
    urls: {
      blog: "https://tyk.io/blog",
      linkedin: "https://www.linkedin.com/company/tyk/",
    },
  },
  {
    name: "Speakeasy",
    slug: "speakeasy",
    priority: "high",
    note: "Gram MCP platform, OpenAPI-to-MCP",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.speakeasy.com/blog",
      linkedin: "https://www.linkedin.com/company/speakeasy-api/",
    },
  },
  {
    name: "Metorial",
    slug: "metorial",
    priority: "medium",
    note: "MCP marketplace, integration platform",
    type: "MCP-First Startups",
    urls: {
      blog: "https://metorial.com/blog",
      linkedin: "https://www.linkedin.com/company/metorial/",
    },
  },
  {
    name: "Gravitee",
    slug: "gravitee",
    priority: "medium",
    note: "API Gateway with MCP support",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.gravitee.io/blog",
      linkedin: "https://www.linkedin.com/company/gravitee-io/",
    },
  },
  {
    name: "Enkrypt AI",
    slug: "enkrypt-ai",
    priority: "medium",
    note: "Secure MCP Gateway",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.enkryptai.com/",
      linkedin: "https://www.linkedin.com/company/enkrypt-ai/",
    },
  },
];

// Agent Frameworks & Orchestration
const agentFrameworksSources: SourceData[] = [
  {
    name: "CrewAI",
    slug: "crewai",
    priority: "high",
    note: "Multi-agent orchestration platform",
    type: "MCP-First Startups",
    urls: {
      blog: "https://blog.crewai.com",
      linkedin: "https://www.linkedin.com/company/crewai-inc/",
    },
  },
  {
    name: "Dust",
    slug: "dust",
    priority: "high",
    note: "Enterprise AI agents platform",
    type: "MCP-First Startups",
    urls: {
      blog: "https://dust.tt/blog",
      linkedin: "https://www.linkedin.com/company/dust-tt/",
    },
  },
  {
    name: "Langdock",
    slug: "langdock",
    priority: "medium",
    note: "Enterprise AI assistant platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.langdock.com/",
      linkedin: "https://www.linkedin.com/company/langdock/",
    },
  },
  {
    name: "Stack AI",
    slug: "stack-ai",
    priority: "medium",
    note: "AI workflow automation",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.stack-ai.com/",
      linkedin: "https://www.linkedin.com/company/stackai/",
    },
  },
  {
    name: "FlowHunt",
    slug: "flowhunt",
    priority: "medium",
    note: "AI workflow builder",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.flowhunt.io/",
      linkedin: "https://www.linkedin.com/company/flowhunt/",
    },
  },
  {
    name: "Lyzr",
    slug: "lyzr",
    priority: "medium",
    note: "Enterprise AI agent platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.lyzr.ai/",
      linkedin: "https://www.linkedin.com/company/lyzr-platform/",
    },
  },
  {
    name: "Relevance AI",
    slug: "relevance-ai",
    priority: "medium",
    note: "AI workforce platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://relevanceai.com/",
      linkedin: "https://www.linkedin.com/company/relevanceai/",
    },
  },
  {
    name: "Sana AI",
    slug: "sana-ai",
    priority: "medium",
    note: "Enterprise AI learning platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://sana.ai/",
      linkedin: "https://www.linkedin.com/company/sana/",
    },
  },
  {
    name: "Airia",
    slug: "airia",
    priority: "medium",
    note: "Enterprise AI orchestration",
    type: "MCP-First Startups",
    urls: {
      website: "https://airia.com/",
      linkedin: "https://www.linkedin.com/company/airia-enterprise-ai/",
    },
  },
  {
    name: "UnifyApps",
    slug: "unifyapps",
    priority: "medium",
    note: "AI integration platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.unifyapps.com/",
      linkedin: "https://www.linkedin.com/company/unifyapps/",
    },
  },
  {
    name: "LangChain",
    slug: "langchain",
    priority: "high",
    note: "Major agent framework, LangGraph, LangSmith",
    type: "MCP-First Startups",
    urls: {
      blog: "https://blog.langchain.com",
      linkedin: "https://www.linkedin.com/company/langchain/",
    },
  },
  {
    name: "LlamaIndex",
    slug: "llamaindex",
    priority: "high",
    note: "RAG and agent framework, LlamaCloud",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.llamaindex.ai/blog",
      linkedin: "https://www.linkedin.com/company/llamaindex/",
    },
  },
  {
    name: "Composio",
    slug: "composio",
    priority: "high",
    note: "Tool/integration platform for AI agents",
    type: "MCP-First Startups",
    urls: {
      blog: "https://composio.dev/blog",
      linkedin: "https://www.linkedin.com/company/composio-dev/",
    },
  },
  {
    name: "Dify",
    slug: "dify",
    priority: "high",
    note: "Open source LLM app platform with MCP support",
    type: "MCP-First Startups",
    urls: {
      blog: "https://dify.ai/blog",
      linkedin: "https://www.linkedin.com/company/difyai/",
    },
  },
  {
    name: "Flowise",
    slug: "flowise",
    priority: "medium",
    note: "Open source no-code LLM orchestration",
    type: "MCP-First Startups",
    urls: {
      website: "https://flowiseai.com/",
      linkedin: "https://www.linkedin.com/company/flowiseai/",
    },
  },
];

// AI Observability & Evaluation
const aiObservabilitySources: SourceData[] = [
  {
    name: "Langfuse",
    slug: "langfuse",
    priority: "high",
    note: "Open source LLM observability, has MCP server",
    type: "MCP-First Startups",
    urls: {
      blog: "https://langfuse.com/blog",
      linkedin: "https://www.linkedin.com/company/langfuse/",
    },
  },
  {
    name: "Arize AI",
    slug: "arize",
    priority: "high",
    note: "ML/LLM observability, Phoenix open source",
    type: "MCP-First Startups",
    urls: {
      blog: "https://arize.com/blog",
      linkedin: "https://www.linkedin.com/company/arizeai/",
    },
  },
  {
    name: "Helicone",
    slug: "helicone",
    priority: "high",
    note: "LLM observability and analytics",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.helicone.ai/blog",
      linkedin: "https://www.linkedin.com/company/helicone/",
    },
  },
  {
    name: "Braintrust",
    slug: "braintrust",
    priority: "high",
    note: "AI evaluation platform with MCP support",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.braintrust.dev/blog",
      linkedin: "https://www.linkedin.com/company/braintrustdata/",
    },
  },
  {
    name: "Patronus AI",
    slug: "patronus-ai",
    priority: "high",
    note: "AI evaluation and red teaming, has MCP server",
    type: "MCP-First Startups",
    urls: {
      blog: "https://www.patronus.ai/blog",
      linkedin: "https://www.linkedin.com/company/patronus-ai/",
    },
  },
  {
    name: "Portkey",
    slug: "portkey",
    priority: "high",
    note: "AI gateway and observability",
    type: "MCP-First Startups",
    urls: {
      blog: "https://portkey.ai/blog",
      linkedin: "https://www.linkedin.com/company/portkey/",
    },
  },
];

// Low-Code Platforms
const lowCodeSources: SourceData[] = [
  {
    name: "Retool",
    slug: "retool",
    priority: "high",
    note: "Internal tools platform with MCP support",
    type: "MCP-First Startups",
    urls: {
      blog: "https://retool.com/blog",
      linkedin: "https://www.linkedin.com/company/tryretool/",
    },
  },
  {
    name: "Appsmith",
    slug: "appsmith",
    priority: "medium",
    note: "Open source internal tools builder",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.appsmith.com/",
      linkedin: "https://www.linkedin.com/company/appsmith/",
    },
  },
  {
    name: "Superblocks",
    slug: "superblocks",
    priority: "medium",
    note: "Enterprise internal tools platform",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.superblocks.com/",
      linkedin: "https://www.linkedin.com/company/superblockshq/",
    },
  },
  {
    name: "UI Bakery",
    slug: "uibakery",
    priority: "medium",
    note: "Low-code internal tools",
    type: "MCP-First Startups",
    urls: {
      website: "https://uibakery.io/",
      linkedin: "https://www.linkedin.com/company/uibakery/",
    },
  },
  {
    name: "Glide",
    slug: "glide",
    priority: "medium",
    note: "No-code app builder",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.glideapps.com/",
      linkedin: "https://www.linkedin.com/company/glideapps/",
    },
  },
  {
    name: "Refine",
    slug: "refine",
    priority: "medium",
    note: "Open source React framework for admin panels",
    type: "MCP-First Startups",
    urls: {
      website: "https://refine.dev/",
      linkedin: "https://www.linkedin.com/company/refine-dev/",
    },
  },
  {
    name: "Pipefy",
    slug: "pipefy",
    priority: "medium",
    note: "Business process automation",
    type: "MCP-First Startups",
    urls: {
      website: "https://www.pipefy.com/",
      linkedin: "https://www.linkedin.com/company/pipefy/",
    },
  },
];

// Developer Tools & IDE
const devToolsSources: SourceData[] = [
  {
    name: "Continue",
    slug: "continue",
    priority: "high",
    note: "Open source AI coding assistant with MCP",
    type: "Trendsetter",
    urls: {
      blog: "https://blog.continue.dev",
      linkedin: "https://www.linkedin.com/company/continuedev/",
    },
  },
  {
    name: "Augment Code",
    slug: "augment-code",
    priority: "high",
    note: "AI coding assistant for enterprise",
    type: "Trendsetter",
    urls: {
      blog: "https://www.augmentcode.com/blog",
      linkedin: "https://www.linkedin.com/company/augment-code/",
    },
  },
  {
    name: "Cursor",
    slug: "cursor",
    priority: "critical",
    note: "AI-first IDE, major MCP adopter",
    type: "Trendsetter",
    urls: {
      blog: "https://cursor.com/blog",
      linkedin: "https://www.linkedin.com/company/cursor-ai/",
    },
  },
  {
    name: "Windsurf (Codeium)",
    slug: "windsurf",
    priority: "high",
    note: "AI IDE with agent features, acquired by Cognition",
    type: "Trendsetter",
    urls: {
      blog: "https://windsurf.com/blog",
      linkedin: "https://www.linkedin.com/company/codeium/",
    },
  },
  {
    name: "Cline (Claude Dev)",
    slug: "cline",
    priority: "high",
    note: "Popular VS Code extension with heavy MCP usage",
    type: "Trendsetter",
    urls: {
      website: "https://cline.bot/",
    },
  },
  {
    name: "Sourcegraph Cody",
    slug: "sourcegraph-cody",
    priority: "medium",
    note: "AI coding assistant",
    type: "Trendsetter",
    urls: {
      blog: "https://sourcegraph.com/blog",
      linkedin: "https://www.linkedin.com/company/sourcegraph/",
    },
  },
  {
    name: "Bolt.new (StackBlitz)",
    slug: "bolt-new",
    priority: "high",
    note: "AI web app builder",
    type: "Trendsetter",
    urls: {
      blog: "https://bolt.new/blog",
      linkedin: "https://www.linkedin.com/company/stackblitz/",
    },
  },
  {
    name: "Lovable",
    slug: "lovable",
    priority: "high",
    note: "AI app builder",
    type: "Trendsetter",
    urls: {
      blog: "https://lovable.dev/blog",
      linkedin: "https://www.linkedin.com/company/lovable-dev/",
    },
  },
  {
    name: "Replit",
    slug: "replit",
    priority: "medium",
    note: "Browser-based IDE with AI agent features",
    type: "Trendsetter",
    urls: {
      blog: "https://blog.replit.com/",
      linkedin: "https://www.linkedin.com/company/replit/",
    },
  },
  {
    name: "E2B",
    slug: "e2b",
    priority: "high",
    note: "Code interpreters/sandboxes for AI agents",
    type: "MCP-First Startups",
    urls: {
      blog: "https://e2b.dev/blog",
      linkedin: "https://www.linkedin.com/company/e2b-dev/",
    },
  },
];

// Security & Governance
const securitySources: SourceData[] = [
  {
    name: "Lasso Security",
    slug: "lasso-security",
    priority: "high",
    note: "LLM and AI cybersecurity, MCP security research",
    type: "Enterprise",
    urls: {
      blog: "https://www.lasso.security/blog",
      linkedin: "https://www.linkedin.com/company/lasso-security/",
    },
  },
  {
    name: "WorkOS",
    slug: "workos",
    priority: "high",
    note: "Enterprise auth, Agentic AI Foundation founding member",
    type: "Enterprise",
    urls: {
      blog: "https://workos.com/blog",
      linkedin: "https://www.linkedin.com/company/workos/",
    },
  },
  {
    name: "Protect AI",
    slug: "protect-ai",
    priority: "high",
    note: "AI/ML security platform",
    type: "Enterprise",
    urls: {
      blog: "https://protectai.com/blog",
      linkedin: "https://www.linkedin.com/company/protect-ai/",
    },
  },
  {
    name: "HiddenLayer",
    slug: "hiddenlayer",
    priority: "high",
    note: "AI threat detection and security",
    type: "Enterprise",
    urls: {
      blog: "https://hiddenlayer.com/innovation-hub/",
      linkedin: "https://www.linkedin.com/company/hiddenlayersec/",
    },
  },
];

// AI Infrastructure
const aiInfraSources: SourceData[] = [
  {
    name: "Groq",
    slug: "groq",
    priority: "high",
    note: "Ultra-fast LPU inference",
    type: "Enterprise",
    urls: {
      blog: "https://groq.com/blog",
      linkedin: "https://www.linkedin.com/company/groq-inc/",
    },
  },
  {
    name: "Together AI",
    slug: "together-ai",
    priority: "high",
    note: "Open model inference and training",
    type: "Enterprise",
    urls: {
      blog: "https://www.together.ai/blog",
      linkedin: "https://www.linkedin.com/company/togetherai/",
    },
  },
  {
    name: "Modal",
    slug: "modal",
    priority: "high",
    note: "Serverless cloud for AI workloads",
    type: "Enterprise",
    urls: {
      blog: "https://modal.com/blog",
      linkedin: "https://www.linkedin.com/company/modal-labs/",
    },
  },
  {
    name: "Fireworks AI",
    slug: "fireworks-ai",
    priority: "medium",
    note: "Fast AI inference platform",
    type: "Enterprise",
    urls: {
      blog: "https://fireworks.ai/blog",
      linkedin: "https://www.linkedin.com/company/fireworks-ai/",
    },
  },
  {
    name: "Replicate",
    slug: "replicate",
    priority: "medium",
    note: "AI model hosting and inference",
    type: "Enterprise",
    urls: {
      blog: "https://replicate.com/blog",
      linkedin: "https://www.linkedin.com/company/replicate-ai/",
    },
  },
];

// Analyst Firms
const analystSources: SourceData[] = [
  {
    name: "Gartner",
    slug: "gartner",
    priority: "high",
    note: "Leading IT analyst firm - Hype Cycles, Magic Quadrants",
    type: "Enterprise",
    urls: {
      website: "https://www.gartner.com/en/ai",
      linkedin: "https://www.linkedin.com/company/gartner/",
    },
  },
  {
    name: "IDC",
    slug: "idc",
    priority: "high",
    note: "IT market intelligence and advisory",
    type: "Enterprise",
    urls: {
      blog: "https://blogs.idc.com/",
      linkedin: "https://www.linkedin.com/company/idc/",
    },
  },
  {
    name: "Forrester",
    slug: "forrester",
    priority: "high",
    note: "Technology and market research",
    type: "Enterprise",
    urls: {
      website: "https://www.forrester.com/blogs/category/artificial-intelligence-ai",
      linkedin: "https://www.linkedin.com/company/forrester-research/",
    },
  },
  {
    name: "McKinsey",
    slug: "mckinsey",
    priority: "high",
    note: "Management consulting with strong AI research",
    type: "Enterprise",
    urls: {
      website: "https://www.mckinsey.com/featured-insights/artificial-intelligence",
      linkedin: "https://www.linkedin.com/company/mckinsey/",
    },
  },
  {
    name: "CB Insights",
    slug: "cb-insights",
    priority: "high",
    note: "Tech market intelligence, AI 100 list",
    type: "Enterprise",
    urls: {
      website: "https://www.cbinsights.com/research/artificial-intelligence",
      linkedin: "https://www.linkedin.com/company/cb-insights/",
    },
  },
];

// VC Thought Leadership
const vcSources: SourceData[] = [
  {
    name: "Andreessen Horowitz (a16z)",
    slug: "a16z",
    priority: "high",
    note: "Major AI investor, AI Fund, thought leadership",
    type: "Trendsetter",
    urls: {
      website: "https://a16z.com/ai",
      linkedin: "https://www.linkedin.com/company/a16z/",
    },
  },
  {
    name: "Sequoia Capital",
    slug: "sequoia",
    priority: "high",
    note: "Major AI investor, AI 50 list",
    type: "Trendsetter",
    urls: {
      website: "https://sequoiacap.com/",
      linkedin: "https://www.linkedin.com/company/sequoia-capital/",
    },
  },
  {
    name: "Greylock Partners",
    slug: "greylock",
    priority: "medium",
    note: "AI investor, Greymatter blog",
    type: "Trendsetter",
    urls: {
      blog: "https://greylock.com/greymatter/",
      linkedin: "https://www.linkedin.com/company/greylock-partners/",
    },
  },
  {
    name: "Index Ventures",
    slug: "index-ventures",
    priority: "medium",
    note: "AI and developer tools investor",
    type: "Trendsetter",
    urls: {
      website: "https://www.indexventures.com/",
      linkedin: "https://www.linkedin.com/company/index-ventures/",
    },
  },
  {
    name: "Lightspeed Venture Partners",
    slug: "lightspeed",
    priority: "medium",
    note: "AI investor",
    type: "Trendsetter",
    urls: {
      website: "https://lsvp.com/",
      linkedin: "https://www.linkedin.com/company/lightspeed-venture-partners/",
    },
  },
];

// Reddit Sources
const redditSources: { name: string; subreddit: string; priority: string; note: string; type: BlogType }[] = [
  {
    name: "r/mcp - Model Context Protocol",
    subreddit: "mcp",
    priority: "critical",
    note: "Main MCP subreddit",
    type: "Community",
  },
  {
    name: "r/LocalLLaMA",
    subreddit: "LocalLLaMA",
    priority: "high",
    note: "Local LLM community, MCP discussions",
    type: "Community",
  },
  {
    name: "r/LLMDevs",
    subreddit: "LLMDevs",
    priority: "high",
    note: "LLM developers community",
    type: "Community",
  },
  {
    name: "r/AI_Agents",
    subreddit: "AI_Agents",
    priority: "high",
    note: "AI agents community",
    type: "Community",
  },
  {
    name: "r/MachineLearning",
    subreddit: "MachineLearning",
    priority: "medium",
    note: "ML research and discussion",
    type: "Community",
  },
  {
    name: "r/artificial",
    subreddit: "artificial",
    priority: "medium",
    note: "General AI discussion",
    type: "Community",
  },
  {
    name: "r/ChatGPT",
    subreddit: "ChatGPT",
    priority: "medium",
    note: "ChatGPT community, AI tools discussions",
    type: "Community",
  },
  {
    name: "r/ClaudeAI",
    subreddit: "ClaudeAI",
    priority: "high",
    note: "Claude AI community - MCP relevant",
    type: "Community",
  },
  {
    name: "r/singularity",
    subreddit: "singularity",
    priority: "low",
    note: "AI future discussions",
    type: "Community",
  },
];

// =============================================================================
// Seed Functions
// =============================================================================

async function seedBlogs(sources: SourceData[]): Promise<void> {
  const existingBlogs = await listBlogs();
  const existingUrls = new Set(existingBlogs.map((b) => b.url));

  for (const source of sources) {
    const blogUrl = source.urls.blog || source.urls.website;
    if (!blogUrl) continue;

    if (existingUrls.has(blogUrl)) {
      console.log(`⏭️  Blog já existe: ${source.name}`);
      continue;
    }

    try {
      await createBlog({
        name: source.name,
        url: blogUrl,
        feed_url: null,
        authority: priorityToAuthority(source.priority),
        type: source.type,
      });
      console.log(`✅ Blog criado: ${source.name}`);
    } catch (error) {
      console.error(`❌ Erro ao criar blog ${source.name}:`, error);
    }
  }
}

async function seedLinkedInSources(sources: SourceData[]): Promise<void> {
  const existingSources = await listLinkedInSources(false);
  const existingUrls = new Set(existingSources.map((s) => s.profile_url));

  for (const source of sources) {
    const linkedinUrl = source.urls.linkedin;
    if (!linkedinUrl) continue;

    if (existingUrls.has(linkedinUrl)) {
      console.log(`⏭️  LinkedIn já existe: ${source.name}`);
      continue;
    }

    try {
      await createLinkedInSource({
        name: source.name,
        profile_url: linkedinUrl,
        authority: priorityToAuthority(source.priority),
        type: source.type,
        active: true,
      });
      console.log(`✅ LinkedIn criado: ${source.name}`);
    } catch (error) {
      console.error(`❌ Erro ao criar LinkedIn ${source.name}:`, error);
    }
  }
}

async function seedRedditSources(): Promise<void> {
  const existingSources = await listRedditSources(false);
  const existingSubreddits = new Set(existingSources.map((s) => s.subreddit.toLowerCase()));

  for (const source of redditSources) {
    if (existingSubreddits.has(source.subreddit.toLowerCase())) {
      console.log(`⏭️  Reddit já existe: r/${source.subreddit}`);
      continue;
    }

    try {
      await createRedditSource({
        name: source.name,
        subreddit: source.subreddit,
        authority: priorityToAuthority(source.priority),
        type: source.type,
        active: true,
      });
      console.log(`✅ Reddit criado: r/${source.subreddit}`);
    } catch (error) {
      console.error(`❌ Erro ao criar Reddit r/${source.subreddit}:`, error);
    }
  }
}

// =============================================================================
// Main Seed Function
// =============================================================================

export async function seedAllSources(): Promise<void> {
  console.log("\n🌱 Iniciando seed de fontes...\n");

  // Combinar todas as fontes
  const allSources: SourceData[] = [
    ...bigTechSources,
    ...mcpGatewaysSources,
    ...agentFrameworksSources,
    ...aiObservabilitySources,
    ...lowCodeSources,
    ...devToolsSources,
    ...securitySources,
    ...aiInfraSources,
    ...analystSources,
    ...vcSources,
  ];

  console.log("📝 Criando fontes de Blog...");
  await seedBlogs(allSources);

  console.log("\n💼 Criando fontes de LinkedIn...");
  await seedLinkedInSources(allSources);

  console.log("\n🤖 Criando fontes de Reddit...");
  await seedRedditSources();

  console.log("\n✨ Seed concluído!\n");

  // Estatísticas
  const blogs = await listBlogs();
  const linkedinSources = await listLinkedInSources(false);
  const redditSourcesList = await listRedditSources(false);

  console.log("📊 Estatísticas:");
  console.log(`   - Blogs: ${blogs.length}`);
  console.log(`   - LinkedIn: ${linkedinSources.length}`);
  console.log(`   - Reddit: ${redditSourcesList.length}`);
}

// Executar se chamado diretamente
if (import.meta.main) {
  await seedAllSources();
}

