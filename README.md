# 📡 Blog Scraper MCP

Sistema automatizado de monitoramento e curadoria de artigos sobre **MCP (Model Context Protocol)** e tópicos relacionados a IA/LLM.

O sistema faz scraping de blogs técnicos, analisa o conteúdo usando LLM para determinar relevância, e gera relatórios semanais com os melhores artigos rankeados por qualidade.

## ✨ Funcionalidades

- **Gerenciamento de Blogs**: Cadastre fontes de conteúdo com metadados e scores de autoridade
- **Scraping Inteligente**: Extração automática de artigos usando LLM para identificar conteúdo relevante
- **Análise de Qualidade**: Cada artigo é analisado por Claude para determinar relevância e qualidade
- **Sistema de Pontuação**: Combina qualidade do conteúdo (70%) + autoridade da fonte (30%)
- **Relatórios Semanais**: Visualize os melhores artigos da semana ordenados por score
- **Interface Web Moderna**: Dashboard completo para gerenciar blogs e visualizar relatórios
- **CLI Completo**: Comandos para todas as operações (seed, scrape, report, etc.)
- **Execução Agendada**: Suporte a cron jobs para scraping automático

## 🚀 Quick Start

### Pré-requisitos

- [Deno](https://deno.land/) 1.40+
- Chave de API do [OpenRouter](https://openrouter.ai/)

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o .env e adicione sua OPENROUTER_API_KEY
```

Ou exporte diretamente:

```bash
export OPENROUTER_API_KEY="sua-chave-aqui"
```

### 2. Popular o banco com blogs iniciais

```bash
deno task scraper:seed
```

### 3. Executar o scraping

```bash
deno task scraper:dev
```

### 4. Iniciar a interface web

```bash
deno task dev
```

Acesse: http://localhost:8000

## 📋 Comandos CLI

| Comando | Descrição |
|---------|-----------|
| `deno task scraper seed` | Popula banco com blogs iniciais |
| `deno task scraper dev` | Executa scraping uma vez |
| `deno task scraper cron` | Inicia job agendado |
| `deno task scraper report [week]` | Gera relatório da semana |
| `deno task scraper list` | Lista todos os blogs |
| `deno task scraper set-authority <id> <value>` | Ajusta authority de um blog |
| `deno task scraper help` | Mostra ajuda |

### Exemplos

```bash
# Gerar relatório da semana atual
deno task scraper:report

# Gerar relatório de uma semana específica
deno task scraper report 2026-w04

# Ajustar authority de um blog
deno task scraper set-authority abc123 0.8
```

## 🌐 API REST

### Blogs

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/blogs` | Lista todos os blogs |
| GET | `/api/blogs/:id` | Obtém blog específico |
| POST | `/api/blogs` | Cria novo blog |
| PUT | `/api/blogs/:id` | Atualiza blog |
| DELETE | `/api/blogs/:id` | Remove blog |
| GET | `/api/blogs/:id/articles` | Lista artigos do blog |

### Artigos

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/articles` | Lista artigos recentes |
| GET | `/api/articles?week=YYYY-wWW` | Filtra por semana |

### Outros

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/types` | Lista tipos de blog |
| GET | `/api/stats` | Estatísticas do dashboard |
| POST | `/api/scrape` | Executa scraping manualmente |

## 📊 Sistema de Pontuação

O **post_score** final é calculado combinando:

```
post_score = (quality_score × 0.7) + (authority × 0.3)
```

- **quality_score** (0.0-1.0): Avaliado pelo LLM baseado em:
  - Qualidade da escrita
  - Profundidade técnica
  - Valor prático
  - Relevância ao MCP/AI

- **authority** (0.0-1.0): Score de confiança da fonte

## 🏷️ Tipos de Blog

| Tipo | Cor | Descrição |
|------|-----|-----------|
| MCP-First Startups | 🔵 Cyan | Startups focadas em MCP |
| Enterprise | 🟣 Purple | Empresas estabelecidas |
| Trendsetter | 🩷 Pink | Líderes de opinião |
| Community | 🟢 Green | Blogs independentes |

## 📁 Estrutura do Projeto

```
content-scraper/
├── lib/
│   ├── types.ts      # Definições de tipos
│   ├── db.ts         # Operações com Deno KV
│   ├── llm.ts        # Integração com OpenRouter
│   ├── scraper.ts    # Sistema de scraping
│   ├── seed.ts       # Dados iniciais
│   └── utils.ts      # Utilitários
├── routes/
│   ├── api/
│   │   ├── blogs/    # API de blogs
│   │   ├── articles.ts
│   │   ├── types.ts
│   │   ├── stats.ts
│   │   └── scrape.ts
│   ├── index.tsx     # Dashboard principal
│   └── report.tsx    # Relatório semanal
├── islands/
│   └── BlogManager.tsx  # Componente interativo
├── cli.ts            # Interface de linha de comando
└── deno.json         # Configuração do projeto
```

## 🔧 Configuração

### Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `OPENROUTER_API_KEY` | Chave da API OpenRouter | (obrigatória) |
| `CRON_SCHEDULE` | Expressão cron | `0 8 * * *` |
| `PORT` | Porta do servidor | `3000` |

### Modelo LLM

O sistema usa Claude Sonnet via OpenRouter:

- **Modelo**: `anthropic/claude-sonnet-4`
- **Temperature**: 0.3
- **Max Tokens**: 4000

## 🗓️ Organização Temporal

Artigos são categorizados por **semana de publicação** no formato ISO: `YYYY-wWW`

Exemplo: `2026-w04` = Quarta semana de 2026

## 🛡️ Rate Limiting

Para evitar bloqueios e sobrecarga:

- 2 segundos entre blogs
- 500ms entre artigos
- Retry com backoff exponencial (1s, 2s, 3s)
- User-Agent simulando browser real

## 📝 License

MIT

---

Feito com 💜 para a comunidade [MCP](https://modelcontextprotocol.io)
