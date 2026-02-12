import React, { useEffect, useMemo, useState } from "react";

type CommentRow = {
  id: string;
  post_id: string;
  parent_id: string | null;
  author_name: string;
  body: string;
  is_admin_reply: boolean;
  created_at: string;
};

export function CommentsSection({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);

  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const api = useMemo(() => {
    return {
      async getApproved() {
        const res = await fetch(`/.netlify/functions/public-comments?post_id=${encodeURIComponent(postId)}`);
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || `Request failed: ${res.status}`);
        return txt ? JSON.parse(txt) : null;
      },
      async submitComment(payload: any) {
        const res = await fetch("/.netlify/functions/submit-comment", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt || `Request failed: ${res.status}`);
        return txt ? JSON.parse(txt) : null;
      },
    };
  }, [postId]);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getApproved();
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (postId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function onSubmit() {
    setToast(null);

    if (!name.trim() || !text.trim()) {
      setToast({ kind: "err", msg: "Please fill in your name and comment." });
      return;
    }

    setSubmitting(true);
    try {
      await api.submitComment({
        post_id: postId,
        author_name: name.trim(),
        author_email: email.trim() || null,
        body: text.trim(),
        parent_id: null,
      });

      setOpen(false);
      setName("");
      setEmail("");
      setText("");

      setToast({ kind: "ok", msg: "Thanks! Your comment is under review." });
      // don’t reload approved list (it’s pending), but you can if you want:
      // await load();
    }  catch (e: any) {
    const raw = String(e?.message || "Failed to submit comment.");
    try {
        const parsed = JSON.parse(raw);
        setToast({ kind: "err", msg: parsed?.error || raw });
    } catch {
        setToast({ kind: "err", msg: raw });
    }
    } finally {
      setSubmitting(false);
    }
  }

  function fmt(iso: string) {
    try {
      return new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
    } catch {
      return "";
    }
  }

  return (
    <div className="cWrap">
      <div className="cHead">
        <h3 className="cTitle">Comments</h3>
        <button className="btn ghost" onClick={() => setOpen(true)}>
          Leave a comment
        </button>
      </div>

      {toast && (
        <div className={`cToast ${toast.kind === "err" ? "isError" : ""}`}>
          {toast.msg}
        </div>
      )}

      {loading ? (
        <div className="cEmpty">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="cEmpty">No comments yet.</div>
      ) : (
        <div className="cList">
          {comments.map((c) => (
            <div key={c.id} className={`cCard ${c.is_admin_reply ? "isAdmin" : ""}`}>
              <div className="cTop">
                <div className="cName">
                  {c.author_name}
                  {c.is_admin_reply ? <span className="pill pillGood">ADMIN</span> : null}
                </div>
                <div className="cDate">{fmt(c.created_at)}</div>
              </div>
              <div className="cBody">{c.body}</div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="cModalOverlay" role="dialog" aria-modal="true">
          <button className="cBackdrop" aria-label="Close" onClick={() => setOpen(false)} />

          <div className="cModal">
            <div className="cModalHead">
              <div>
                <div className="cModalKicker">Comment</div>
                <div className="cModalTitle">Leave a comment</div>
              </div>
              <button className="btn ghost" onClick={() => setOpen(false)} aria-label="Close">
                ✕
              </button>
            </div>

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
                <textarea className="field textarea" value={text} onChange={(e) => setText(e.target.value)} />
              </label>

              <div className="muted">Comments are reviewed before appearing publicly.</div>

              <div className="cActions">
                <button className="btn ghost" onClick={() => setOpen(false)} disabled={submitting}>
                  Cancel
                </button>
                <button className="btn primary" onClick={onSubmit} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}