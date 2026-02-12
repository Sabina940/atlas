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

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

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

        const txt = await res.text();
        if (!res.ok) throw new Error(txt || `Request failed: ${res.status}`);

        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) return null;
        return txt ? JSON.parse(txt) : null;
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
        <h2 className="h2">Not signed in</h2>
        <p className="sub">
          Go to <a href="/admin/login">/admin/login</a>
        </p>
      </div>
    );
  }

  return (
    <div className="adminComments">
      <div className="adminCommentsTop">
        <div className="adminSeg" role="tablist" aria-label="Filter comments">
          <button
            className={`adminSegBtn ${filter === "pending" ? "isActive" : ""}`}
            onClick={() => setFilter("pending")}
            type="button"
          >
            Pending
          </button>
          <button
            className={`adminSegBtn ${filter === "approved" ? "isActive" : ""}`}
            onClick={() => setFilter("approved")}
            type="button"
          >
            Approved
          </button>
          <button
            className={`adminSegBtn ${filter === "spam" ? "isActive" : ""}`}
            onClick={() => setFilter("spam")}
            type="button"
          >
            Spam
          </button>
        </div>

        <button className="btn ghost" onClick={load} type="button">
          Refresh
        </button>
      </div>

      {err && <div className="adminNotice error">{err}</div>}

      <div className="adminCommentList">
        {rows.length === 0 ? (
          <div className="adminEmpty">No comments in “{filter}”.</div>
        ) : (
          rows.map((r) => {
            const isBusy = busyId === r.id;

            return (
              <div key={r.id} className="adminCommentCard">
                <div className="adminCommentHeader">
                  <div className="adminCommentHeadLeft">
                    <div className="adminCommentTitleLine">
                      <span className="adminCommentAuthor">
                        {r.author_name}
                        {r.is_admin_reply ? <span className="pill pillGood">ADMIN</span> : null}
                      </span>

                      <span className="adminCommentSep">·</span>

                      {r.posts?.slug ? (
                        <a className="adminCommentPostLink" href={`/posts/${r.posts.slug}`} target="_blank" rel="noreferrer">
                          {r.posts?.title ?? "Post"}
                        </a>
                      ) : (
                        <span className="adminCommentPostLink">{r.posts?.title ?? "Post"}</span>
                      )}
                    </div>

                    <div className="adminCommentMeta">
                      <span className="muted">{fmt(r.created_at)}</span>
                      {r.parent_id ? <span className="pill pillWarn">REPLY</span> : null}
                    </div>
                  </div>

                  <span className={`adminStatusPill status-${r.status}`}>{r.status.toUpperCase()}</span>
                </div>

                <div className="adminCommentBody">{r.body}</div>

                <div className="adminCommentActions">
                  {r.status !== "approved" && (
                    <button className="btn primary" disabled={isBusy} onClick={() => setRowStatus(r.id, "approved")} type="button">
                      Approve
                    </button>
                  )}

                  {r.status !== "spam" && (
                    <button className="btn ghost" disabled={isBusy} onClick={() => setRowStatus(r.id, "spam")} type="button">
                      Spam
                    </button>
                  )}

                  {r.status !== "pending" && (
                    <button className="btn ghost" disabled={isBusy} onClick={() => setRowStatus(r.id, "pending")} type="button">
                      Pending
                    </button>
                  )}

                  <button className="btn ghost" disabled={isBusy} onClick={() => reply(r)} type="button">
                    Reply
                  </button>

                  <button className="btn danger" disabled={isBusy} onClick={() => del(r.id)} type="button">
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}