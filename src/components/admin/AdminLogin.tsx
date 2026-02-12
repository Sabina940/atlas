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

    window.location.href = "/admin";
  }

  return (
    <div className="loginPage">
      <div className="loginCard">
        <div className="loginTop">
          <span className="pill">Admin</span>
          <span className="loginHint muted">Private area</span>
        </div>

        <h1 className="loginTitle">Admin Login</h1>
        <p className="loginSub">Sign in with email and password.</p>

        <form onSubmit={signIn} className="loginForm">
          <label className="label">
            Email
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              type="email"
              autoComplete="username"
              required
            />
          </label>

          <label className="label">
            Password
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          {err && <div className="loginError">{err}</div>}

          <button className="btn primary loginSubmit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="loginFoot muted">
          Tip: bookmark <span className="mono">/admin/login</span>
        </div>
      </div>
    </div>
  );
}