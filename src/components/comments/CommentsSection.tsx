import React, { useEffect, useState } from "react";

type Comment = {
  id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  is_admin_reply: boolean;
  created_at: string;
};

function fmtDate(iso: string) {
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

export function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(
        `/.netlify/functions/submit-comments?post_id=${encodeURIComponent(postId)}`
      );
      const data = await res.json();
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function submit() {
    setErr(null);

    const n = name.trim();
    const e = email.trim();
    const b = body.trim();

    if (!n || !b) {
      setErr("Name and comment are required.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/.netlify/functions/submit-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          author_name: n,
          author_email: e || null,
          body: b,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to submit comment.");

      setOpen(false);
      setName("");
      setEmail("");
      setBody("");

      setToast("Thanks! Your comment is under review.");
      // don't reload; pending won't show anyway
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit comment.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="cWrap" aria-label="Comments">
      <div className="cHead">
        <h2 className="cTitle">Comments</h2>
        <button className="btn" type="button" onClick={() => setOpen(true)}>
          Leave a comment
        </button>
      </div>

      {toast && <div className="cToast" role="status">{toast}</div>}

      {loading ? (
        <div className="cEmpty muted">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="cEmpty muted">No comments yet.</div>
      ) : (
        <div className="cList">
          {comments.map((c) => (
            <div key={c.id} className={`cCard ${c.is_admin_reply ? "isAdmin" : ""}`}>
              <div className="cTop">
                <div className="cName">
                  {c.author_name}
                  {c.is_admin_reply ? <span className="pill pillGood">ADMIN</span> : null}
                </div>
                <div className="cDate muted">{fmtDate(c.created_at)}</div>
              </div>
              <div className="cBody">{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="cModalOverlay" role="dialog" aria-modal="true">
          <div className="cModal">
            <div className="cModalHead">
              <div>
                <div className="cModalKicker">Comment</div>
                <div className="cModalTitle">Leave a comment</div>
              </div>
              <button
                className="btn ghost"
                type="button"
                aria-label="Close"
                onClick={() => {
                  setOpen(false);
                  setErr(null);
                }}
              >
                ✕
              </button>
            </div>

            {err && <div className="adminNotice error">{err}</div>}

            <div className="cForm">
              <label className="label">
                Name
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
              </label>

              <label className="label">
                Email (optional)
                <input className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>

              <label className="label">
                Comment
                <textarea
                  className="field textarea"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                />
              </label>

              <div className="cActions">
                <button className="btn ghost" type="button" onClick={() => setOpen(false)} disabled={sending}>
                  Cancel
                </button>
                <button className="btn" type="button" onClick={submit} disabled={sending}>
                  {sending ? "Sending…" : "Submit"}
                </button>
              </div>
            </div>
          </div>

          <button className="cBackdrop" aria-label="Close backdrop" onClick={() => setOpen(false)} />
        </div>
      )}
    </section>
  );
}