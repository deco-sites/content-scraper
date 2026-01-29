// =============================================================================
// BlogManager Island - Componente interativo para gerenciar blogs
// =============================================================================

import { useState } from "preact/hooks";
import type { Blog, BlogType } from "../lib/types.ts";

interface BlogWithCount extends Blog {
  articles_count: number;
}

interface BlogManagerProps {
  initialBlogs: BlogWithCount[];
}

const BLOG_TYPES: BlogType[] = [
  "MCP-First Startups",
  "Enterprise",
  "Trendsetter",
  "Community",
];

const TYPE_COLORS: Record<BlogType, string> = {
  "MCP-First Startups": "#00d4ff",
  "Enterprise": "#a855f7",
  "Trendsetter": "#ec4899",
  "Community": "#22c55e",
};

export default function BlogManager({ initialBlogs }: BlogManagerProps) {
  const [blogs, setBlogs] = useState<BlogWithCount[]>(initialBlogs);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState<BlogWithCount | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isScraping, setIsScraping] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    feed_url: "",
    type: "Community" as BlogType,
    authority: 50,
  });

  const resetForm = () => {
    setFormData({
      name: "",
      url: "",
      feed_url: "",
      type: "Community",
      authority: 50,
    });
    setEditingBlog(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (blog: BlogWithCount) => {
    setEditingBlog(blog);
    setFormData({
      name: blog.name,
      url: blog.url,
      feed_url: blog.feed_url || "",
      type: blog.type,
      authority: Math.round(blog.authority * 100),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        name: formData.name,
        url: formData.url,
        feed_url: formData.feed_url || null,
        type: formData.type,
        authority: formData.authority / 100,
      };

      let response: Response;
      if (editingBlog) {
        response = await fetch(`/api/blogs/${editingBlog.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        response = await fetch("/api/blogs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Erro ao salvar blog");
        return;
      }

      // Recarrega a lista de blogs
      const blogsResponse = await fetch("/api/blogs");
      const updatedBlogs = await blogsResponse.json();
      setBlogs(updatedBlogs);

      closeModal();
    } catch (error) {
      console.error("Error saving blog:", error);
      alert("Erro ao salvar blog");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (blog: BlogWithCount) => {
    if (!confirm(`Tem certeza que deseja excluir "${blog.name}"? Todos os artigos associados também serão removidos.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/blogs/${blog.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        alert("Erro ao excluir blog");
        return;
      }

      setBlogs(blogs.filter((b) => b.id !== blog.id));
    } catch (error) {
      console.error("Error deleting blog:", error);
      alert("Erro ao excluir blog");
    }
  };

  const handleScrape = async (blogId?: string) => {
    setIsScraping(true);
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blogId ? { blog_id: blogId } : {}),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || "Erro no scraping");
        return;
      }

      const result = await response.json();
      alert(result.message);

      // Recarrega blogs para atualizar contagem de artigos
      const blogsResponse = await fetch("/api/blogs");
      const updatedBlogs = await blogsResponse.json();
      setBlogs(updatedBlogs);
    } catch (error) {
      console.error("Error scraping:", error);
      alert("Erro no scraping");
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div>
      <style>{`
        .blog-manager {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          overflow: hidden;
        }

        .manager-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
        }

        .manager-title {
          font-size: 18px;
          font-weight: 600;
        }

        .header-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 20px;
          border-radius: 10px;
          border: none;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
        }

        .btn-secondary {
          background: var(--bg-secondary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
        }

        .btn-secondary:hover:not(:disabled) {
          border-color: var(--accent-cyan);
        }

        .btn-ghost {
          background: transparent;
          color: var(--text-secondary);
          padding: 8px;
        }

        .btn-ghost:hover {
          color: var(--text-primary);
          background: var(--bg-secondary);
        }

        .btn-danger {
          background: transparent;
          color: #ef4444;
          padding: 8px;
        }

        .btn-danger:hover {
          background: rgba(239, 68, 68, 0.1);
        }

        /* Table */
        .blog-table {
          width: 100%;
          border-collapse: collapse;
        }

        .blog-table th {
          text-align: left;
          padding: 16px 24px;
          font-size: 12px;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
          border-bottom: 1px solid var(--border-color);
        }

        .blog-table td {
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: middle;
        }

        .blog-table tr:hover td {
          background: var(--bg-card-hover);
        }

        .blog-name {
          font-weight: 500;
          margin-bottom: 4px;
        }

        .blog-url {
          font-size: 13px;
          color: var(--text-muted);
          font-family: 'JetBrains Mono', monospace;
        }

        .blog-url a {
          color: var(--text-muted);
          text-decoration: none;
        }

        .blog-url a:hover {
          color: var(--accent-cyan);
        }

        .badge {
          display: inline-block;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid;
        }

        .authority-bar {
          width: 100px;
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .authority-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s;
        }

        .authority-value {
          font-size: 13px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--text-secondary);
        }

        .articles-count {
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-purple);
        }

        .actions-cell {
          display: flex;
          gap: 4px;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .modal {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-header {
          padding: 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 18px;
          font-weight: 600;
        }

        .modal-body {
          padding: 24px;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 8px;
        }

        .form-input {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          transition: border-color 0.2s;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .form-select {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          color: var(--text-primary);
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          cursor: pointer;
        }

        .form-select:focus {
          outline: none;
          border-color: var(--accent-cyan);
        }

        .slider-container {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .slider {
          flex: 1;
          -webkit-appearance: none;
          height: 8px;
          background: var(--bg-secondary);
          border-radius: 4px;
          outline: none;
        }

        .slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 20px;
          height: 20px;
          background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-purple) 100%);
          border-radius: 50%;
          cursor: pointer;
        }

        .slider-value {
          font-family: 'JetBrains Mono', monospace;
          font-size: 14px;
          color: var(--accent-cyan);
          min-width: 48px;
          text-align: right;
        }

        .modal-footer {
          padding: 24px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .empty-state {
          text-align: center;
          padding: 60px 24px;
          color: var(--text-muted);
        }

        .empty-state-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
      `}</style>

      <div class="blog-manager">
        <div class="manager-header">
          <h2 class="manager-title">Blogs Monitorados</h2>
          <div class="header-actions">
            <button
              class="btn btn-secondary"
              onClick={() => handleScrape()}
              disabled={isScraping}
            >
              {isScraping ? "⏳ Executando..." : "🔄 Executar Scraping"}
            </button>
            <button class="btn btn-primary" onClick={openCreateModal}>
              ➕ Adicionar Blog
            </button>
          </div>
        </div>

        {blogs.length === 0 ? (
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <p>Nenhum blog cadastrado ainda</p>
            <p>Adicione blogs para começar a monitorar artigos sobre MCP</p>
          </div>
        ) : (
          <table class="blog-table">
            <thead>
              <tr>
                <th>Blog</th>
                <th>Tipo</th>
                <th>Authority</th>
                <th>Artigos</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {blogs.map((blog) => (
                <tr key={blog.id}>
                  <td>
                    <div class="blog-name">{blog.name}</div>
                    <div class="blog-url">
                      <a href={blog.url} target="_blank" rel="noopener">
                        {blog.url.replace(/^https?:\/\//, "").slice(0, 40)}
                        {blog.url.length > 50 ? "..." : ""}
                      </a>
                    </div>
                  </td>
                  <td>
                    <span
                      class="badge"
                      style={{
                        color: TYPE_COLORS[blog.type],
                        borderColor: TYPE_COLORS[blog.type],
                        backgroundColor: `${TYPE_COLORS[blog.type]}15`,
                      }}
                    >
                      {blog.type}
                    </span>
                  </td>
                  <td>
                    <div class="authority-bar">
                      <div
                        class="authority-fill"
                        style={{
                          width: `${blog.authority * 100}%`,
                          background: `linear-gradient(90deg, var(--accent-cyan) 0%, var(--accent-purple) 100%)`,
                        }}
                      />
                    </div>
                    <div class="authority-value">{(blog.authority * 100).toFixed(0)}%</div>
                  </td>
                  <td>
                    <span class="articles-count">{blog.articles_count}</span>
                  </td>
                  <td>
                    <div class="actions-cell">
                      <button
                        class="btn btn-ghost"
                        onClick={() => openEditModal(blog)}
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        class="btn btn-danger"
                        onClick={() => handleDelete(blog)}
                        title="Excluir"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div class="modal-overlay" onClick={closeModal}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <h3 class="modal-title">
                {editingBlog ? "Editar Blog" : "Adicionar Blog"}
              </h3>
              <button class="btn btn-ghost" onClick={closeModal}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div class="modal-body">
                <div class="form-group">
                  <label class="form-label">Nome do Blog *</label>
                  <input
                    type="text"
                    class="form-input"
                    value={formData.name}
                    onInput={(e) =>
                      setFormData({ ...formData, name: (e.target as HTMLInputElement).value })
                    }
                    placeholder="Ex: Anthropic Blog"
                    required
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">URL do Blog *</label>
                  <input
                    type="url"
                    class="form-input"
                    value={formData.url}
                    onInput={(e) =>
                      setFormData({ ...formData, url: (e.target as HTMLInputElement).value })
                    }
                    placeholder="https://exemplo.com/blog"
                    required
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Feed URL (opcional)</label>
                  <input
                    type="url"
                    class="form-input"
                    value={formData.feed_url}
                    onInput={(e) =>
                      setFormData({ ...formData, feed_url: (e.target as HTMLInputElement).value })
                    }
                    placeholder="https://exemplo.com/feed.xml"
                  />
                </div>

                <div class="form-group">
                  <label class="form-label">Tipo de Fonte</label>
                  <select
                    class="form-select"
                    value={formData.type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: (e.target as HTMLSelectElement).value as BlogType,
                      })
                    }
                  >
                    {BLOG_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div class="form-group">
                  <label class="form-label">Authority</label>
                  <div class="slider-container">
                    <input
                      type="range"
                      class="slider"
                      min="0"
                      max="100"
                      value={formData.authority}
                      onInput={(e) =>
                        setFormData({
                          ...formData,
                          authority: parseInt((e.target as HTMLInputElement).value),
                        })
                      }
                    />
                    <span class="slider-value">{formData.authority}%</span>
                  </div>
                </div>
              </div>

              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onClick={closeModal}>
                  Cancelar
                </button>
                <button type="submit" class="btn btn-primary" disabled={isLoading}>
                  {isLoading ? "Salvando..." : editingBlog ? "Salvar Alterações" : "Adicionar Blog"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

