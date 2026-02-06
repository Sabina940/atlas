import React, { useEffect, useMemo, useState } from "react";
import useAdminToken from "./useAdminToken";

type Row = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  status: string;
  is_admin_reply: boolean;
  created_at: string;
  posts?: { title: string; slug: string };
};

export function AdminComments() {
  const { token, loading } = useAdminToken();
  const [status, setStatus] = useState<"pending" | "approved" | "spam">("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const api = useMemo(() => ({
    async req(path: string, init?: RequestInit) {
      if (!token) throw new Error("Not logged in");
      const r = await fetch(path, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  }), [token]);

  async function load() {
    try {
      setErr(null);
      const list = await api.req(`/.netlify/functions/admin-comments?status=${status}`);
      setRows(list);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
    }
  }

  useEffect(() => {
    if (!loading && token) load();
  }, [loading, token, status]);

  async function setRowStatus(id: string, next: string) {
    await api.req("/.netlify/functions/admin-comments", {
      method: "PUT",
      body: JSON.stringify({ id, status: next }),
    });
    load();
  }

  async function del(id: string) {
    if (!confirm("Delete this comment?")) return;
    await api.req(`/.netlify/functions/admin-comments?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    load();
  }

  async function reply(r: Row) {
    const text = prompt("Reply (will be approved + marked admin)") || "";
    if (!text.trim()) return;
    await api.req("/.netlify/functions/admin-comments", {
      method: "POST",
      body: JSON.stringify({ post_id: r.post_id, parent_id: r.id, body: text }),
    });
    // keep in same status list
    load();
  }

  if (loading) return <div className="cs"><div className="csWrap"><div className="csCard">Loading…</div></div></div>;
  if (!token) return <div className="cs"><div className="csWrap"><div className="csCard">Not logged in. Go to <a href="/admin/login">/admin/login</a>.</div></div></div>;

  return (
    <div className="cs">
      <div className="csWrap">
        <div className="csCard">
          <div className="csTop">
            <div className="csBadge">Admin · Comments</div>
            <div className="csDot" />
          </div>

          <h1 className="csTitle">Moderation</h1>

          <div className="csActions">
            <button className="csBtn ghost" onClick={() => setStatus("pending")}>Pending</button>
            <button className="csBtn ghost" onClick={() => setStatus("approved")}>Approved</button>
            <button className="csBtn ghost" onClick={() => setStatus("spam")}>Spam</button>
            <a className="csBtn ghost" href="/admin">Back to posts</a>
          </div>

          {err && <p className="csSub" style={{ marginTop: 12, color: "rgba(255,120,120,0.9)" }}>{err}</p>}

          <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div key={r.id} style={{
                padding: 14,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ fontWeight: 650 }}>
                    {r.author_name} {r.is_admin_reply ? "(admin)" : ""}
                    <span style={{ opacity: 0.7, fontWeight: 400 }}> · {r.posts?.title || "Post"}</span>
                  </div>
                  <div style={{ opacity: 0.7, fontSize: 13 }}>{r.status.toUpperCase()}</div>
                </div>

                <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.5 }}>{r.body}</div>

                <div className="csActions" style={{ marginTop: 12 }}>
                  {r.status !== "approved" && <button className="csBtn" onClick={() => setRowStatus(r.id, "approved")}>Approve</button>}
                  {r.status !== "spam" && <button className="csBtn ghost" onClick={() => setRowStatus(r.id, "spam")}>Spam</button>}
                  {r.status !== "pending" && <button className="csBtn ghost" onClick={() => setRowStatus(r.id, "pending")}>Pending</button>}
                  <button className="csBtn ghost" onClick={() => reply(r)}>Reply</button>
                  <button className="csBtn ghost" onClick={() => del(r.id)}>Delete</button>
                  {r.posts?.slug && <a className="csBtn ghost" href={`/posts/${r.posts.slug}`} target="_blank" rel="noreferrer">Open post</a>}
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
}