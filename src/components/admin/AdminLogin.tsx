import React, { useState } from "react";
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

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);
    if (error) setErr(error.message);
    else window.location.href = "/admin"; // or /admin/posts if you prefer
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.reload();
  }

  return (
    <div className="cs">
      <div className="csBg" aria-hidden="true" />
      <div className="csWrap">
        <div className="csCard">
          <div className="csTop">
            <span className="csBadge">Admin</span>
            <span className="csDot" aria-hidden="true" />
          </div>

          <h1 className="csTitle">Admin Login</h1>
          <p className="csSub">Sign in with email + password.</p>

          <form className="csActions" onSubmit={signIn}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="csBtn"
              style={{ width: "min(380px, 80vw)" }}
            />
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              className="csBtn"
              style={{ width: "min(380px, 80vw)" }}
            />
            <button className="csBtn" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
            <button type="button" className="csBtn ghost" onClick={signOut}>
              Sign out
            </button>
          </form>

          {err && <p style={{ color: "#ff8a8a", marginTop: 12 }}>{err}</p>}
        </div>
      </div>
    </div>
  );
}