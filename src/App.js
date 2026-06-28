import { useState, useEffect, useRef } from "react";
const theme = {
  bg: "#0a0a1a", bgCard: "#10102a", bgSidebar: "#0d0d22",
  accent: "#7c3aed", accentLight: "#a78bfa", accentGlow: "rgba(124,58,237,0.35)",
  teal: "#06b6d4", green: "#10b981", red: "#ef4444", amber: "#f59e0b",
  text: "#e2e8f0", textMuted: "#94a3b8",
  border: "rgba(124,58,237,0.2)", borderLight: "rgba(255,255,255,0.07)",
};
const G = `linear-gradient(135deg, ${theme.accent}, ${theme.teal})`;

const useLocalStorage = (key, init) => {
  const [v, setV] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key)) ?? init; } catch { return init; }
  });
  const set = (val) => {
    setV(val);
    if (val === null || val === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(val));
    }
  };
  return [v, set];
};

// ─── File Reading Utilities ───────────────────────────────────────────────────
const readFileAsText = (file) => {
  return new Promise((resolve, reject) => {
    const ext = file.name.split(".").pop().toLowerCase();

    if (ext === "txt") {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read TXT file"));
      reader.readAsText(file);

    } else if (ext === "pdf") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!window.pdfjsLib) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
          const typedArray = new Uint8Array(e.target.result);
          const pdf = await window.pdfjsLib.getDocument({ data: typedArray }).promise;
          let text = "";
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map((item) => item.str).join(" ") + "\n";
          }
          resolve(text.trim() || "Could not extract text from this PDF.");
        } catch (err) {
          reject(new Error("Failed to parse PDF: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read PDF file"));
      reader.readAsArrayBuffer(file);

    } else if (ext === "docx") {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          if (!window.mammoth) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js");
          }
          const arrayBuffer = e.target.result;
          const result = await window.mammoth.extractRawText({ arrayBuffer });
          resolve(result.value.trim() || "Could not extract text from this DOCX.");
        } catch (err) {
          reject(new Error("Failed to parse DOCX: " + err.message));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read DOCX file"));
      reader.readAsArrayBuffer(file);

    } else if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
      const reader = new FileReader();
      reader.onload = (e) => resolve(`[IMAGE:${file.name}] ${e.target.result}`);
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);

    } else {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Unsupported file type: .${ext}`));
      reader.readAsText(file);
    }
  });
};

const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

// ─── Shared Components ────────────────────────────────────────────────────────
const Avatar = ({ name, size = 32 }) => (
  <div style={{ width: size, height: size, borderRadius: "50%", background: G, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.4, color: "#fff", flexShrink: 0 }}>
    {name?.[0]?.toUpperCase() ?? "U"}
  </div>
);

const Spinner = () => (
  <span style={{ display: "inline-block", width: 18, height: 18, border: `2px solid rgba(255,255,255,0.2)`, borderTop: `2px solid #fff`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
);

const Badge = ({ children, color = theme.accent }) => (
  <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{children}</span>
);

const Input = ({ label, type = "text", value, onChange, placeholder }) => (
  <div style={{ marginBottom: 16 }}>
    {label && <label style={{ display: "block", marginBottom: 6, fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>{label}</label>}
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", boxSizing: "border-box", padding: "11px 14px", background: "rgba(255,255,255,0.05)", border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, outline: "none", transition: "border 0.2s" }}
      onFocus={e => e.target.style.borderColor = theme.accent}
      onBlur={e => e.target.style.borderColor = theme.border}
    />
  </div>
);

const Btn = ({ children, onClick, variant = "primary", disabled, style: s = {}, icon }) => {
  const base = { display: "inline-flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: disabled ? "not-allowed" : "pointer", border: "none", transition: "all 0.2s", opacity: disabled ? 0.5 : 1, ...s };
  const styles = {
    primary: { background: G, color: "#fff", boxShadow: `0 4px 20px ${theme.accentGlow}` },
    outline: { background: "transparent", color: theme.accentLight, border: `1px solid ${theme.border}` },
    ghost: { background: "rgba(255,255,255,0.05)", color: theme.text },
    danger: { background: "#ef444422", color: "#ef4444", border: `1px solid #ef444444` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...styles[variant] }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = "0.85"; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
      {icon && <span>{icon}</span>}{children}
    </button>
  );
};

const NAV = [
  { id: "home", label: "Home", icon: "🏠" },
  { id: "legal", label: "Legal Summarization", icon: "📄" },
  { id: "healthcare", label: "Healthcare Summarization", icon: "🏥" },
  { id: "news", label: "News Summarization", icon: "📰" },
  { id: "education", label: "Education Summarization", icon: "🎓" },
  { id: "qa", label: "Q&A", icon: "❓" },
  { id: "history", label: "History", icon: "🕐" },
  { id: "profile", label: "Profile", icon: "👤" },
  { id: "about", label: "About", icon: "ℹ️" },
  { id: "feedback", label: "Feedback", icon: "💬" },
];

const Sidebar = ({ page, setPage, user, onLogout }) => (
  <aside style={{ width: 220, background: theme.bgSidebar, borderRight: `1px solid ${theme.borderLight}`, display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0, minHeight: "100vh" }}>
    <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${theme.borderLight}` }}>
      <div style={{ fontWeight: 800, fontSize: 15, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>⚡ AI Summarizer</div>
    </div>
    <nav style={{ flex: 1, padding: "16px 12px" }}>
      {NAV.map(n => (
        <button key={n.id} onClick={() => setPage(n.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", background: page === n.id ? `${theme.accent}22` : "transparent", color: page === n.id ? theme.accentLight : theme.textMuted, fontWeight: page === n.id ? 600 : 400, fontSize: 13.5, borderLeft: page === n.id ? `3px solid ${theme.accent}` : "3px solid transparent", marginBottom: 2, transition: "all 0.15s" }}>
          <span>{n.icon}</span>{n.label}
        </button>
      ))}
    </nav>
    <div style={{ padding: "16px 20px", borderTop: `1px solid ${theme.borderLight}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Avatar name={user?.name} size={34} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: theme.textMuted }}>{user?.email?.slice(0, 18)}…</div>
        </div>
      </div>
      <button onClick={onLogout} style={{ width: "100%", padding: "8px", background: "#ef444411", color: "#ef4444", border: "1px solid #ef444433", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>🚪 Logout</button>
    </div>
  </aside>
);

const Topbar = ({ user }) => (
  <header style={{ height: 56, background: theme.bgCard, borderBottom: `1px solid ${theme.borderLight}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
    <div style={{ fontWeight: 700, fontSize: 15, background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>⚡ AI Summarizer</div>
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar name={user?.name} size={30} />
        <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{user?.name}</span>
      </div>
    </div>
  </header>
);

const Card = ({ children, style: s = {} }) => (
  <div style={{ background: theme.bgCard, border: `1px solid ${theme.borderLight}`, borderRadius: 16, padding: 24, ...s }}>{children}</div>
);

const UploadBox = ({ label, onFile, accept = ".pdf,.docx,.txt" }) => {
  const ref = useRef();
  const [name, setName] = useState(null);
  return (
    <div onClick={() => ref.current.click()} style={{ border: `2px dashed ${theme.border}`, borderRadius: 14, padding: "36px 20px", textAlign: "center", cursor: "pointer", transition: "all 0.2s", background: "rgba(124,58,237,0.04)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = theme.accent}
      onMouseLeave={e => e.currentTarget.style.borderColor = theme.border}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
      <div style={{ fontWeight: 600, color: theme.text, marginBottom: 4 }}>{name ?? label}</div>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>{accept?.includes("jpg") ? "Images & Documents (Max 20MB)" : "PDF, DOCX, TXT (Max 20MB)"}</div>
      <Btn variant="outline" style={{ pointerEvents: "none" }}>Choose File</Btn>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) { setName(f.name); onFile(f); } }} />
    </div>
  );
};

// ─── UPDATED SummaryResult with Toggle TTS ────────────────────────────────────
const SummaryResult = ({ text }) => {
  const [speaking, setSpeaking] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  const toggleTts = () => {
    if (ttsOn) {
      if (window.speechSynthesis) speechSynthesis.cancel();
      setSpeaking(false);
      setTtsOn(false);
    } else {
      setTtsOn(true);
    }
  };

  const speak = () => {
    if (!window.speechSynthesis || !ttsOn) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
  };

  const download = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "summary.txt";
    a.click();
  };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 10 }}>Summary</div>
      <div style={{ background: "rgba(124,58,237,0.07)", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18, color: theme.text, fontSize: 14, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>{text}</div>

      {/* Text-to-Voice Toggle Row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "10px 14px", background: ttsOn ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${ttsOn ? theme.accent + "55" : theme.borderLight}`, borderRadius: 10, transition: "all 0.2s" }}>
        <span style={{ fontSize: 14, color: theme.textMuted, fontWeight: 500 }}>🔊 Text to Voice</span>

        {/* Toggle switch */}
        <button
          onClick={toggleTts}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: ttsOn ? G : "rgba(255,255,255,0.12)",
            position: "relative", transition: "all 0.25s",
            boxShadow: ttsOn ? `0 2px 10px ${theme.accentGlow}` : "none",
            flexShrink: 0,
          }}
          title={ttsOn ? "Turn off text to voice" : "Turn on text to voice"}
        >
          <span style={{
            position: "absolute", top: 3, left: ttsOn ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%", background: "#fff",
            transition: "left 0.25s", display: "block",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }} />
        </button>

        <span style={{ fontSize: 12, color: ttsOn ? theme.accentLight : theme.textMuted, fontWeight: 600 }}>
          {ttsOn ? "ON" : "OFF"}
        </span>

        {ttsOn && (
          <Btn
            variant="ghost"
            onClick={speak}
            disabled={speaking}
            icon={speaking ? <Spinner /> : "▶"}
            style={{ marginLeft: "auto", padding: "6px 14px", fontSize: 13 }}
          >
            {speaking ? "Speaking…" : "Play"}
          </Btn>
        )}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <Btn variant="ghost" onClick={download} icon="⬇️">Download Summary</Btn>
      </div>
    </div>
  );
};

// ─── Backend API (Flask) ──────────────────────────────────────────────────────
const BASE_URL = "http://13.53.194.61:5000";
const summarizeText = async (text) => {
  try {
    const res = await fetch(`${BASE_URL}/api/summarize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    return data.summary;
  } catch (err) {
    console.error("API Error:", err);
    return "Error connecting to backend";
  }};

const askQuestion = async (question) => {
  try {
    const res = await fetch(`${BASE_URL}/api/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await res.json();
    return data.answer;
  } catch (err) {
    console.error("API Error:", err);
    return "Error connecting to backend";
  }
};

// ─── Login Page ───────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

const handle = async () => {
  setLoading(true);
  setErr("");

  if (email === "admin" && pass === "admin1") {
    onLogin({ name: "Admin", email, role: "admin" });
    setLoading(false);
    return;
  }

  try {
    const res = await fetch(`${BASE_URL}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: pass,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setErr(data.error || "Invalid credentials");
      setLoading(false);
      return;
    }

    onLogin({ ...data.user, role: "user" });

  } catch (err) {
    setErr("Server error. Check backend.");
  }

  setLoading(false);
};
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", fontFamily: "'Space Grotesk',sans-serif" }}>
      <div style={{ flex: 1, background: `linear-gradient(160deg, #0a0a2e 0%, #1a0a3e 50%, #0d1a3e 100%)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 30% 50%, rgba(124,58,237,0.15) 0%, transparent 60%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚡</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>AI Summarizer</span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
            <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Based</span><br />Document<br />Summarization
          </h1>
          <p style={{ color: theme.textMuted, fontSize: 15, marginBottom: 28 }}>Smartly summarize your documents using the power of AI.</p>
          {["Legal Documents","Healthcare Reports","News Articles","Education Materials","Text to Voice","Questions & Answers"].map(f => (
            <div key={f} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: "#c4b5fd", fontSize: 14 }}>
              <span style={{ color: theme.green }}>✓</span>{f}
            </div>
          ))}
        </div>
      </div>
      <div style={{ width: 440, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%" }}>
          <h2 style={{ fontWeight: 800, fontSize: 26, color: theme.text, marginBottom: 4 }}>Welcome Back!</h2>
          <p style={{ color: theme.textMuted, marginBottom: 28, fontSize: 14 }}>Login to your account</p>
          <Input label="Email" value={email} onChange={setEmail} placeholder="Enter your email" />
          <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Enter your password" />
          {err && <div style={{ color: theme.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <Btn onClick={handle} disabled={loading} style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}>
            {loading ? <Spinner /> : "Login"}
          </Btn>
          <div style={{ textAlign: "center", fontSize: 13, color: theme.textMuted }}>
            Don't have an account?{" "}
            <span onClick={onGoRegister} style={{ color: theme.accentLight, cursor: "pointer", fontWeight: 600 }}>Register here</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Register Page ────────────────────────────────────────────────────────────
const RegisterPage = ({ onGoLogin }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

 const handle = async () => {
  if (!name || !email || !pass)
    return setErr("All fields required.");

  if (pass !== confirm)
    return setErr("Passwords don't match.");

  setErr("");

  try {
    const res = await fetch(`${BASE_URL}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password: pass,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return setErr(data.error || "Registration failed");
    }

    setOk(true);
    setTimeout(onGoLogin, 1500);

  } catch (err) {
    setErr("Server error. Check backend connection.");
  }
};
  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", fontFamily: "'Space Grotesk',sans-serif" }}>
      <div style={{ flex: 1, background: `linear-gradient(160deg, #0a0a2e 0%, #1a0a3e 50%, #0d1a3e 100%)`, display: "flex", flexDirection: "column", justifyContent: "center", padding: "60px 48px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 30% 50%, rgba(124,58,237,0.15) 0%, transparent 60%)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>⚡</div>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#fff" }}>AI Summarizer</span>
          </div>
          <h1 style={{ fontSize: 38, fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 16 }}>
            <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Based</span><br />Document<br />Summarization
          </h1>
          <p style={{ color: theme.textMuted, fontSize: 15 }}>Smartly summarize your documents using the power of AI.</p>
        </div>
      </div>
      <div style={{ width: 460, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: "100%" }}>
          <h2 style={{ fontWeight: 800, fontSize: 24, color: theme.text, marginBottom: 4 }}>Create Account</h2>
          <p style={{ color: theme.textMuted, marginBottom: 24, fontSize: 14 }}>Register a new account</p>
          {ok && <div style={{ background: "#10b98122", border: "1px solid #10b98144", borderRadius: 8, padding: 12, color: "#10b981", marginBottom: 16, fontSize: 14 }}>✅ Registered! Redirecting…</div>}
          <Input label="Full Name" value={name} onChange={setName} placeholder="Enter your full name" />
          <Input label="Email" value={email} onChange={setEmail} placeholder="Enter your email" />
          <Input label="Password" type="password" value={pass} onChange={setPass} placeholder="Create password" />
          <Input label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Confirm password" />
          {err && <div style={{ color: theme.red, fontSize: 13, marginBottom: 12 }}>{err}</div>}
          <Btn onClick={handle} style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}>Register</Btn>
          <div style={{ textAlign: "center", fontSize: 13, color: theme.textMuted }}>
            Already have an account?{" "}
            <span onClick={onGoLogin} style={{ color: theme.accentLight, cursor: "pointer", fontWeight: 600 }}>Login here</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Home Page ────────────────────────────────────────────────────────────────
const RobotSVG = () => (
  <svg width="110" height="110" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="rg1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#7c3aed"/>
        <stop offset="100%" stopColor="#06b6d4"/>
      </linearGradient>
      <linearGradient id="rg2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#a78bfa"/>
        <stop offset="100%" stopColor="#7c3aed"/>
      </linearGradient>
    </defs>
    <rect x="22" y="44" width="66" height="48" rx="12" fill="url(#rg2)" opacity="0.92"/>
    <rect x="28" y="14" width="54" height="36" rx="10" fill="url(#rg1)"/>
    <line x1="55" y1="14" x2="55" y2="6" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round"/>
    <circle cx="55" cy="4" r="3" fill="#06b6d4"/>
    <rect x="35" y="24" width="14" height="10" rx="5" fill="#0a0a1a" opacity="0.8"/>
    <rect x="61" y="24" width="14" height="10" rx="5" fill="#0a0a1a" opacity="0.8"/>
    <circle cx="42" cy="29" r="3.5" fill="#06b6d4"/>
    <circle cx="68" cy="29" r="3.5" fill="#7c3aed"/>
    <circle cx="43.5" cy="27.5" r="1.2" fill="white"/>
    <circle cx="69.5" cy="27.5" r="1.2" fill="white"/>
    <rect x="40" y="40" width="30" height="5" rx="2.5" fill="#0a0a1a" opacity="0.6"/>
    <rect x="43" y="41.5" width="6" height="2" rx="1" fill="#10b981"/>
    <rect x="52" y="41.5" width="6" height="2" rx="1" fill="#10b981"/>
    <rect x="61" y="41.5" width="6" height="2" rx="1" fill="#10b981"/>
    <rect x="6" y="50" width="16" height="8" rx="4" fill="url(#rg1)" opacity="0.8"/>
    <rect x="88" y="50" width="16" height="8" rx="4" fill="url(#rg1)" opacity="0.8"/>
    <rect x="35" y="56" width="40" height="24" rx="8" fill="rgba(0,0,0,0.25)"/>
    <circle cx="45" cy="65" r="4" fill="#06b6d4" opacity="0.8"/>
    <circle cx="55" cy="65" r="4" fill="#a78bfa" opacity="0.8"/>
    <circle cx="65" cy="65" r="4" fill="#10b981" opacity="0.8"/>
    <rect x="40" y="73" width="30" height="3" rx="1.5" fill="#a78bfa" opacity="0.5"/>
    <rect x="34" y="92" width="16" height="12" rx="6" fill="url(#rg1)" opacity="0.75"/>
    <rect x="60" y="92" width="16" height="12" rx="6" fill="url(#rg1)" opacity="0.75"/>
  </svg>
);

const HomePage = ({ user, setPage }) => {
  const features = [
    { id: "legal", icon: "📄", label: "Legal Documents Summarization", color: theme.accent },
    { id: "healthcare", icon: "🏥", label: "Healthcare Report Summarization", color: theme.teal },
    { id: "news", icon: "📰", label: "News Summarization", color: theme.amber },
    { id: "education", icon: "🎓", label: "Education Summarization", color: theme.green },
    { id: "qa", icon: "❓", label: "Questions & Answers", color: "#f472b6" },
  ];

  const stats = [
    { label: "Documents Processed", value: "10K+", icon: "📄", color: theme.teal },
    { label: "Summaries Generated", value: "50K+", icon: "✅", color: theme.green },
    { label: "Happy Users", value: "2K+", icon: "😊", color: theme.amber },
    { label: "Languages Supported", value: "1+", icon: "🌐", color: "#f472b6" },
  ];

  const steps = [
    { num: "01", title: "Upload Document", desc: "Choose a PDF, DOCX, or TXT file from your device — any size, any complexity.", icon: "📁" },
    { num: "02", title: "AI Processes It", desc: "Our Claude-powered engine reads and understands every sentence in seconds.", icon: "⚡" },
    { num: "03", title: "Get Your Summary", desc: "Receive a clear, concise summary with key points highlighted. Listen or download.", icon: "🎯" },
  ];

  const testimonials = [
    { name: "Riya S.", role: "Law Student", text: "Saved me hours of reading through 80-page contracts. This tool is incredible!", stars: 5 },
    { name: "Dr. Arjun M.", role: "Physician", text: "Healthcare summaries are accurate and clinically relevant. Highly recommended.", stars: 5 },
    { name: "Priya K.", role: "Journalist", text: "I summarize 10 news articles before my morning coffee now. Game changer!", stars: 5 },
  ];

  return (
    <div style={{ padding: 36 }}>
      <Card style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, background: `linear-gradient(135deg, #0d0d22 0%, #1a0a3e 60%, #0d1a3e 100%)`, border: `1px solid ${theme.border}`, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -40, right: 100, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: -30, left: 200, width: 160, height: 160, borderRadius: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ flex: 1, position: "relative" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.15)", border: `1px solid ${theme.border}`, borderRadius: 999, padding: "4px 14px", marginBottom: 14 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.green, display: "inline-block" }} />
            <span style={{ fontSize: 12, color: theme.accentLight, fontWeight: 600 }}>Powered by Claude AI</span>
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginBottom: 8, lineHeight: 1.25 }}>Welcome back, <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{user.name}</span>! 👋</h1>
          <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.8, maxWidth: 440, marginBottom: 22 }}>Upload any document — legal, medical, educational, or news — and get a clear, accurate AI-powered summary in seconds. No more information overload.</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Btn onClick={() => setPage("legal")} icon="🚀">Get Started</Btn>
            <Btn variant="outline" onClick={() => setPage("about")} icon="ℹ️">Learn More</Btn>
          </div>
        </div>
        <div style={{ marginLeft: 32, flexShrink: 0, filter: "drop-shadow(0 0 24px rgba(124,58,237,0.5))" }}>
          <RobotSVG />
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 32 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ textAlign: "center", padding: "18px 12px", border: `1px solid ${s.color}22` }}>
            <div style={{ fontSize: 26, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 900, fontSize: 24, color: s.color, marginBottom: 2 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, color: theme.text, marginBottom: 16 }}>✨ Our Features</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 14, marginBottom: 36 }}>
        {features.map(f => (
          <Card key={f.id} style={{ textAlign: "center", cursor: "pointer", padding: "22px 12px", transition: "all 0.2s", border: `1px solid ${f.color}22` }}
            onClick={() => setPage(f.id)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = f.color + "66"; e.currentTarget.style.transform = "translateY(-3px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = f.color + "22"; e.currentTarget.style.transform = "translateY(0)"; }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + "18", border: `1px solid ${f.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, margin: "0 auto 10px" }}>{f.icon}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 500, lineHeight: 1.4 }}>{f.label}</div>
          </Card>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, color: theme.text, marginBottom: 20 }}>🔄 How It Works</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, marginBottom: 36 }}>
        {steps.map((s, i) => (
          <Card key={s.num} style={{ padding: 24, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 14, right: 16, fontWeight: 900, fontSize: 38, color: theme.accent, opacity: 0.08, lineHeight: 1 }}>{s.num}</div>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 14 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 8 }}>{s.title}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.7 }}>{s.desc}</div>
            {i < steps.length - 1 && (
              <div style={{ position: "absolute", right: -9, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: theme.accent, zIndex: 2 }}>›</div>
            )}
          </Card>
        ))}
      </div>

      <div style={{ fontWeight: 700, fontSize: 18, color: theme.text, marginBottom: 16 }}>💬 What Users Say</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 8 }}>
        {testimonials.map(t => (
          <Card key={t.name} style={{ padding: 22 }}>
            <div style={{ color: "#f59e0b", fontSize: 15, marginBottom: 10 }}>{"★".repeat(t.stars)}</div>
            <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.7, marginBottom: 14, fontStyle: "italic", opacity: 0.9 }}>"{t.text}"</p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Avatar name={t.name} size={30} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: theme.text }}>{t.name}</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{t.role}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── File Reading Status Component ───────────────────────────────────────────
const FileReadStatus = ({ status, fileName }) => {
  if (!status) return null;
  const config = {
    reading: { color: theme.amber, icon: "⏳", text: `Reading ${fileName}…` },
    success: { color: theme.green, icon: "✅", text: `${fileName} loaded successfully` },
    error:   { color: theme.red,   icon: "❌", text: status === "error" ? "Failed to read file" : status },
  };
  const c = config[status] ?? { color: theme.textMuted, icon: "ℹ️", text: status };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 12px", background: c.color + "11", border: `1px solid ${c.color}33`, borderRadius: 8, fontSize: 13, color: c.color }}>
      <span>{c.icon}</span> {c.text}
    </div>
  );
};

// ─── Summarize Page (generic) ─────────────────────────────────────────────────
const SummarizePage = ({ title, desc, addHistory }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [fileText, setFileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (f) => {
    setFile(f);
    setFileStatus("reading");
    setFileText("");
    setError("");
    try {
      const text = await readFileAsText(f);
      setFileText(text);
      setFileStatus("success");
    } catch (err) {
      setFileStatus("error");
      setError(err.message);
    }
  };

  const handleSummarize = async () => {
    if (!file) {
      alert("Please upload a file");
      return;
    }

    const text = await file.text();
    console.log(text);
    alert(text.substring(0, 500));

    setLoading(true);
    setSummary("");
    setError("");
    const result = await summarizeText(text);
    setSummary(result);
    if (addHistory) {
      addHistory({ type: title, file: file?.name || "Unknown", summary: result, date: new Date().toLocaleString() });
    }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 4 }}>{title}</div>
      <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>{desc}</div>
      <Card style={{ marginBottom: 20 }}>
        <UploadBox label={`Upload ${title.split(" ")[0]} Document`} onFile={handleFile} />
        <FileReadStatus status={fileStatus} fileName={file?.name} />
      </Card>
      {error && (
        <div style={{ background: theme.red + "11", border: `1px solid ${theme.red}33`, borderRadius: 10, padding: "10px 14px", color: theme.red, fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn onClick={handleSummarize} disabled={loading || !fileText} icon={loading ? <Spinner /> : "⚡"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
      {summary && <SummaryResult text={summary} />}
    </div>
  );
};

// ─── News Page ────────────────────────────────────────────────────────────────
const NewsPage = ({ addHistory }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [fileText, setFileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (f) => {
    setFile(f);
    setFileStatus("reading");
    setFileText("");
    setError("");
    try {
      const text = await readFileAsText(f);
      setFileText(text);
      setFileStatus("success");
    } catch (err) {
      setFileStatus("error");
      setError(err.message);
    }
  };

  const handle = async () => {
    if (!fileText) { setError("Please upload a file first."); return; }
    setLoading(true); setSummary(""); setError("");
    try {
      const res = await summarizeText(fileText);
      setSummary(res);
      addHistory({ type: "News Summarization", file: file?.name || "Uploaded File", summary: res, date: new Date().toLocaleString() });
    } catch { setSummary("Error. Try again."); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 4 }}>News Summarization</div>
      <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>Upload a news document or image to summarize.</div>
      <Card style={{ marginBottom: 16 }}>
        <UploadBox label="Upload a news file" onFile={handleFile} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp" />
        <FileReadStatus status={fileStatus} fileName={file?.name} />
      </Card>
      {error && (
        <div style={{ background: theme.red + "11", border: `1px solid ${theme.red}33`, borderRadius: 10, padding: "10px 14px", color: theme.red, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn onClick={handle} disabled={loading || !fileText} icon={loading ? <Spinner /> : "⚡"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
      {summary && <SummaryResult text={summary} />}
    </div>
  );
};

// ─── Education Page ───────────────────────────────────────────────────────────
const EducationPage = ({ addHistory }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [fileText, setFileText] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [docType, setDocType] = useState("Lecture Notes");

  const docTypes = ["Lecture Notes", "Textbook Chapter", "Research Paper", "Study Guide", "Syllabus", "Assignment Brief"];

  const handleFile = async (f) => {
    setFile(f);
    setFileStatus("reading");
    setFileText("");
    setError("");
    try {
      const text = await readFileAsText(f);
      setFileText(text);
      setFileStatus("success");
    } catch (err) {
      setFileStatus("error");
      setError(err.message);
    }
  };

  const handle = async () => {
    if (!fileText) { setError("Please upload a file first."); return; }
    setLoading(true); setSummary(""); setError("");
    try {
      const content = `Summarize the following ${docType.toLowerCase()}:\n\n${fileText}`;
      const res = await summarizeText(content);
      setSummary(res);
      addHistory({ type: "Education Summarization", file: file?.name || "Uploaded File", summary: res, date: new Date().toLocaleString() });
    } catch { setSummary("Error generating summary. Please try again."); }
    setLoading(false);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 6 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🎓</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 22, color: theme.text }}>Education Summarization</div>
          <div style={{ color: theme.textMuted, fontSize: 14 }}>Summarize lecture notes, textbooks, research papers, and more.</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "16px 0 24px" }}>
        {["Lecture Notes","Textbooks","Research Papers","Study Guides"].map(tag => (
          <span key={tag} style={{ background: "rgba(124,58,237,0.12)", color: theme.accentLight, border: `1px solid rgba(124,58,237,0.3)`, borderRadius: 999, padding: "3px 12px", fontSize: 12, fontWeight: 500 }}>{tag}</span>
        ))}
      </div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, color: theme.text, marginBottom: 12, fontSize: 14 }}>Document Type</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {docTypes.map(t => (
            <button key={t} onClick={() => setDocType(t)} style={{ padding: "7px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer", border: docType === t ? `1px solid ${theme.accent}` : `1px solid ${theme.borderLight}`, background: docType === t ? `${theme.accent}22` : "rgba(255,255,255,0.03)", color: docType === t ? theme.accentLight : theme.textMuted, transition: "all 0.15s" }}>{t}</button>
          ))}
        </div>
        <div style={{ fontWeight: 600, color: theme.text, marginBottom: 8, fontSize: 14 }}>Upload a File</div>
        <UploadBox label={`Upload ${docType}`} onFile={handleFile} accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp" />
        <FileReadStatus status={fileStatus} fileName={file?.name} />
      </Card>
      {error && (
        <div style={{ background: theme.red + "11", border: `1px solid ${theme.red}33`, borderRadius: 10, padding: "10px 14px", color: theme.red, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <Btn onClick={handle} disabled={loading || !fileText} icon={loading ? <Spinner /> : "🎓"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
      {summary && <SummaryResult text={summary} />}
    </div>
  );
};

// ─── QA Page ──────────────────────────────────────────────────────────────────
const QAPage = ({ addHistory }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  const handle = async () => {
    if (!question.trim()) return;
    setLoading(true); setAnswer("");
    try {
      const res = await askQuestion(question);
      setAnswer(res);
      addHistory({ type: "Q&A", file: "Question", summary: `Q: ${question}\nA: ${res}`, date: new Date().toLocaleString() });
    } catch { setAnswer("Error. Try again."); }
    setLoading(false);
  };

  const toggleTts = () => {
    if (ttsOn) {
      if (window.speechSynthesis) speechSynthesis.cancel();
      setSpeaking(false);
      setTtsOn(false);
    } else {
      setTtsOn(true);
    }
  };

  const speak = () => {
    if (!window.speechSynthesis || !answer || !ttsOn) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(answer);
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 4 }}>Questions & Answers</div>
      <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>Ask questions related to your document.</div>
      <Card>
        <div style={{ fontWeight: 600, color: theme.text, marginBottom: 10 }}>Your Question</div>
        <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What is the main purpose of this document?"
          style={{ width: "100%", minHeight: 80, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        <Btn onClick={handle} disabled={loading} icon={loading ? <Spinner /> : "💬"}>
          {loading ? "Thinking…" : "Ask"}
        </Btn>
        {answer && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 8 }}>Answer</div>
            <div style={{ background: "rgba(124,58,237,0.07)", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, color: theme.text, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{answer}</div>

            {/* TTS Toggle for Q&A */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: ttsOn ? "rgba(124,58,237,0.1)" : "rgba(255,255,255,0.04)", border: `1px solid ${ttsOn ? theme.accent + "55" : theme.borderLight}`, borderRadius: 10, transition: "all 0.2s" }}>
              <span style={{ fontSize: 14, color: theme.textMuted, fontWeight: 500 }}>🔊 Text to Voice</span>
              <button
                onClick={toggleTts}
                style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: ttsOn ? G : "rgba(255,255,255,0.12)", position: "relative", transition: "all 0.25s", boxShadow: ttsOn ? `0 2px 10px ${theme.accentGlow}` : "none", flexShrink: 0 }}
                title={ttsOn ? "Turn off text to voice" : "Turn on text to voice"}
              >
                <span style={{ position: "absolute", top: 3, left: ttsOn ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.25s", display: "block", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
              </button>
              <span style={{ fontSize: 12, color: ttsOn ? theme.accentLight : theme.textMuted, fontWeight: 600 }}>{ttsOn ? "ON" : "OFF"}</span>
              {ttsOn && (
                <Btn variant="ghost" onClick={speak} disabled={speaking} icon={speaking ? <Spinner /> : "▶"} style={{ marginLeft: "auto", padding: "6px 14px", fontSize: 13 }}>
                  {speaking ? "Speaking…" : "Play"}
                </Btn>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── History Page ─────────────────────────────────────────────────────────────
const HistoryPage = ({ history, clearHistory }) => (
  <div style={{ padding: 32, maxWidth: 900 }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text }}>History</div>
      {history.length > 0 && <Btn variant="danger" onClick={clearHistory}>Clear All</Btn>}
    </div>
    {history.length === 0 ? (
      <Card style={{ textAlign: "center", padding: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
        <div style={{ color: theme.textMuted }}>No history yet. Start summarizing!</div>
      </Card>
    ) : (
      history.slice().reverse().map((h, i) => (
        <Card key={i} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
            <div>
              <Badge color={theme.accent}>{h.type}</Badge>
              <span style={{ marginLeft: 10, fontSize: 13, color: theme.textMuted }}>{h.file}</span>
            </div>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{h.date}</span>
          </div>
          <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.6, opacity: 0.85 }}>
            {h.summary.slice(0, 200)}{h.summary.length > 200 ? "…" : ""}
          </div>
        </Card>
      ))
    )}
  </div>
);

// ─── Profile Page ─────────────────────────────────────────────────────────────
const ProfilePage = ({ user, history }) => {
  const stats = [
    { label: "Total Summaries", value: history.length, icon: "📄" },
    { label: "Q&A Sessions", value: history.filter(h => h.type === "Q&A").length, icon: "❓" },
    { label: "Documents", value: history.filter(h => h.type !== "Q&A").length, icon: "📁" },
  ];
  return (
    <div style={{ padding: 32, maxWidth: 700 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 24 }}>Profile</div>
      <Card style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20 }}>
        <Avatar name={user.name} size={64} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, color: theme.text }}>{user.name}</div>
          <div style={{ color: theme.textMuted, fontSize: 14 }}>{user.email}</div>
          <Badge color={user.role === "admin" ? theme.amber : theme.green}>{user.role === "admin" ? "Admin" : "User"}</Badge>
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: theme.accentLight }}>{s.value}</div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>{s.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

// ─── About Page ───────────────────────────────────────────────────────────────
const BrainSVG = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient></defs>
    <circle cx="28" cy="28" r="26" fill="url(#bg1)" opacity="0.15"/>
    <circle cx="28" cy="28" r="22" fill="url(#bg1)" opacity="0.1"/>
    <text x="28" y="36" textAnchor="middle" fontSize="26">🧠</text>
  </svg>
);
const DesignSVG = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="26" fill="rgba(6,182,212,0.12)"/>
    <text x="28" y="36" textAnchor="middle" fontSize="26">🎨</text>
  </svg>
);
const EngineerSVG = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="28" cy="28" r="26" fill="rgba(16,185,129,0.12)"/>
    <text x="28" y="36" textAnchor="middle" fontSize="26">⚙️</text>
  </svg>
);
const HeroBannerSVG = () => (
  <svg viewBox="0 0 700 180" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", height: "auto", borderRadius: 14, display: "block" }}>
    <defs>
      <linearGradient id="hbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#0d0d30"/><stop offset="50%" stopColor="#1a0a3e"/><stop offset="100%" stopColor="#0d1a3e"/></linearGradient>
      <linearGradient id="hgr" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="100%" stopColor="#06b6d4"/></linearGradient>
      <radialGradient id="hglow1" cx="30%" cy="50%"><stop offset="0%" stopColor="#7c3aed" stopOpacity="0.3"/><stop offset="100%" stopColor="transparent" stopOpacity="0"/></radialGradient>
      <radialGradient id="hglow2" cx="80%" cy="60%"><stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2"/><stop offset="100%" stopColor="transparent" stopOpacity="0"/></radialGradient>
    </defs>
    <rect width="700" height="180" fill="url(#hbg)"/>
    <ellipse cx="210" cy="90" rx="200" ry="120" fill="url(#hglow1)"/>
    <ellipse cx="560" cy="100" rx="180" ry="100" fill="url(#hglow2)"/>
    {[40,120,200,280,360,440,520,600,660].map((x, i) => (
      <circle key={i} cx={x} cy={20 + (i % 3) * 50} r={1.5 + (i % 2)} fill="#a78bfa" opacity={0.3 + (i % 4) * 0.1}/>
    ))}
    <rect x="60" y="54" width="36" height="46" rx="5" fill="rgba(124,58,237,0.25)" stroke="#7c3aed" strokeWidth="1"/>
    <line x1="67" y1="70" x2="89" y2="70" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="67" y1="78" x2="89" y2="78" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="67" y1="86" x2="80" y2="86" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M110 77 L140 77" stroke="url(#hgr)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>
    <polygon points="140,73 148,77 140,81" fill="#06b6d4"/>
    <circle cx="180" cy="77" r="22" fill="rgba(124,58,237,0.2)" stroke="url(#hgr)" strokeWidth="1.5"/>
    <text x="180" y="84" textAnchor="middle" fontSize="20">⚡</text>
    <path d="M204 77 L234 77" stroke="url(#hgr)" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round"/>
    <polygon points="234,73 242,77 234,81" fill="#7c3aed"/>
    <rect x="248" y="50" width="80" height="54" rx="8" fill="rgba(6,182,212,0.15)" stroke="#06b6d4" strokeWidth="1"/>
    <line x1="258" y1="66" x2="318" y2="66" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="258" y1="74" x2="318" y2="74" stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="258" y1="82" x2="295" y2="82" stroke="#06b6d4" strokeWidth="1.5" strokeLinecap="round"/>
    <line x1="258" y1="90" x2="310" y2="90" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
    <text x="420" y="68" fill="#ffffff" fontWeight="800" fontSize="22" fontFamily="sans-serif">AI Summarizer</text>
    <text x="420" y="90" fill="#a78bfa" fontSize="13" fontFamily="sans-serif">Transforming how you read documents</text>
    <text x="420" y="108" fill="#94a3b8" fontSize="11" fontFamily="sans-serif">Claude AI · Built with React · Instant Results</text>
    <rect x="420" y="118" width="68" height="20" rx="10" fill="rgba(124,58,237,0.25)" stroke="#7c3aed" strokeWidth="1"/>
    <text x="454" y="132" fill="#a78bfa" fontSize="10" textAnchor="middle" fontFamily="sans-serif">📄 Legal</text>
    <rect x="496" y="118" width="86" height="20" rx="10" fill="rgba(6,182,212,0.2)" stroke="#06b6d4" strokeWidth="1"/>
    <text x="539" y="132" fill="#06b6d4" fontSize="10" textAnchor="middle" fontFamily="sans-serif">🏥 Healthcare</text>
    <rect x="590" y="118" width="72" height="20" rx="10" fill="rgba(16,185,129,0.2)" stroke="#10b981" strokeWidth="1"/>
    <text x="626" y="132" fill="#10b981" fontSize="10" textAnchor="middle" fontFamily="sans-serif">🎓 Education</text>
  </svg>
);

const AboutPage = () => {
  const features = [
    { icon: "📄", title: "Legal Summarization", desc: "Instantly extract key clauses, obligations, and parties from complex legal documents.", color: theme.accent },
    { icon: "🏥", title: "Healthcare Summarization", desc: "Summarize medical reports highlighting diagnoses, treatments, and recommendations.", color: theme.teal },
    { icon: "📰", title: "News Summarization", desc: "Get concise, factual summaries of news articles and media content.", color: theme.amber },
    { icon: "🎓", title: "Education Summarization", desc: "Condense lecture notes, textbooks, and research papers into clear takeaways.", color: theme.green },
    { icon: "❓", title: "Q&A Assistant", desc: "Ask questions about your documents and receive accurate AI-powered answers.", color: "#f472b6" },
    { icon: "🔊", title: "Text to Voice", desc: "Listen to your summaries with built-in text-to-speech toggle control.", color: "#fb923c" },
  ];
  const team = [
    { name: "AI Research Team", role: "Model & Prompt Engineering", svgComp: <BrainSVG />, color: theme.accent, skills: ["Claude AI", "Prompt Design", "NLP"] },
    { name: "Product Team", role: "Design & User Experience", svgComp: <DesignSVG />, color: theme.teal, skills: ["UI/UX", "Figma", "Accessibility"] },
    { name: "Engineering Team", role: "Platform & Infrastructure", svgComp: <EngineerSVG />, color: theme.green, skills: ["React", "REST APIs", "Cloud"] },
  ];
  const milestones = [
    { year: "2024", event: "Project inception — idea born to democratize document reading." },
    { year: "Early 2025", event: "Core summarization engine launched with legal & healthcare support." },
    { year: "Mid 2025", event: "News, Education & Q&A modules released to growing user base." },
    { year: "2026", event: "Text-to-voice toggle, multilingual support & admin dashboard added." },
  ];

  return (
    <div style={{ padding: 36, maxWidth: 860 }}>
      <div style={{ marginBottom: 28 }}><HeroBannerSVG /></div>
      <Card style={{ marginBottom: 28, background: `linear-gradient(135deg, #0d0d22, #1a0a3e)`, border: `1px solid ${theme.border}`, textAlign: "center", padding: "32px 40px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: "#fff", marginBottom: 10 }}>About <span style={{ background: G, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI Summarizer</span></h1>
        <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.9, maxWidth: 580, margin: "0 auto" }}>AI Summarizer is an intelligent document analysis platform that harnesses the power of large language models to help you extract insights from legal, medical, educational, and news documents — in seconds.</p>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 28 }}>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 14 }}>🎯 Our Mission</div>
          <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.85, marginBottom: 16 }}>We believe critical information should be accessible to everyone. Our mission is to eliminate information overload by providing fast, accurate, and context-aware document summaries.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {["Accessibility for all", "Speed over complexity", "Accuracy you can trust", "Privacy by design"].map(v => (
              <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: theme.text }}><span style={{ color: theme.green, fontWeight: 700 }}>✓</span>{v}</div>
            ))}
          </div>
        </Card>
        <Card>
          <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 14 }}>📅 Our Journey</div>
          {milestones.map((m, i) => (
            <div key={m.year} style={{ display: "flex", gap: 14, position: "relative" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: G, flexShrink: 0, marginTop: 3 }} />
                {i < milestones.length - 1 && <div style={{ width: 2, flex: 1, background: `${theme.accent}33`, minHeight: 24 }} />}
              </div>
              <div style={{ paddingBottom: 16 }}>
                <div style={{ fontSize: 11, color: theme.accentLight, fontWeight: 700, marginBottom: 2 }}>{m.year}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.6 }}>{m.event}</div>
              </div>
            </div>
          ))}
        </Card>
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 16 }}>✨ What We Offer</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {features.map(f => (
          <Card key={f.title} style={{ padding: 20, border: `1px solid ${f.color}22`, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = f.color + "55"}
            onMouseLeave={e => e.currentTarget.style.borderColor = f.color + "22"}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, lineHeight: 1.6 }}>{f.desc}</div>
          </Card>
        ))}
      </div>
      <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 16 }}>👥 Our Team</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 }}>
        {team.map(t => (
          <Card key={t.name} style={{ textAlign: "center", padding: 28, border: `1px solid ${t.color}22` }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>{t.svgComp}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 4 }}>{t.name}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 14 }}>{t.role}</div>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
              {t.skills.map(sk => (
                <span key={sk} style={{ background: t.color + "18", color: t.color, border: `1px solid ${t.color}33`, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>{sk}</span>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 14 }}>🛠️ Technology Stack</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {["Claude AI (Anthropic)","React","JavaScript","REST API","Speech Synthesis API","PDF & DOCX Parsing"].map(tech => (
            <span key={tech} style={{ background: `${theme.accent}18`, color: theme.accentLight, border: `1px solid ${theme.border}`, borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>{tech}</span>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Feedback Page ────────────────────────────────────────────────────────────
const FeedbackPage = ({ user }) => {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [category, setCategory] = useState("General");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState("");

  const categories = ["General", "Legal Summarization", "Healthcare", "News", "Education", "Q&A", "Bug Report"];

  const handleSubmit = () => {
    if (!rating) return setErr("Please select a star rating.");
    if (!message.trim()) return setErr("Please enter your feedback message.");
    setErr("");
    const feedbacks = JSON.parse(localStorage.getItem("ai_feedbacks") || "[]");
    feedbacks.push({ id: Date.now(), name: user.name, email: user.email, rating, category, message, date: new Date().toLocaleString() });
    localStorage.setItem("ai_feedbacks", JSON.stringify(feedbacks));
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ padding: 32, maxWidth: 600, margin: "0 auto", textAlign: "center" }}>
      <Card style={{ padding: "60px 40px" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 10 }}>Thank You!</div>
        <div style={{ color: theme.textMuted, fontSize: 15, lineHeight: 1.7 }}>Your feedback has been submitted successfully.</div>
        <div style={{ marginTop: 24 }}>
          <Btn onClick={() => { setSubmitted(false); setRating(0); setMessage(""); setCategory("General"); }}>Submit Another</Btn>
        </div>
      </Card>
    </div>
  );

  return (
    <div style={{ padding: 32, maxWidth: 680 }}>
      <div style={{ fontWeight: 800, fontSize: 22, color: theme.text, marginBottom: 4 }}>💬 Feedback</div>
      <div style={{ color: theme.textMuted, fontSize: 14, marginBottom: 28 }}>Help us improve by sharing your experience.</div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, padding: "12px 16px", background: "rgba(124,58,237,0.07)", borderRadius: 10, border: `1px solid ${theme.border}` }}>
          <Avatar name={user.name} size={38} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>{user.name}</div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>{user.email}</div>
          </div>
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500, marginBottom: 10 }}>Overall Rating *</div>
          <div style={{ display: "flex", gap: 8 }}>
            {[1,2,3,4,5].map(s => (
              <span key={s} onClick={() => setRating(s)} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered(0)}
                style={{ fontSize: 36, cursor: "pointer", color: s <= (hovered || rating) ? "#f59e0b" : "rgba(255,255,255,0.15)", transition: "all 0.15s", filter: s <= (hovered || rating) ? "drop-shadow(0 0 6px #f59e0b88)" : "none" }}>★</span>
            ))}
          </div>
          {rating > 0 && <div style={{ marginTop: 6, fontSize: 12, color: theme.textMuted }}>{["","Poor","Fair","Good","Very Good","Excellent"][rating]}</div>}
        </div>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500, marginBottom: 10 }}>Category</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {categories.map(c => (
              <button key={c} onClick={() => setCategory(c)} style={{ padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", border: category === c ? `1px solid ${theme.accent}` : `1px solid ${theme.borderLight}`, background: category === c ? `${theme.accent}22` : "rgba(255,255,255,0.03)", color: category === c ? theme.accentLight : theme.textMuted, transition: "all 0.15s" }}>{c}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500, marginBottom: 8 }}>Your Feedback *</div>
          <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Tell us about your experience, suggestions, or any issues you faced…"
            style={{ width: "100%", minHeight: 120, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box", fontFamily: "inherit", lineHeight: 1.6 }}
            onFocus={e => e.target.style.borderColor = theme.accent}
            onBlur={e => e.target.style.borderColor = theme.border}
          />
        </div>
        {err && <div style={{ color: theme.red, fontSize: 13, marginBottom: 14 }}>⚠️ {err}</div>}
        <Btn onClick={handleSubmit} icon="📤">Submit Feedback</Btn>
      </Card>
    </div>
  );
};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = ({ onLogout }) => {
  const users = JSON.parse(localStorage.getItem("ai_users") || "[]");
  const feedbacks = JSON.parse(localStorage.getItem("ai_feedbacks") || "[]");
  const [tab, setTab] = useState("dashboard");
  const metrics = [
    { label: "Total Users", value: users.length + 1, icon: "👥", color: theme.teal },
    { label: "Total Documents", value: 256, icon: "📄", color: theme.amber },
    { label: "Total Summaries", value: 512, icon: "✅", color: theme.green },
    { label: "Feedbacks", value: feedbacks.length, icon: "💬", color: theme.accent },
  ];
  const activity = [
    { msg: "John Doe uploaded a document", time: "2 mins ago" },
    { msg: "Jane Smith asked a question", time: "10 mins ago" },
    { msg: "New user registered: Alex", time: "30 mins ago" },
    { msg: "Document summarized", time: "1 hour ago" },
  ];
  const chartData = [20, 40, 35, 60, 45, 90];
  const months = ["Jan","Feb","Mar","Apr","May","Jun"];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", fontFamily: "'Space Grotesk',sans-serif" }}>
      <aside style={{ width: 200, background: "#0d0d1a", borderRight: `1px solid ${theme.borderLight}`, padding: "24px 0" }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${theme.borderLight}`, fontWeight: 800, fontSize: 15, color: theme.accentLight }}>Admin Panel</div>
        {[["dashboard","📊","Dashboard"],["users","👥","Users"],["documents","📄","Documents"],["summaries","✅","Summaries"],["feedback","💬","Client Feedback"],["logs","📋","Activity Logs"],["settings","⚙️","Settings"]].map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: tab === id ? `${theme.accent}22` : "transparent", border: "none", cursor: "pointer", color: tab === id ? theme.accentLight : theme.textMuted, fontSize: 13.5, fontWeight: tab === id ? 600 : 400, borderLeft: tab === id ? `3px solid ${theme.accent}` : "3px solid transparent" }}>
            <span>{icon}</span>{label}
          </button>
        ))}
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13.5, marginTop: 12 }}>🚪 Logout</button>
      </aside>
      <div style={{ flex: 1, padding: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div style={{ fontWeight: 800, fontSize: 22, color: theme.text }}>Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar name="A" size={30} />
            <span style={{ fontSize: 13, color: theme.text }}>admin</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
          {metrics.map(m => (
            <Card key={m.label}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{m.label}</div>
                  <div style={{ fontWeight: 900, fontSize: 32, color: m.color }}>{m.value}</div>
                </div>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
              </div>
            </Card>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>Documents Uploaded</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 120 }}>
              {chartData.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", background: G, borderRadius: "4px 4px 0 0", height: `${(v / 90) * 100}%`, minHeight: 4 }} />
                  <div style={{ fontSize: 10, color: theme.textMuted }}>{months[i]}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>Recent Activity</div>
            {activity.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: theme.accent, marginTop: 5, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, color: theme.text }}>{a.msg}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{a.time}</div>
                </div>
              </div>
            ))}
          </Card>
        </div>
        {tab === "users" && (
          <Card style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>Registered Users</div>
            {users.length === 0 ? <div style={{ color: theme.textMuted }}>No users registered yet.</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Name","Email","Role"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: theme.textMuted, fontSize: 12, borderBottom: `1px solid ${theme.borderLight}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={i}>
                      <td style={{ padding: "10px 12px", color: theme.text, fontSize: 13 }}>{u.name}</td>
                      <td style={{ padding: "10px 12px", color: theme.textMuted, fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: "10px 12px" }}><Badge color={theme.green}>User</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
        {tab === "feedback" && (
          <Card style={{ marginTop: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>💬 Client Feedback</div>
              <Badge color={theme.accent}>{feedbacks.length} Total</Badge>
            </div>
            {feedbacks.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: theme.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div>No feedback submitted yet.</div>
              </div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 24 }}>
                  {[
                    { label: "Avg Rating", value: (feedbacks.reduce((s,f) => s + f.rating, 0) / feedbacks.length).toFixed(1) + " ★", color: theme.amber },
                    { label: "5-Star Reviews", value: feedbacks.filter(f => f.rating === 5).length, color: theme.green },
                    { label: "Bug Reports", value: feedbacks.filter(f => f.category === "Bug Report").length, color: theme.red },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: "14px 18px" }}>
                      <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontWeight: 800, fontSize: 22, color: s.color }}>{s.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {feedbacks.slice().reverse().map((f, i) => (
                    <div key={f.id || i} style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 18, background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={f.name} size={34} />
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{f.name}</div>
                            <div style={{ fontSize: 11, color: theme.textMuted }}>{f.email}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, color: "#f59e0b", marginBottom: 2 }}>{"★".repeat(f.rating)}{"☆".repeat(5 - f.rating)}</div>
                          <div style={{ fontSize: 11, color: theme.textMuted }}>{f.date}</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <Badge color={f.category === "Bug Report" ? theme.red : theme.accent}>{f.category}</Badge>
                        <Badge color={[theme.red,theme.amber,theme.amber,theme.green,theme.green][f.rating-1]}>{["Poor","Fair","Good","Very Good","Excellent"][f.rating-1]}</Badge>
                      </div>
                      <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.7, background: "rgba(124,58,237,0.05)", padding: "10px 14px", borderRadius: 8, border: `1px solid ${theme.border}` }}>{f.message}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useLocalStorage("ai_auth", null);
  const [screen, setScreen] = useState("login");
  const [page, setPage] = useState("home");
  const [history, setHistory] = useLocalStorage("ai_history", []);

  const addHistory = (item) => setHistory(prev => [...prev, item]);
  const clearHistory = () => setHistory([]);
  const login = (user) => { setAuth(user); setPage(user.role === "admin" ? "admin" : "home"); };
  const logout = () => {
    setAuth(null);
    setPage("home");
    setScreen("login");
    localStorage.removeItem("ai_auth");
  };

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap');
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0a0a1a; font-family: 'Space Grotesk', sans-serif; }
      @keyframes spin { to { transform: rotate(360deg); } }
      ::-webkit-scrollbar { width: 6px; } ::-webkit-scrollbar-track { background: #0a0a1a; }
      ::-webkit-scrollbar-thumb { background: #7c3aed44; border-radius: 3px; }
      select option { background: #10102a; color: #e2e8f0; }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  if (!auth) {
    if (screen === "register") return <RegisterPage onGoLogin={() => setScreen("login")} />;
    return <LoginPage onLogin={login} onGoRegister={() => setScreen("register")} />;
  }

  if (auth.role === "admin") return <AdminDashboard onLogout={logout} />;

  const mainPages = {
    home: <HomePage user={auth} setPage={setPage} />,
    legal: <SummarizePage title="Legal Document Summarization" desc="Upload your legal document and get an AI-powered summary." addHistory={addHistory} />,
    healthcare: <SummarizePage title="Healthcare Report Summarization" desc="Upload a healthcare report and get an AI-powered summary." addHistory={addHistory} />,
    news: <NewsPage addHistory={addHistory} />,
    education: <EducationPage addHistory={addHistory} />,
    qa: <QAPage addHistory={addHistory} />,
    history: <HistoryPage history={history} clearHistory={clearHistory} />,
    profile: <ProfilePage user={auth} history={history} />,
    about: <AboutPage />,
    feedback: <FeedbackPage user={auth} />,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: theme.bg, fontFamily: "'Space Grotesk',sans-serif" }}>
      <Topbar user={auth} />
      <div style={{ display: "flex", flex: 1 }}>
        <Sidebar page={page} setPage={setPage} user={auth} onLogout={logout} />
        <main style={{ flex: 1, overflowY: "auto", color: theme.text }}>
          {mainPages[page] ?? mainPages.home}
        </main>
      </div>
    </div>
  );
}
