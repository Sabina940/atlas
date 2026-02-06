import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export function AdminLogin() {
  const [email, setEmail] = useState("plopez.be.94@gmail.com");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) return setErr(error.message);

    // send them to the admin dashboard
    window.location.href = "/admin";
  }

  return (
    <div className="cs">
      <div className="csWrap">
        <a className="csBack" href="/">← Back</a>

        <div className="csCard">
          <div className="csTop">
            <span className="csBadge">Admin</span>
            <span className="csDot" aria-hidden="true" />
          </div>

          <h1 className="csTitle">Admin Login</h1>
          <p className="csSub">Sign in with email + password.</p>

          <form onSubmit={signIn} className="csActions" style={{ gap: 12 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              required
              className="csBtn"
              style={{ flex: 1, minWidth: 260 }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              required
              className="csBtn"
              style={{ flex: 1, minWidth: 260 }}
            />
            <button className="csBtn" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {err && <p style={{ marginTop: 12, color: "#ff8a8a" }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}