import React, { useEffect, useMemo, useState } from "react";
import useAdminToken from "./useAdminToken";
type Post = {
  id: string;
  slug: string;
  title: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export function AdminPosts() {
  const { token, email, loading } = useAdminToken();
  const [posts, setPosts] = useState<Post[]>([]);
  const [err, setErr] = useState<string | null>(null);

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
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Request failed: ${res.status}`);
        }
        return res.json();
      },
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        setErr(null);
        const data = await api.req("admin-posts");
        setPosts(data.posts ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load posts");
      }
    })();
  }, [api, token]);

  if (loading) return <div className="adminCard">Loading…</div>;

  if (!email) {
    return (
      <div className="adminCard">
        <h2>Not signed in</h2>
        <p>Go to <a href="/admin/login">/admin/login</a></p>
      </div>
    );
  }

  return (
    <div className="adminCard">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0 }}>Posts</h2>
          <p style={{ margin: "6px 0 0", opacity: 0.75 }}>Signed in as {email}</p>
        </div>
        <a className="adminBtn" href="/admin/comments">Comments</a>
      </div>

      {err && <p style={{ color: "#ffb4b4" }}>{err}</p>}

      <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
        {posts.map((p) => (
          <div key={p.id} className="adminRow">
            <div>
              <div style={{ fontWeight: 700 }}>{p.title}</div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>/posts/{p.slug}</div>
            </div>
            <div style={{ opacity: 0.75, fontSize: 13 }}>
              {p.published_at ? "Published" : "Draft"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}