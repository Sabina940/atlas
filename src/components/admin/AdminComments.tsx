import React, { useEffect, useMemo, useState } from "react";
import useAdminToken from "./useAdminToken";

type Row = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  status: "pending" | "approved" | "spam" | "deleted";
  is_admin_reply: boolean;
  created_at: string;
  posts?: { title: string; slug: string };
};

type Filter = "pending" | "approved" | "spam";

export function AdminComments() {
  const { token, loading } = useAdminToken();
  const [filter, setFilter] = useState<Filter>("pending");
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const api = useMemo(() => {
    return {
      async req(path: string, init?: RequestInit) {
        if (!token) throw new Error("Not logged in");

        const res = await fetch(path, {
          ...init,
          headers: {
            ...(init?.headers || {}),
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
        });

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(txt || `Request failed: ${res.status}`);
        }

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return null;
        return res.json();
      },
    };
  }, [token]);

  async function load() {
    try {
      setErr(null);
      const data = await api.req(`/.netlify/functions/admin-comments?status=${filter}`);
      setRows(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setRows([]);
    }
  }

  useEffect(() => {
    if (!loading && token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token, filter]);

  async function setRowStatus(id: string, next: Row["status"]) {
    try {
      setBusyId(id);
      await api.req("/.netlify/functions/admin-comments", {
        method: "POST",
        body: JSON.stringify({ action: "setStatus", id, status: next }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  async function del(id: string) {
    if (!confirm("Delete this comment?")) return;
    await setRowStatus(id, "deleted");
  }

  async function reply(r: Row) {
    const text = prompt("Reply (will be approved + marked admin)") || "";
    if (!text.trim()) return;

    try {
      setBusyId(r.id);
      await api.req("/.netlify/functions/admin-comments", {
        method: "POST",
        body: JSON.stringify({ action: "reply", id: r.id, reply: text }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Reply failed");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <div className="adminState">Loading…</div>;

  if (!token) {
    return (
      <div className="adminState">
        <h2 className="adminTitle">Not signed in</h2>
        <p className="adminSub">
          Go to <a href="/admin/login">/admin/login</a>
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="adminFilters">
        <button
          className={`csBtn ghost ${filter === "pending" ? "isActive" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Pending
        </button>
        <button
          className={`csBtn ghost ${filter === "approved" ? "isActive" : ""}`}
          onClick={() => setFilter("approved")}
        >
          Approved
        </button>
        <button
          className={`csBtn ghost ${filter === "spam" ? "isActive" : ""}`}
          onClick={() => setFilter("spam")}
        >
          Spam
        </button>
      </div>

      {err && <p className="adminError">{err}</p>}

      <div className="adminList">
        {rows.length === 0 ? (
          <div className="adminEmpty">No comments in “{filter}”.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="adminCommentCard">
              <div className="adminCommentTop">
                <div className="adminCommentTitle">
                  <span className="adminAuthor">
                    {r.author_name}
                    {r.is_admin_reply ? <span className="adminBadge">admin</span> : null}
                  </span>
                  <span className="adminOnPost">· {r.posts?.title ?? "Post"}</span>
                </div>

                <span className={`adminStatusPill status-${r.status}`}>
                  {r.status.toUpperCase()}
                </span>
              </div>

              <div className="adminCommentBody">{r.body}</div>

              <div className="adminActions">
                {r.status !== "approved" && (
                  <button
                    className="csBtn"
                    disabled={busyId === r.id}
                    onClick={() => setRowStatus(r.id, "approved")}
                  >
                    Approve
                  </button>
                )}

                {r.status !== "spam" && (
                  <button
                    className="csBtn ghost"
                    disabled={busyId === r.id}
                    onClick={() => setRowStatus(r.id, "spam")}
                  >
                    Spam
                  </button>
                )}

                {r.status !== "pending" && (
                  <button
                    className="csBtn ghost"
                    disabled={busyId === r.id}
                    onClick={() => setRowStatus(r.id, "pending")}
                  >
                    Pending
                  </button>
                )}

                <button className="csBtn ghost" disabled={busyId === r.id} onClick={() => reply(r)}>
                  Reply
                </button>

                <button className="csBtn ghost" disabled={busyId === r.id} onClick={() => del(r.id)}>
                  Delete
                </button>

                {r.posts?.slug && (
                  <a className="csBtn ghost" href={`/posts/${r.posts.slug}`} target="_blank" rel="noreferrer">
                    Open post
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}