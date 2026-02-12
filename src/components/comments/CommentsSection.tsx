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

function fmt(iso: string) {
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
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [text, setText] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const parents = rows.filter((r) => !r.parent_id);
    const byParent = new Map<string, CommentRow[]>();
    for (const r of rows) {
      if (!r.parent_id) continue;
      const arr = byParent.get(r.parent_id) ?? [];
      arr.push(r);
      byParent.set(r.parent_id, arr);
    }
    return parents.map((p) => ({ p, replies: byParent.get(p.id) ?? [] }));
  }, [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/.netlify/functions/public-comments?post_id=${encodeURIComponent(postId)}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRows(Array.isArray(data?.comments) ? data.comments : []);
    } catch (e: any) {
      setErr(e?.message ?? "Couldn’t load comments.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function submit() {
    setBusy(true);
    setErr(null);

    try {
      if (!name.trim()) throw new Error("Please add your name.");
      if (!text.trim()) throw new Error("Please write a comment.");

      const res = await fetch("/.netlify/functions/submit-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: postId,
          author_name: name.trim(),
          author_email: email.trim() || null,
          body: text.trim(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setOpen(false);
      setName("");
      setEmail("");
      setText("");

      setToast("Comment submitted — it’s under review.");
      window.setTimeout(() => setToast(null), 3500);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit comment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cWrap">
      <div className="cHead">
        <h2 className="cTitle">Comments</h2>
        <button className="btn ghost" onClick={() => { setErr(null); setOpen(true); }}>
          Leave a comment
        </button>
      </div>

      {toast && <div className="cToast">{toast}</div>}
      {err && <div className="adminNotice error" style={{ marginTop: 12 }}>{err}</div>}

      {loading ? (
        <div className="cEmpty muted">Loading…</div>
      ) : grouped.length === 0 ? (
        <div className="cEmpty muted">No comments yet.</div>
      ) : (
        <div className="cList">
          {grouped.map(({ p, replies }) => (
            <div key={p.id}>
              <div className={`cCard ${p.is_admin_reply ? "isAdmin" : ""}`}>
                <div className="cTop">
                  <div className="cName">
                    {p.author_name}
                    {p.is_admin_reply ? <span className="pill pillGood">ADMIN</span> : null}
                  </div>
                  <div className="cDate muted">{fmt(p.created_at)}</div>
                </div>
                <div className="cBody">{p.body}</div>
              </div>

              {replies.length > 0 && (
                <div style={{ marginLeft: 18, marginTop: 10, display: "grid", gap: 10 }}>
                  {replies.map((r) => (
                    <div key={r.id} className={`cCard ${r.is_admin_reply ? "isAdmin" : ""}`}>
                      <div className="cTop">
                        <div className="cName">
                          {r.author_name}
                          {r.is_admin_reply ? <span className="pill pillGood">ADMIN</span> : null}
                        </div>
                        <div className="cDate muted">{fmt(r.created_at)}</div>
                      </div>
                      <div className="cBody">{r.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {open && (
        <div className="cModalOverlay" role="dialog" aria-modal="true">
          <button className="cBackdrop" onClick={() => setOpen(false)} aria-label="Close" />

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

              <div className="cActions">
                <button className="btn ghost" onClick={() => setOpen(false)} disabled={busy}>
                  Cancel
                </button>
                <button className="btn primary" onClick={submit} disabled={busy}>
                  {busy ? "Submitting…" : "Submit"}
                </button>
              </div>

              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                Comments are reviewed before appearing publicly.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}