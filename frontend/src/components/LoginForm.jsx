import React, { useState } from "react";

export default function LoginForm({ onLogin, onShowRegister }) {
  const [form, setForm] = useState({ username: "", password: "", remember: false });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoad] = useState(false);
  const [success, setOk] = useState(false);

  const change = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoad(true);
    try {
      const body = new URLSearchParams();
      body.append("username", form.username);
      body.append("password", form.password);

      const res = await fetch("https://cubehis.avopay.pro:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Invalid username or password");
      }

      const data = await res.json();
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("token_type", data.token_type);
      localStorage.setItem("user", JSON.stringify(data.user));

      setOk(true);
      setTimeout(() => { setOk(false); if (onLogin) onLogin(data.user); }, 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoad(false);
    }
  };

  return (
    <div style={s.page}>
      <style>{css}</style>

      <div style={s.card} className="lp-card">

        {/* Logo / Heading */}
        <div style={s.logoRow}>
          <div style={s.cross}>
            <svg width="34" height="34" viewBox="0 0 20 20">
              <rect x="7" y="2" width="6" height="16" rx="2" fill="#2563eb" />
              <rect x="2" y="7" width="16" height="6" rx="2" fill="#2563eb" />
            </svg>
          </div>
          <div style={s.brandCol}>
            <div style={s.brand}>HIS<span style={{ color: "#2563eb" }}>Connect</span></div>
            <div style={s.brandSub}>Hospital Management System</div>
          </div>
        </div>

        <div style={s.divider} />

        <h2 style={s.title}>Sign In</h2>
        <p style={s.sub}>Enter your credentials to continue</p>

        {/* Error */}
        {error && (
          <div style={s.err} className="lp-shake">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={submit} style={{ width: "100%" }}>

          {/* Username */}
          <div style={s.group}>
            <label style={s.label}>Username</label>
            <input
              type="text"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={change}
              required
              placeholder="Enter your username"
              style={s.input}
              className="lp-input"
            />
          </div>

          {/* Password */}
          <div style={s.group}>
            <label style={s.label}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                value={form.password}
                onChange={change}
                required
                placeholder="Enter your password"
                style={{ ...s.input, paddingRight: "2.8rem" }}
                className="lp-input"
              />
              <button
                type="button"
                style={s.eye}
                tabIndex={-1}
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? "Hide" : "Show"}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Remember + Forgot */}
          <div style={s.optRow}>
            <label style={s.remLabel}>
              <input
                type="checkbox"
                name="remember"
                checked={form.remember}
                onChange={change}
                style={{ accentColor: "#2563eb", width: 14, height: 14, cursor: "pointer" }}
              />
              Remember me
            </label>
            <button type="button" style={s.forgot}>Forgot Password?</button>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} style={s.btn} className="lp-btn">
            {loading ? (
              <>
                <span className="lp-spin" style={s.spin} />
                Signing in…
              </>
            ) : "Sign In"}
          </button>
        </form>

        {/* Footer */}
        <div style={s.footer}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Secure Login &nbsp;·&nbsp; HIPAA Compliant &nbsp;·&nbsp; v6.0
        </div>
      </div>

      {/* Success overlay */}
      {success && (
        <div style={s.overlay}>
          <div style={s.successCard} className="lp-pop">
            <div style={s.checkRing}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: "1.1rem", color: "#0f172a" }}>Login Successful</p>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}>Redirecting to dashboard…</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ── */
const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, rgba(15,23,42,0.88) 0%, rgba(30,41,59,0.82) 100%), url('https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=2053&auto=format&fit=crop') center/cover no-repeat fixed",
    fontFamily: "'Inter','Segoe UI',system-ui,sans-serif",
    padding: "1rem",
  },
  card: {
    width: "100%",
    maxWidth: 480,
    background: "rgba(255,255,255,0.97)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    borderRadius: "24px",
    boxShadow: "0 24px 48px rgba(0,0,0,0.28), 0 1px 3px rgba(255,255,255,0.4) inset",
    border: "1px solid rgba(255,255,255,0.55)",
    padding: "3rem 3.5rem",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logoRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1.2rem", width: "100%", marginBottom: "1.5rem" },
  cross: {
    width: 65, height: 65,
    background: "#EFF6FF",
    borderRadius: "16px",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0,
    border: "1.5px solid #BFDBFE",
  },
  brandCol: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  brand: { fontSize: "2rem", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.02em", lineHeight: "1" },
  brandSub: { fontSize: "0.85rem", fontWeight: 600, color: "#94a3b8", marginTop: "5px" },
  divider: { width: "100%", height: 1, background: "#e2e8f0", margin: "0 0 1.8rem" },

  title: { fontSize: "1.5rem", fontWeight: 800, color: "#0f172a", margin: "0 0 4px", alignSelf: "flex-start" },
  sub: { fontSize: "0.85rem", color: "#64748b", margin: "0 0 1.6rem", alignSelf: "flex-start" },

  err: {
    width: "100%", marginBottom: "1rem",
    background: "#FFF5F5", border: "1px solid #FED7D7",
    color: "#E53E3E", borderRadius: "8px",
    padding: "0.55rem 0.8rem", fontSize: "0.78rem",
    display: "flex", alignItems: "center", gap: "0.4rem",
    boxSizing: "border-box",
  },

  group: { width: "100%", marginBottom: "1rem" },
  label: { display: "block", fontSize: "0.73rem", fontWeight: 600, color: "#334155", marginBottom: 5 },
  input: {
    width: "100%", boxSizing: "border-box",
    padding: "0.7rem 0.9rem",
    border: "1.5px solid #cbd5e1",
    borderRadius: "8px",
    fontSize: "0.87rem", color: "#0f172a",
    background: "#F8FAFC", outline: "none",
    transition: "border-color .18s, box-shadow .18s",
  },
  eye: {
    position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer", padding: 0,
    display: "flex", alignItems: "center",
  },

  optRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    width: "100%", marginBottom: "1.3rem",
  },
  remLabel: {
    display: "flex", alignItems: "center", gap: "0.4rem",
    fontSize: "0.77rem", color: "#475569", cursor: "pointer",
  },
  forgot: {
    background: "none", border: "none",
    color: "#2563eb", fontSize: "0.77rem",
    cursor: "pointer", padding: 0, fontWeight: 600,
  },

  btn: {
    width: "100%",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    padding: "0.78rem",
    background: "linear-gradient(135deg, #1e40af, #2563eb)",
    color: "#fff", border: "none", borderRadius: "8px",
    fontSize: "0.92rem", fontWeight: 700, cursor: "pointer",
    letterSpacing: "0.02em",
    boxShadow: "0 4px 14px rgba(37,99,235,0.35)",
    transition: "background .18s, transform .15s, box-shadow .15s",
  },
  spin: {
    width: 15, height: 15,
    border: "2.5px solid rgba(255,255,255,0.35)", borderTopColor: "#fff",
    borderRadius: "50%", display: "inline-block",
  },

  adminBtn: {
    marginTop: "1rem", width: "100%",
    background: "linear-gradient(135deg, #EFF6FF, #DBEAFE)",
    border: "1.5px solid #93c5fd",
    borderRadius: "10px", padding: "0.65rem 1rem",
    fontSize: "0.78rem", color: "#1e40af",
    cursor: "pointer", textAlign: "center",
    display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
    fontWeight: 600,
    boxShadow: "0 2px 8px rgba(37,99,235,0.1)",
    transition: "background .15s, box-shadow .15s",
  },

  createRow: { fontSize: "0.77rem", color: "#64748b", margin: "0.85rem 0 0", textAlign: "center" },
  createLink: {
    background: "none", border: "none",
    color: "#2563eb", fontWeight: 700,
    fontSize: "0.77rem", cursor: "pointer", padding: 0,
  },

  footer: {
    display: "flex", alignItems: "center", gap: "0.35rem",
    fontSize: "0.62rem", color: "#94a3b8",
    marginTop: "1.2rem",
  },

  overlay: {
    position: "fixed", inset: 0,
    background: "rgba(15,23,42,0.6)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  successCard: {
    background: "#fff", borderRadius: "18px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
    padding: "2.4rem 2rem", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: "0.7rem",
    minWidth: 260,
  },
  checkRing: {
    width: 62, height: 62, borderRadius: "50%",
    background: "linear-gradient(135deg, #1e40af, #3b82f6)",
    display: "flex", alignItems: "center", justifyContent: "center",
    boxShadow: "0 8px 22px rgba(37,99,235,0.38)",
  },
};

/* ── CSS ── */
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  body { margin: 0; }

  .lp-card { animation: cardIn 0.4s cubic-bezier(.22,1,.36,1) both; }
  @keyframes cardIn {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .lp-input:focus {
    border-color: #2563eb !important;
    box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important;
    background: #fff !important;
  }

  .lp-btn:hover:not(:disabled) { background: linear-gradient(135deg,#1e3a8a,#1d4ed8) !important; transform: translateY(-1px); box-shadow: 0 6px 18px rgba(37,99,235,0.4) !important; }
  .lp-btn:active:not(:disabled){ transform: translateY(0); }
  .lp-btn:disabled { opacity: 0.65; cursor: not-allowed; }

  .lp-spin { animation: spin 0.7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .lp-shake { animation: shake 0.36s ease both; }
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    25%     { transform: translateX(-5px); }
    75%     { transform: translateX(5px); }
  }

  .lp-pop { animation: pop 0.38s cubic-bezier(.22,1.3,.36,1) both; }
  @keyframes pop {
    from { opacity: 0; transform: scale(0.75); }
    to   { opacity: 1; transform: scale(1); }
  }

  .lp-admin:hover { background: linear-gradient(135deg,#DBEAFE,#BFDBFE) !important; box-shadow: 0 4px 12px rgba(37,99,235,0.15) !important; }
`;

