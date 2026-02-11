import React, { useEffect, useMemo, useState } from "react";
import useAdminToken from "./useAdminToken";

type PostStatus = "draft" | "published";

type PostListItem = {
  id: string;
  slug: string;
  title: string;
  status: PostStatus;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

type PostFull = PostListItem & {
  excerpt: string | null;
  cover_url: string | null;
  tags: string[];
  content_md: string;
};

const emptyDraft = (): PostFull => ({
  id: "",
  title: "",
  slug: "",
  excerpt: "",
  cover_url: "",
  tags: [],
  status: "draft",
  content_md: "",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  published_at: null,
});

export function AdminPosts() {
  const { token, email, loading, logout } = useAdminToken();

  const [posts, setPosts] = useState<PostListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editor, setEditor] = useState<PostFull>(emptyDraft());

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

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

  async function refreshList() {
    const data = await api.req("admin-posts");
    setPosts(data.posts ?? []);
  }

  async function loadOne(id: string) {
    const data = await api.req(`admin-posts?id=${encodeURIComponent(id)}`);
    const p: PostFull = data.post;
    setEditor({
      ...p,
      tags: Array.isArray(p.tags) ? p.tags : [],
      excerpt: p.excerpt ?? "",
      cover_url: p.cover_url ?? "",
      content_md: p.content_md ?? "",
    });
  }

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setErr(null);
        await refreshList();
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load posts");
      }
    })();
  }, [token, api]);

  useEffect(() => {
    if (!token) return;
    if (!activeId) return;
    (async () => {
      try {
        setErr(null);
        await loadOne(activeId);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load post");
      }
    })();
  }, [activeId, token]);

  async function save(statusOverride?: PostStatus) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const payload = {
        ...editor,
        status: statusOverride ?? editor.status,
        excerpt: editor.excerpt || null,
        cover_url: editor.cover_url || null,
        tags: Array.isArray(editor.tags) ? editor.tags : [],
      };

      // If new post, remove empty id so DB generates one (but keep slug unique)
      if (!payload.id) delete (payload as any).id;

      const data = await api.req("admin-posts", {
        method: "POST",
        body: JSON.stringify({ action: "upsert", post: payload }),
      });

      const saved: PostFull = data.post;
      setActiveId(saved.id);
      setEditor({
        ...saved,
        excerpt: saved.excerpt ?? "",
        cover_url: saved.cover_url ?? "",
        tags: Array.isArray(saved.tags) ? saved.tags : [],
        content_md: saved.content_md ?? "",
      });

      await refreshList();
      setMsg("Saved ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Save failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 1600);
    }
  }

  async function setStatus(next: PostStatus) {
    if (!editor.id) {
      // if it's a new draft, save first
      await save(next);
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.req("admin-posts", {
        method: "POST",
        body: JSON.stringify({ action: "setStatus", id: editor.id, status: next }),
      });
      await loadOne(editor.id);
      await refreshList();
      setMsg(next === "published" ? "Published ✅" : "Unpublished ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Status change failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 1600);
    }
  }

  async function del() {
    if (!editor.id) {
      setActiveId(null);
      setEditor(emptyDraft());
      return;
    }
    if (!confirm("Delete this post forever?")) return;

    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api.req("admin-posts", {
        method: "POST",
        body: JSON.stringify({ action: "delete", id: editor.id }),
      });
      await refreshList();
      setActiveId(null);
      setEditor(emptyDraft());
      setMsg("Deleted ✅");
    } catch (e: any) {
      setErr(e?.message ?? "Delete failed");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(null), 1600);
    }
  }

  function update<K extends keyof PostFull>(key: K, value: PostFull[K]) {
    setEditor((p) => ({ ...p, [key]: value, updated_at: new Date().toISOString() }));
  }

  if (loading) return <div className="cs"><div className="csWrap"><div className="csCard">Loading…</div></div></div>;

  if (!email) {
    return (
      <div className="cs">
        <div className="csWrap">
          <div className="csCard">
            Not signed in. Go to <a href="/admin/login">/admin/login</a>.
          </div>
        </div>
      </div>
    );
  }

  const isPublished = editor.status === "published";

  return (
    <div className="cs">
      <div className="csWrap">
        <div className="csCard">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div>
              <div className="csBadge">Admin · Posts</div>
              <div style={{ marginTop: 6, opacity: 0.75, fontSize: 13 }}>Signed in as {email}</div>
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <a className="csBtn ghost" href="/admin/comments">Comments</a>
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

          <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14, marginTop: 18 }}>
            {/* LEFT: list */}
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, overflow: "hidden" }}>
              <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,0.10)", display: "flex", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 700 }}>Posts</div>
                <button
                  className="csBtn"
                  onClick={() => {
                    setActiveId(null);
                    setEditor(emptyDraft());
                  }}
                >
                  + New
                </button>
              </div>

              <div style={{ maxHeight: "70vh", overflow: "auto" }}>
                {posts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setActiveId(p.id)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: 12,
                      background: activeId === p.id ? "rgba(255,255,255,0.06)" : "transparent",
                      border: "0",
                      borderBottom: "1px solid rgba(255,255,255,0.08)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <div style={{ opacity: 0.75, fontSize: 12 }}>/posts/{p.slug}</div>
                    <div style={{ opacity: 0.7, fontSize: 12 }}>
                      {p.status === "published" ? "Published" : "Draft"}
                    </div>
                  </button>
                ))}
                {!posts.length && <div style={{ padding: 12, opacity: 0.7 }}>No posts yet.</div>}
              </div>
            </div>

            {/* RIGHT: editor */}
            <div style={{ border: "1px solid rgba(255,255,255,0.10)", borderRadius: 18, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div style={{ fontWeight: 700 }}>
                  {editor.id ? (isPublished ? "Editing (Published)" : "Editing (Draft)") : "New Draft"}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {editor.slug && (
                    <a className="csBtn ghost" href={`/posts/${editor.slug}`} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                  <button className="csBtn ghost" disabled={busy} onClick={() => save("draft")}>
                    Save
                  </button>
                  {!isPublished ? (
                    <button className="csBtn" disabled={busy} onClick={() => setStatus("published")}>
                      Publish
                    </button>
                  ) : (
                    <button className="csBtn ghost" disabled={busy} onClick={() => setStatus("draft")}>
                      Unpublish
                    </button>
                  )}
                  <button className="csBtn ghost" disabled={busy} onClick={del}>
                    Delete
                  </button>
                </div>
              </div>

              {err && <div style={{ marginTop: 10, color: "#ff8a8a" }}>{err}</div>}
              {msg && <div style={{ marginTop: 10, color: "rgba(160,255,200,.95)" }}>{msg}</div>}

              <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
                <input
                  className="csBtn"
                  value={editor.title}
                  onChange={(e) => update("title", e.target.value)}
                  placeholder="Title"
                />

                <input
                  className="csBtn"
                  value={editor.slug}
                  onChange={(e) => update("slug", e.target.value)}
                  placeholder="Slug (e.g. my-hike-in-eifel)"
                />

                <input
                  className="csBtn"
                  value={editor.cover_url ?? ""}
                  onChange={(e) => update("cover_url", e.target.value)}
                  placeholder="Cover URL (optional)"
                />

                <input
                  className="csBtn"
                  value={(editor.tags || []).join(", ")}
                  onChange={(e) =>
                    update(
                      "tags",
                      e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Tags (comma separated)"
                />

                <textarea
                  className="csBtn"
                  value={editor.excerpt ?? ""}
                  onChange={(e) => update("excerpt", e.target.value)}
                  placeholder="Excerpt (optional)"
                  style={{ height: 90, paddingTop: 10, paddingBottom: 10 }}
                />

                <textarea
                  className="csBtn"
                  value={editor.content_md ?? ""}
                  onChange={(e) => update("content_md", e.target.value)}
                  placeholder="Write markdown here…"
                  style={{ height: "42vh", paddingTop: 12, paddingBottom: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}