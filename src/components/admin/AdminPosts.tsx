// src/components/admin/AdminPosts.tsx
import React, { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import useAdminToken from "./useAdminToken";

type PostStatus = "draft" | "published";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  tags: string[];
  status: PostStatus;
  content_md: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type DraftPost = {
  title: string;
  slug: string;
  excerpt: string;
  cover_url: string;
  tags: string[] | string;
  status: PostStatus;
  content_md: string;
};

const emptyPost = (): DraftPost => ({
  title: "",
  slug: "",
  excerpt: "",
  cover_url: "",
  tags: [],
  status: "draft",
  content_md: "",
});

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return "";
  }
}

function tagsToArray(tags: DraftPost["tags"]) {
  if (Array.isArray(tags)) return tags;
  return String(tags)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function AdminPosts() {
  const { token, email, loading, logout } = useAdminToken();

  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftPost>(emptyPost());
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showPreview, setShowPreview] = useState(false);

  // ✅ markdown preview html (string), computed async-safe
  const [previewHtml, setPreviewHtml] = useState<string>("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const html = await marked.parse(draft.content_md ?? "");
        if (!alive) return;
        setPreviewHtml(typeof html === "string" ? html : String(html));
      } catch {
        if (!alive) return;
        setPreviewHtml("<p>Couldn’t render preview.</p>");
      }
    })();

    return () => {
      alive = false;
    };
  }, [draft.content_md]);

  const api = useMemo(() => {
    return {
      async req(path: string, init?: RequestInit) {
        const res = await fetch(`/.netlify/functions/${path}`, {
          ...init,
          headers: {
            ...(init?.headers || {}),
            Authorization: `Bearer ${token ?? ""}`,
            "Content-Type": "application/json",
          },
        });

        const txt = await res.text();
        if (!res.ok) throw new Error(txt || `Request failed: ${res.status}`);
        return txt ? JSON.parse(txt) : null;
      },
    };
  }, [token]);

  function closeModal() {
    setModalOpen(false);
    setMode("view");
    setShowPreview(false);
  }

  function openModalView() {
    setMode("view");
    setModalOpen(true);
    setShowPreview(false);
  }

  async function loadList() {
    try {
      setErr(null);
      const data = await api.req("admin-posts");
      setPosts(Array.isArray(data?.posts) ? data.posts : []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load posts");
      setPosts([]);
    }
  }

  async function loadOne(id: string) {
    try {
      setErr(null);
      const data = await api.req(`admin-posts?id=${encodeURIComponent(id)}`);
      const p: Post = data?.post;
      if (!p?.id) throw new Error("Post not found");

      setActiveId(p.id);
      setDraft({
        title: p.title ?? "",
        slug: p.slug ?? "",
        cover_url: p.cover_url ?? "",
        excerpt: p.excerpt ?? "",
        tags: p.tags ?? [],
        status: p.status ?? "draft",
        content_md: p.content_md ?? "",
      });

      openModalView();
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load post");
    }
  }

  useEffect(() => {
    if (!token) return;
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function save(nextStatus?: PostStatus) {
    setSaving(true);
    try {
      setErr(null);

      const finalStatus = (nextStatus ?? draft.status) as PostStatus;

      const payload = {
        // IMPORTANT: this must match what your netlify function expects
        action: "upsert",
        post: {
          id: activeId ?? undefined,
          title: draft.title,
          slug: draft.slug,
          excerpt: draft.excerpt || null,
          cover_url: draft.cover_url || null,
          tags: tagsToArray(draft.tags),
          status: finalStatus,
          content_md: draft.content_md ?? "",
        },
      };

      const data = await api.req("admin-posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const saved: Post | null = data?.post ?? null;
      if (!saved?.id) throw new Error("Save succeeded but no post returned.");

      setPosts((prev) => {
        const next = [...prev];
        const idx = next.findIndex((x) => x.id === saved.id);
        if (idx >= 0) next[idx] = saved;
        else next.unshift(saved);

        // show newest first (published_at if present, else created_at)
        next.sort((a, b) =>
          (b.published_at || b.created_at || "").localeCompare(a.published_at || a.created_at || "")
        );
        return next;
      });

      setActiveId(saved.id);
      setDraft({
        title: saved.title ?? "",
        slug: saved.slug ?? "",
        cover_url: saved.cover_url ?? "",
        excerpt: saved.excerpt ?? "",
        tags: saved.tags ?? [],
        status: saved.status ?? "draft",
        content_md: saved.content_md ?? "",
      });

      setMode("view");
      setShowPreview(false);
      setModalOpen(true);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(next: PostStatus) {
    if (!activeId) return;
    setSaving(true);
    try {
      setErr(null);

      const payload = { action: "setStatus", id: activeId, status: next };
      await api.req("admin-posts", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      await loadList();
      await loadOne(activeId);
      setMode("view");
      setShowPreview(false);
    } catch (e: any) {
      setErr(e?.message ?? "Status update failed");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!activeId) return;
    if (!confirm("Delete this post?")) return;

    setSaving(true);
    try {
      setErr(null);

      const payload = { action: "delete", id: activeId };
      await api.req("admin-posts", { method: "POST", body: JSON.stringify(payload) });

      setPosts((prev) => prev.filter((p) => p.id !== activeId));
      setActiveId(null);
      setDraft(emptyPost());
      closeModal();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setActiveId(null);
    setDraft(emptyPost());
    setMode("edit");
    setModalOpen(true);
    setShowPreview(false);
  }

  if (loading) return <div className="adminState">Loading…</div>;

  if (!email) {
    return (
      <div className="adminState">
        <h2 className="h2">Not signed in</h2>
        <p className="muted">
          Go to <a href="/admin/login">/admin/login</a>
        </p>
      </div>
    );
  }

  return (
    <div className="adminShell">
      <div className="adminTopBar">
        <div className="muted">Signed in as {email}</div>

        <div className="adminTopActions">
          <a className="btn ghost" href="/admin/comments">
            Comments
          </a>
          <a className="btn ghost" href="/" target="_blank" rel="noreferrer">
            Public site
          </a>
          <button
            className="btn ghost"
            onClick={async () => {
              await logout();
              window.location.href = "/admin/login";
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {err && <div className="adminNotice error">{err}</div>}

      <div className="adminGrid">
        <div className="adminLeft">
          <div className="adminLeftHeader">
            <h3 className="h3">Posts</h3>
            <button className="btn" onClick={startNew}>
              + New
            </button>
          </div>

          <div className="adminCards">
            {posts.length === 0 ? (
              <div className="adminEmpty">No posts yet.</div>
            ) : (
              posts.map((p) => (
                <button key={p.id} className="postCard" onClick={() => loadOne(p.id)} type="button">
                  <div className="postCardTop">
                    <div className="postCardTitle postCardTitle--big">{p.title || "Untitled"}</div>
                    <span className={`pill ${p.status === "published" ? "pillGood" : "pillWarn"}`}>
                      {p.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="postCardMeta">
                    <span className="mono">/posts/{p.slug || "…"}</span>
                    <span className="dot">•</span>
                    <span>{fmtDate(p.published_at || p.created_at)}</span>
                  </div>

                  {p.excerpt ? <div className="postCardExcerpt">{p.excerpt}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="adminRight">
          <div className="adminHint">
            Select a post to manage it. Use <span className="mono">+ New</span> to create one.
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modalOverlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modalHeader">
              <div>
                <div className="modalKicker">{activeId ? "Post" : "New post"}</div>
                <div className="modalTitle modalTitle--big">{draft.title || "Untitled"}</div>
              </div>

              <button className="btn ghost" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>

            <div className="modalBody">
              {mode === "view" ? (
                <>
                  <div className="modalRow">
                    <span className={`pill ${draft.status === "published" ? "pillGood" : "pillWarn"}`}>
                      {draft.status.toUpperCase()}
                    </span>
                    <span className="muted mono">/posts/{draft.slug || "…"}</span>
                  </div>

                  {draft.excerpt ? <p className="muted">{draft.excerpt}</p> : null}

                  <div className="modalActions">
                    <button className="btn ghost" onClick={() => setShowPreview((v) => !v)}>
                      {showPreview ? "Hide preview" : "Preview"}
                    </button>

                    <button className="btn" onClick={() => setMode("edit")}>
                      Edit
                    </button>

                    {draft.status !== "published" ? (
                      <button className="btn" onClick={() => setStatus("published")} disabled={saving}>
                        {saving ? "Working…" : "Publish"}
                      </button>
                    ) : (
                      <button className="btn ghost" onClick={() => setStatus("draft")} disabled={saving}>
                        {saving ? "Working…" : "Unpublish"}
                      </button>
                    )}

                    {activeId ? (
                      <button className="btn danger" onClick={del} disabled={saving}>
                        {saving ? "Working…" : "Delete"}
                      </button>
                    ) : null}
                  </div>

                  {showPreview && (
                    <div className="adminPreview">
                      {draft.cover_url ? <img className="adminPreviewCover" src={draft.cover_url} alt="" /> : null}
                      {draft.excerpt ? <p className="adminPreviewExcerpt">{draft.excerpt}</p> : null}
                      <div className="adminPreviewBody prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="formGrid">
                    <label className="label">
                      Title
                      <input
                        className="field"
                        value={draft.title}
                        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="My hike in Eifel"
                      />
                    </label>

                    <label className="label">
                      Slug
                      <input
                        className="field mono"
                        value={draft.slug}
                        onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value }))}
                        placeholder="my-hike-in-eifel"
                      />
                    </label>

                    <label className="label">
                      Cover URL (optional)
                      <input
                        className="field"
                        value={draft.cover_url ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, cover_url: e.target.value }))}
                        placeholder="https://…"
                      />
                    </label>

                    <label className="label">
                      Tags (comma-separated)
                      <input
                        className="field"
                        value={Array.isArray(draft.tags) ? draft.tags.join(", ") : (draft.tags ?? "")}
                        onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
                        placeholder="hiking, belgium, eifel"
                      />
                    </label>

                    <label className="label">
                      Excerpt (optional)
                      <textarea
                        className="field textarea"
                        value={draft.excerpt ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, excerpt: e.target.value }))}
                        placeholder="Short teaser…"
                      />
                    </label>

                    <label className="label">
                      Markdown content
                      <textarea
                        className="field textarea mono"
                        style={{ minHeight: 320 }}
                        value={draft.content_md ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, content_md: e.target.value }))}
                        placeholder="# Title\n\nWrite your post…"
                      />
                    </label>
                  </div>

                  <div className="modalActions">
                    <button className="btn ghost" onClick={() => setMode("view")} disabled={saving}>
                      Back
                    </button>

                    <button className="btn" onClick={() => save()} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>

                    {draft.status !== "published" ? (
                      <button className="btn" onClick={() => save("published")} disabled={saving}>
                        {saving ? "Saving…" : "Save + Publish"}
                      </button>
                    ) : (
                      <button className="btn ghost" onClick={() => setStatus("draft")} disabled={saving}>
                        {saving ? "Saving…" : "Unpublish"}
                      </button>
                    )}

                    {activeId ? (
                      <button className="btn danger" onClick={del} disabled={saving}>
                        {saving ? "Working…" : "Delete"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>

          <button className="modalBackdrop" onClick={closeModal} aria-label="Close backdrop" />
        </div>
      )}
    </div>
  );
}