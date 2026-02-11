import React, { useEffect, useMemo, useState } from "react";
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

const emptyPost = (): Omit<Post, "id" | "created_at" | "updated_at" | "published_at"> => ({
  title: "",
  slug: "",
  excerpt: null,
  cover_url: null,
  tags: [],
  status: "draft",
  content_md: "",
});

export function AdminPosts() {
  const { token, email, loading, logout } = useAdminToken();
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(emptyPost());
  const [saving, setSaving] = useState(false);

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

  async function loadList() {
    try {
      setErr(null);
      const data = await api.req("admin-posts");
      setPosts(data.posts ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load posts");
    }
  }

  async function loadOne(id: string) {
    try {
      setErr(null);
      const data = await api.req(`admin-posts?id=${encodeURIComponent(id)}`);
      const p: Post = data.post;
      setActiveId(p.id);
      setDraft({
        title: p.title,
        slug: p.slug,
        cover_url: p.cover_url ?? "",
        excerpt: p.excerpt ?? "",
        tags: p.tags ?? [],
        status: p.status,
        content_md: p.content_md ?? "",
      });
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load post");
    }
  }

  useEffect(() => {
    if (!token) return;
    loadList();
  }, [token]);

  if (loading) return <div className="adminCard">Loading…</div>;
  if (!email) {
    return (
      <div className="adminCard">
        <h2>Not signed in</h2>
        <p>Go to <a href="/admin/login">/admin/login</a></p>
      </div>
    );
  }

  const active = posts.find((p) => p.id === activeId);

  async function save(nextStatus?: PostStatus) {
    setSaving(true);
    try {
      const payload = {
        post: {
          id: activeId ?? undefined,
          ...draft,
          status: (nextStatus ?? draft.status) as PostStatus,
          tags:
            typeof draft.tags === "string"
              ? draft.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
              : draft.tags,
        },
      };

      const data = await api.req("admin-posts", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      // refresh list + re-open saved post
      await loadList();
      if (data?.post?.id) await loadOne(data.post.id);
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!activeId) return;
    if (!confirm("Delete this post?")) return;
    try {
      await api.req(`admin-posts?id=${encodeURIComponent(activeId)}`, { method: "DELETE" });
      setActiveId(null);
      setDraft(emptyPost());
      loadList();
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    }
  }

  return (
    <div className="adminCard">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Admin · Posts</h2>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>Signed in as {email}</p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <a className="adminBtn" href="/admin/comments">Comments</a>

          <button
            className="csBtn ghost"
            onClick={async () => {
              await logout();
              window.location.href = "/admin/login";
            }}
          >
            Log out
          </button>
        </div>
      </div>

      {err && <p style={{ color: "#ffb4b4", marginTop: 12 }}>{err}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, marginTop: 16 }}>
        {/* left: list */}
        <div style={{ borderRight: "1px solid rgba(0,0,0,.08)", paddingRight: 12 }}>
          <button
            className="csBtn"
            onClick={() => {
              setActiveId(null);
              setDraft(emptyPost());
            }}
          >
            + New
          </button>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {posts.map((p) => (
              <button
                key={p.id}
                onClick={() => loadOne(p.id)}
                className="csBtn ghost"
                style={{ justifyContent: "space-between", display: "flex" }}
              >
                <span style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700 }}>{p.title}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>/posts/{p.slug}</div>
                </span>
                <span style={{ opacity: 0.75, fontSize: 12 }}>
                  {p.status === "published" ? "Published" : "Draft"}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* right: editor */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
            <h3 style={{ margin: 0 }}>
              Editing {draft.status === "published" ? "(Published)" : "(Draft)"}
            </h3>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {draft.slug?.trim() && draft.status === "published" && (
                <a className="csBtn ghost" href={`/posts/${draft.slug}`} target="_blank" rel="noreferrer">
                  Open
                </a>
              )}

              <button className="csBtn" onClick={() => save()} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>

              {draft.status !== "published" ? (
                <button className="csBtn" onClick={() => save("published")} disabled={saving}>
                  Publish
                </button>
              ) : (
                <button className="csBtn ghost" onClick={() => save("draft")} disabled={saving}>
                  Unpublish
                </button>
              )}

              {activeId && (
                <button className="csBtn ghost" onClick={del} disabled={saving}>
                  Delete
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <input
              className="csBtn"
              placeholder="Title"
              value={draft.title}
              onChange={(e) => setDraft((d: any) => ({ ...d, title: e.target.value }))}
            />
            <input
              className="csBtn"
              placeholder="Slug (e.g. my-hike-in-eifel)"
              value={draft.slug}
              onChange={(e) => setDraft((d: any) => ({ ...d, slug: e.target.value }))}
            />
            <input
              className="csBtn"
              placeholder="Cover URL (optional)"
              value={draft.cover_url ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, cover_url: e.target.value }))}
            />
            <input
              className="csBtn"
              placeholder="Tags (comma-separated)"
              value={Array.isArray(draft.tags) ? draft.tags.join(", ") : (draft.tags ?? "")}
              onChange={(e) => setDraft((d: any) => ({ ...d, tags: e.target.value }))}
            />
            <textarea
              className="csBtn"
              placeholder="Excerpt (optional)"
              value={draft.excerpt ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, excerpt: e.target.value }))}
              style={{ minHeight: 90, padding: 12, borderRadius: 12 }}
            />
            <textarea
              className="csBtn"
              placeholder="Markdown content"
              value={draft.content_md ?? ""}
              onChange={(e) => setDraft((d: any) => ({ ...d, content_md: e.target.value }))}
              style={{ minHeight: 360, padding: 12, borderRadius: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}