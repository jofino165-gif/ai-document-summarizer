import { useState, useEffect, useRef, Fragment } from "react";
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
const SummaryResult = ({ text, category, recommendation, prediction }) => {
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
      <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 10 }}>✅ Summary</div>
      <div style={{ background: "rgba(124,58,237,0.07)", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 18, color: theme.text, fontSize: 14, lineHeight: 1.7, marginBottom: 14, whiteSpace: "pre-wrap" }}>{text}</div>

      {category && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 8 }}>✅ Category</div>
          <Badge color={theme.teal}>{category}</Badge>
        </div>
      )}

      {recommendation && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 8 }}>✅ Recommendation</div>
          <div style={{ background: "rgba(16,185,129,0.08)", border: `1px solid ${theme.green}33`, borderRadius: 12, padding: 16, color: theme.text, fontSize: 14, lineHeight: 1.7 }}>{recommendation}</div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <span style={{ fontSize: 11, color: theme.textMuted, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.borderLight}`, borderRadius: 20, padding: "4px 10px" }}>🧠 Summarized by T5 (fine-tuned)</span>
        {category && <span style={{ fontSize: 11, color: theme.textMuted, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.borderLight}`, borderRadius: 20, padding: "4px 10px" }}>🏷️ Category detected by BERT</span>}
      </div>

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
const BASE_URL = "http://13.63.139.185:5000";

const getToken = () => localStorage.getItem("token");

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// POST /api/login  →  { token, user }
const apiLogin = async (email, password) => {
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Invalid credentials");
  if (data.token) localStorage.setItem("token", data.token);
  return data;
};

// POST /api/register  →  { username, email, password }
const apiRegister = async (username, email, password) => {
  const res = await fetch(`${BASE_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  return data;
};

// POST /api/summarize (multipart/form-data)  →  { summary, category, recommendation, history_id }
const summarizeFile = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE_URL}/api/summarize`, {
    method: "POST",
    headers: { ...authHeaders() }, // do NOT set Content-Type manually for FormData
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Summarization failed");
  return data;
};

// POST /api/qa  →  { history_id, question }  →  { answer }
const askQuestion = async (historyId, question) => {
  const res = await fetch(`${BASE_URL}/api/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ history_id: historyId, question }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to get an answer");
  return data.answer;
};

// GET /api/history
const fetchHistory = async () => {
  const res = await fetch(`${BASE_URL}/api/history`, {
    method: "GET",
    headers: { ...authHeaders() },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load history");
  return Array.isArray(data) ? data : (data.history || []);
};

// POST /api/feedback
const submitFeedback = async (payload) => {
  const res = await fetch(`${BASE_URL}/api/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to submit feedback");
  return data;
};

// ── Admin API (matches the documented backend contract) ──────────────────────
const adminGet = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, { method: "GET", headers: { ...authHeaders() } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Failed to load ${path}`);
  return data;
};
const adminDelete = async (path) => {
  const res = await fetch(`${BASE_URL}${path}`, { method: "DELETE", headers: { ...authHeaders() } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Failed to delete via ${path}`);
  return data;
};

// GET /api/admin/dashboard → { total_users, total_documents, total_summaries, total_questions, total_feedback, active_users }
const fetchAdminStats = () => adminGet("/api/admin/dashboard");
// GET /api/admin/users → [{ id, username, email, joined }]
const fetchAdminUsers = () => adminGet("/api/admin/users");
// DELETE /api/admin/users/<id>
const deleteAdminUser = (id) => adminDelete(`/api/admin/users/${id}`);
// GET /api/admin/documents → [{ id, filename, category, uploaded_by, date }]
const fetchAdminDocuments = () => adminGet("/api/admin/documents");
// GET /api/admin/history → every summarized document
const fetchAdminHistory = () => adminGet("/api/admin/history");
// GET /api/admin/feedback → [{ id, username, rating, comment }]
const fetchAdminFeedback = () => adminGet("/api/admin/feedback");
// DELETE /api/admin/feedback/<id>
const deleteAdminFeedback = (id) => adminDelete(`/api/admin/feedback/${id}`);
// GET /api/admin/categories → { study_important, health_risk, news_alert, legal_expiry }
const fetchAdminCategories = () => adminGet("/api/admin/categories");
// GET /api/admin/model-status → { summarizer, detector, qa_model }
const fetchAdminModelStatus = () => adminGet("/api/admin/model-status");
// GET /api/admin/system → { cpu, memory, disk }
const fetchAdminSystem = () => adminGet("/api/admin/system");
// GET /api/admin/logs
const fetchAdminLogs = () => adminGet("/api/admin/logs");
// GET /api/admin/profile
const fetchAdminProfile = () => adminGet("/api/admin/profile");

// Loads every admin data source in parallel; each is isolated so one failing
// endpoint doesn't blank out the rest of the dashboard.
const fetchAdminDashboardBundle = async () => {
  const settle = (p) => p.then(v => ({ ok: true, value: v })).catch(e => ({ ok: false, error: e.message }));
  const [stats, users, documents, history, feedback, categories, modelStatus, system, logs] = await Promise.all([
    settle(fetchAdminStats()),
    settle(fetchAdminUsers()),
    settle(fetchAdminDocuments()),
    settle(fetchAdminHistory()),
    settle(fetchAdminFeedback()),
    settle(fetchAdminCategories()),
    settle(fetchAdminModelStatus()),
    settle(fetchAdminSystem()),
    settle(fetchAdminLogs()),
  ]);
  return { stats, users, documents, history, feedback, categories, modelStatus, system, logs };
};

// ─── Login Page ───────────────────────────────────────────────────────────────
const LoginPage = ({ onLogin, onGoRegister }) => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
const handle = async () => {
  console.log("STEP 1: Login button clicked");

  setLoading(true);
  setErr("");

  if (!email || !pass) {
    setErr("Please enter email and password.");
    setLoading(false);
    return;
  }

  try {
    console.log("STEP 2: Calling apiLogin");

    const data = await apiLogin(email, pass);

    console.log("STEP 3: Login success", data);

    onLogin({
      name: data.user.name,
      email: data.user.email,
      role: data.user.role === "admin" ? "admin" : "user",
    });

  } catch (err) {
    console.log("STEP 4: Login failed", err);
    setErr(err.message);
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
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

const handle = async () => {
  if (!username || !email || !pass) {
    setErr("All fields required.");
    return;
  }

  if (pass !== confirm) {
    setErr("Passwords don't match.");
    return;
  }

  setErr("");

  try {
    await apiRegister(username, email, pass);

    setOk(true);

    setTimeout(() => {
      onGoLogin();
    }, 1500);

  } catch (err) {
    setErr(err.message);
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
          <Input label="Username" value={username} onChange={setUsername} placeholder="Enter your username" />
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
const SummarizePage = ({ title, desc, addHistory, setHistoryId }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = (f) => {
    setFile(f);
    setFileStatus("success");
    setError("");
    setResult(null);
  };

  const handleSummarize = async () => {
    if (!file) {
      setError("Please upload a file first.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError("");
    try {
      const data = await summarizeFile(file);
      setResult(data);
      if (setHistoryId) setHistoryId(data.history_id);
      if (addHistory) {
        addHistory({ type: title, file: file?.name || "Unknown", summary: data.summary, date: new Date().toLocaleString() });
      }
    } catch (err) {
      setError(err.message || "Error generating summary. Please try again.");
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
        <Btn onClick={handleSummarize} disabled={loading || !file} icon={loading ? <Spinner /> : "⚡"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
      {result && <SummaryResult text={result.summary} category={result.category} recommendation={result.recommendation} />}
    </div>
  );
};

// ─── News Page ────────────────────────────────────────────────────────────────
const NewsPage = ({ addHistory, setHistoryId }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = (f) => {
    setFile(f);
    setFileStatus("success");
    setError("");
    setResult(null);
  };

  const handle = async () => {
    if (!file) { setError("Please upload a file first."); return; }
    setLoading(true); setResult(null); setError("");
    try {
      const data = await summarizeFile(file);
      setResult(data);
      if (setHistoryId) setHistoryId(data.history_id);
      addHistory({ type: "News Summarization", file: file?.name || "Uploaded File", summary: data.summary, date: new Date().toLocaleString() });
    } catch (err) {
      setError(err.message || "Error. Try again.");
    }
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
        <Btn onClick={handle} disabled={loading || !file} icon={loading ? <Spinner /> : "⚡"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
{result && (
  <SummaryResult
    text={result.summary}
    category={result.category}
    recommendation={result.recommendation}
    prediction={result.prediction}
  />
)}
   </div>
  );
};

// ─── Education Page ───────────────────────────────────────────────────────────
const EducationPage = ({ addHistory, setHistoryId }) => {
  const [file, setFile] = useState(null);
  const [fileStatus, setFileStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState("Lecture Notes");

  const docTypes = ["Lecture Notes", "Textbook Chapter", "Research Paper", "Study Guide", "Syllabus", "Assignment Brief"];

  const handleFile = (f) => {
    setFile(f);
    setFileStatus("success");
    setError("");
    setResult(null);
  };

  const handle = async () => {
    if (!file) { setError("Please upload a file first."); return; }
    setLoading(true); setResult(null); setError("");
    try {
      const data = await summarizeFile(file);
      setResult(data);
      if (setHistoryId) setHistoryId(data.history_id);
      addHistory({ type: "Education Summarization", file: file?.name || "Uploaded File", summary: data.summary, date: new Date().toLocaleString() });
    } catch (err) {
      setError(err.message || "Error generating summary. Please try again.");
    }
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
        <Btn onClick={handle} disabled={loading || !file} icon={loading ? <Spinner /> : "🎓"}>
          {loading ? "Summarizing…" : "Summarize"}
        </Btn>
        {!file && <span style={{ fontSize: 13, color: theme.textMuted }}>Upload a file to enable summarization</span>}
      </div>
      {result && <SummaryResult text={result.summary} category={result.category} recommendation={result.recommendation} />}
    </div>
  );
};

// ─── QA Page ──────────────────────────────────────────────────────────────────
const QAPage = ({ addHistory, historyId }) => {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [ttsOn, setTtsOn] = useState(false);

  const handle = async () => {
    if (!question.trim()) return;
    if (!historyId) { setError("Summarize a document first, then ask questions about it."); return; }
    setLoading(true); setAnswer(""); setError("");
    try {
      const res = await askQuestion(historyId, question);
      setAnswer(res);
      addHistory({ type: "Q&A", file: "Question", summary: `Q: ${question}\nA: ${res}`, date: new Date().toLocaleString() });
    } catch (err) {
      setError(err.message || "Error. Try again.");
    }
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
      {!historyId && (
        <div style={{ background: theme.amber + "11", border: `1px solid ${theme.amber}33`, borderRadius: 10, padding: "10px 14px", color: theme.amber, fontSize: 13, marginBottom: 16 }}>
          ℹ️ Summarize a document first — questions are answered based on your most recently summarized document.
        </div>
      )}
      <Card>
        <div style={{ fontWeight: 600, color: theme.text, marginBottom: 10 }}>Your Question</div>
        <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="What is the main purpose of this document?"
          style={{ width: "100%", minHeight: 80, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.border}`, borderRadius: 10, color: theme.text, fontSize: 14, padding: 14, resize: "vertical", outline: "none", boxSizing: "border-box", marginBottom: 12 }} />
        {error && <div style={{ color: theme.red, fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>}
        <Btn onClick={handle} disabled={loading} icon={loading ? <Spinner /> : "💬"}>
          {loading ? "Thinking…" : "Ask"}
        </Btn>
        {answer && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 8 }}>Answer</div>
            <div style={{ background: "rgba(124,58,237,0.07)", border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, color: theme.text, fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{answer}</div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: theme.textMuted, background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.borderLight}`, borderRadius: 20, padding: "4px 10px" }}>🧠 Answered by RoBERTa (deepset/roberta-base-squad2, pre-trained on SQuAD v2)</span>
            </div>

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
const HistoryPage = ({ history, clearHistory }) => {
  const [remoteHistory, setRemoteHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const data = await fetchHistory();
        if (!cancelled) setRemoteHistory(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load history from server.");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Prefer backend history; fall back to locally-tracked history if the server has none / failed.
  const items = (remoteHistory && remoteHistory.length > 0) ? remoteHistory : history;

  return (
    <div style={{ padding: 32, maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ fontWeight: 800, fontSize: 22, color: theme.text }}>History</div>
        {history.length > 0 && <Btn variant="danger" onClick={clearHistory}>Clear Local</Btn>}
      </div>
      {loading && (
        <Card style={{ textAlign: "center", padding: 32 }}><Spinner /> <span style={{ marginLeft: 10, color: theme.textMuted }}>Loading history…</span></Card>
      )}
      {!loading && error && (
        <div style={{ background: theme.red + "11", border: `1px solid ${theme.red}33`, borderRadius: 10, padding: "10px 14px", color: theme.red, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>
      )}
      {!loading && items.length === 0 ? (
        <Card style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ color: theme.textMuted }}>No history yet. Start summarizing!</div>
        </Card>
      ) : (
        !loading && items.slice().reverse().map((h, i) => {
          const type = h.type || h.category || "Summary";
          const fileName = h.file || h.filename || h.file_name || "Document";
          const summaryText = h.summary || "";
          const date = h.date || h.created_at || "";
          return (
            <Card key={h.history_id || h.id || i} style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <Badge color={theme.accent}>{type}</Badge>
                  <span style={{ marginLeft: 10, fontSize: 13, color: theme.textMuted }}>{fileName}</span>
                </div>
                <span style={{ fontSize: 12, color: theme.textMuted }}>{date}</span>
              </div>
              <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.6, opacity: 0.85 }}>
                {summaryText.slice(0, 200)}{summaryText.length > 200 ? "…" : ""}
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
};

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
      <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 16 }}>🧠 AI Models, Datasets & Pipeline</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        {[
          { icon: "📝", title: "Summarization", model: "T5 (Text-to-Text Transfer Transformer)", trained: "✅ Fine-tuned by us", dataset: "dataset.json, expanded_dataset.json", color: theme.accent },
          { icon: "🏷️", title: "Document Detection", model: "BERT (bert-base-uncased)", trained: "✅ Fine-tuned by us (~4,000 samples)", dataset: "detection_dataset.json, detection_dataset_large.json", color: theme.teal },
          { icon: "❓", title: "Question Answering", model: "RoBERTa (deepset/roberta-base-squad2)", trained: "❌ Pre-trained (not by us)", dataset: "SQuAD v2", color: "#f472b6" },
        ].map(f => (
          <Card key={f.title} style={{ padding: 20, border: `1px solid ${f.color}22` }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: f.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: theme.text, marginBottom: 6 }}>{f.title}</div>
            <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.7 }}>
              <b style={{ color: theme.text }}>Model:</b> {f.model}<br />
              <b style={{ color: theme.text }}>Trained by us:</b> {f.trained}<br />
              <b style={{ color: theme.text }}>Dataset:</b> {f.dataset}
            </div>
          </Card>
        ))}
      </div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: theme.text, marginBottom: 14 }}>🔄 Complete AI Pipeline</div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 12, color: theme.textMuted }}>
          {["Upload PDF","PyPDF Text Extraction","Text Preprocessing","T5 Summarization","BERT Category Detection","Recommendation Engine","Store in MySQL","RoBERTa Q&A (SQuAD v2)"].map((step, i, arr) => (
            <Fragment key={step}>
              <span style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${theme.borderLight}`, borderRadius: 8, padding: "6px 12px", color: theme.text }}>{step}</span>
              {i < arr.length - 1 && <span style={{ color: theme.accentLight }}>→</span>}
            </Fragment>
          ))}
        </div>
      </Card>
      <Card>
        <div style={{ fontWeight: 700, fontSize: 17, color: theme.text, marginBottom: 14 }}>🛠️ Technology Stack</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {[
            ["Frontend", ["React.js", "HTML", "CSS", "JavaScript"]],
            ["Backend", ["Flask", "Python"]],
            ["Database", ["MySQL (AWS RDS)"]],
            ["Authentication", ["JWT"]],
            ["ML / AI Libraries", ["PyTorch", "Transformers", "PyPDF", "SQLAlchemy", "Flask-JWT-Extended"]],
          ].map(([group, items]) => (
            <div key={group}>
              <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>{group}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {items.map(tech => (
                  <span key={tech} style={{ background: `${theme.accent}18`, color: theme.accentLight, border: `1px solid ${theme.border}`, borderRadius: 999, padding: "5px 14px", fontSize: 12, fontWeight: 600 }}>{tech}</span>
                ))}
              </div>
            </div>
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
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!rating) return setErr("Please select a star rating.");
    if (!message.trim()) return setErr("Please enter your feedback message.");
    setErr("");
    setSubmitting(true);
    // Keep a local copy for the admin dashboard's offline view.
    const feedbacks = JSON.parse(localStorage.getItem("ai_feedbacks") || "[]");
    const entry = { id: Date.now(), name: user.name, email: user.email, rating, category, message, date: new Date().toLocaleString() };
    feedbacks.push(entry);
    localStorage.setItem("ai_feedbacks", JSON.stringify(feedbacks));
    try {
      await submitFeedback({ rating, category, message });
      setSubmitted(true);
    } catch (err) {
      setErr(err.message || "Failed to submit feedback to the server.");
    }
    setSubmitting(false);
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
        <Btn onClick={handleSubmit} disabled={submitting} icon={submitting ? <Spinner /> : "📤"}>
          {submitting ? "Submitting…" : "Submit Feedback"}
        </Btn>
      </Card>
    </div>
  );
};

// ─── Small chart primitives for Admin Dashboard ──────────────────────────────
const PieChart = ({ data, size = 170, thickness = 26 }) => {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const frac = d.count / total;
        const dash = frac * circumference;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="26" fontWeight="800" fill={theme.text}>{total}</text>
      <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill={theme.textMuted}>Total</text>
    </svg>
  );
};

const LineChart = ({ points, width = 460, height = 150 }) => {
  const max = Math.max(...points.map(p => p.value), 1);
  const padL = 30, padB = 20, padT = 14, padR = 10;
  const w = width - padL - padR, h = height - padT - padB;
  const stepX = points.length > 1 ? w / (points.length - 1) : 0;
  const coords = points.map((p, i) => ({
    x: padL + i * stepX,
    y: padT + h - (p.value / max) * h,
    ...p,
  }));
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${path} L${coords[coords.length - 1]?.x ?? padL},${padT + h} L${padL},${padT + h} Z`;
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {[0, 0.5, 1].map((t, i) => (
        <line key={i} x1={padL} x2={width - padR} y1={padT + h * t} y2={padT + h * t} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
      ))}
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accent} stopOpacity="0.35" />
          <stop offset="100%" stopColor={theme.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#lineFill)" stroke="none" />
      <path d={path} fill="none" stroke={theme.accent} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {coords.map((c, i) => (
        <g key={i}>
          <circle cx={c.x} cy={c.y} r="3.5" fill={theme.bgCard} stroke={theme.accent} strokeWidth="2" />
          <text x={c.x} y={c.y - 10} textAnchor="middle" fontSize="10" fill={theme.textMuted}>{c.value}</text>
          <text x={c.x} y={height - 4} textAnchor="middle" fontSize="10" fill={theme.textMuted}>{c.label}</text>
        </g>
      ))}
    </svg>
  );
};

const StatCard = ({ icon, value, label, sub, color }) => (
  <Card style={{ padding: "16px 18px", border: `1px solid ${color}22` }}>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: color + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: 22, color: theme.text, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, whiteSpace: "nowrap" }}>{label}</div>
      </div>
    </div>
    {sub != null && sub !== "" && (
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>{sub}</div>
    )}
  </Card>
);

const CATEGORY_META = {
  study_important: { label: "Study Important", color: theme.accent },
  health_risk: { label: "Health Risk", color: theme.red },
  news_alert: { label: "News Alert", color: theme.amber },
  legal_expiry: { label: "Legal Expiry", color: theme.teal },
};
const FALLBACK_COLORS = [theme.accent, theme.teal, theme.green, theme.amber, "#f472b6"];

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
const AdminDashboard = ({ onLogout }) => {
  const [tab, setTab] = useState("dashboard");
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastLoaded, setLastLoaded] = useState(null);
  const [actionErr, setActionErr] = useState("");

  const load = async () => {
    setLoading(true);
    const b = await fetchAdminDashboardBundle();
    setBundle(b);
    setLastLoaded(new Date());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const unwrap = (slot, fallback) => (bundle && bundle[slot]?.ok) ? bundle[slot].value : fallback;
  const errFor = (slot) => (bundle && bundle[slot] && !bundle[slot].ok) ? bundle[slot].error : null;

  const stats = unwrap("stats", {});
  const users = unwrap("users", []);
  const documents = unwrap("documents", []);
  const history = unwrap("history", []);
  const feedbackList = unwrap("feedback", []);
  const categoriesRaw = unwrap("categories", {});
  const modelStatus = unwrap("modelStatus", {});
  const system = unwrap("system", {});
  const logs = unwrap("logs", []);

  const totalUsers = stats.total_users ?? users.length ?? 0;
  const totalDocuments = stats.total_documents ?? documents.length ?? 0;
  const totalSummaries = stats.total_summaries ?? history.length ?? 0;
  const totalQuestions = stats.total_questions ?? 0;
  const totalFeedback = stats.total_feedback ?? feedbackList.length ?? 0;
  const activeUsers = stats.active_users ?? 0;

  const categoryData = Object.entries(categoriesRaw).map(([key, count], i) => {
    const meta = CATEGORY_META[key];
    return { key, label: meta?.label ?? key, count, color: meta?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length] };
  });
  const categoryTotal = categoryData.reduce((s, c) => s + c.count, 0) || 1;

  // Derive "uploads per day" from /api/admin/history dates (last 7 days present in the data).
  const uploadsPerDay = (() => {
    const counts = {};
    history.forEach(h => {
      const d = h.date ?? h.upload_date ?? h.created_at;
      if (!d) return;
      const key = String(d).slice(0, 10);
      counts[key] = (counts[key] || 0) + 1;
    });
    const days = Object.keys(counts).sort().slice(-7);
    return days.map(d => ({ label: d.slice(5), value: counts[d] }));
  })();

  const modelEntries = [
    ["Summarizer (T5)", modelStatus.summarizer],
    ["Detector (BERT)", modelStatus.detector],
    ["QA Model (RoBERTa)", modelStatus.qa_model],
  ];
  const allModelsLoaded = modelEntries.every(([, v]) => (v || "").toLowerCase() === "loaded");

  const runAction = async (fn) => {
    setActionErr("");
    try {
      await fn();
      await load();
    } catch (err) {
      setActionErr(err.message || "Action failed.");
    }
  };

  const NAV_ITEMS = [
    ["dashboard", "📊", "Dashboard"],
    ["users", "👥", "Users"],
    ["documents", "📄", "Documents"],
    ["history", "🕐", "History"],
    ["categories", "🏷️", "Categories"],
    ["feedback", "⭐", "Feedback"],
    ["models", "🧠", "AI Models"],
    ["system", "💾", "System"],
    ["logs", "📋", "Logs"],
    ["profile", "👤", "Profile"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", fontFamily: "'Space Grotesk',sans-serif" }}>
      <aside style={{ width: 220, background: "#0d0d1a", borderRight: `1px solid ${theme.borderLight}`, padding: "24px 0", flexShrink: 0 }}>
        <div style={{ padding: "0 20px 20px", borderBottom: `1px solid ${theme.borderLight}`, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: G, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#fff" }}>AI</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: theme.text }}>AI Document</div>
            <div style={{ fontWeight: 800, fontSize: 13, color: theme.text, marginTop: -2 }}>Summarizer</div>
          </div>
        </div>
        <div style={{ padding: "14px 20px 6px", fontSize: 11, fontWeight: 700, color: theme.accentLight, letterSpacing: 0.5 }}>ADMIN PANEL</div>
        {NAV_ITEMS.map(([id, icon, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: tab === id ? `${theme.accent}22` : "transparent", border: "none", cursor: "pointer", color: tab === id ? theme.accentLight : theme.textMuted, fontSize: 13.5, fontWeight: tab === id ? 600 : 400, borderLeft: tab === id ? `3px solid ${theme.accent}` : "3px solid transparent" }}>
            <span>{icon}</span>{label}
          </button>
        ))}
        <button onClick={onLogout} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 13.5, marginTop: 12 }}>🚪 Logout</button>
      </aside>

      <div style={{ flex: 1, padding: 32, overflowY: "auto", minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 24, color: theme.text }}>{NAV_ITEMS.find(n => n[0] === tab)?.[2] || "Dashboard"}</div>
            <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>Welcome back, Admin! Here's what's happening in your system.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 12, color: theme.textMuted, display: "flex", alignItems: "center", gap: 6 }}>
              🗓️ {lastLoaded ? lastLoaded.toLocaleString() : new Date().toLocaleString()}
            </div>
            <Btn onClick={load} disabled={loading} icon={loading ? <Spinner /> : "🔄"}>{loading ? "Loading…" : "Refresh"}</Btn>
          </div>
        </div>

        {actionErr && (
          <div style={{ background: theme.red + "11", border: `1px solid ${theme.red}33`, borderRadius: 10, padding: "10px 14px", color: theme.red, fontSize: 13, marginBottom: 16 }}>⚠️ {actionErr}</div>
        )}

        {tab === "dashboard" && (
          <>
            {errFor("stats") && (
              <div style={{ background: theme.amber + "11", border: `1px solid ${theme.amber}33`, borderRadius: 10, padding: "10px 14px", color: theme.amber, fontSize: 13, marginBottom: 16 }}>
                ℹ️ /api/admin/dashboard unavailable ({errFor("stats")}) — showing counts derived from other endpoints where possible.
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
              <StatCard icon="👤" value={totalUsers} label="Total Users" color={theme.teal} />
              <StatCard icon="📄" value={totalDocuments} label="Total Documents" color={theme.green} />
              <StatCard icon="📝" value={totalSummaries} label="Total Summaries" color={theme.accent} />
              <StatCard icon="❓" value={totalQuestions} label="Total Questions Asked" color={theme.amber} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
              <StatCard icon="⭐" value={totalFeedback} label="Total Feedback" color="#f472b6" />
              <StatCard icon="🟢" value={activeUsers} label="Active Users" color={theme.green} />
              <StatCard icon="🧠" value={allModelsLoaded ? "All Loaded" : "Check Models"} label="AI Models" color={allModelsLoaded ? theme.green : theme.amber} />
              <StatCard icon="⚡" value={system.cpu ? "Online" : "Unknown"} label="Server Status" color={theme.teal} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 18, marginBottom: 20, alignItems: "stretch" }}>
              <Card>
                <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>📊 Category Distribution</div>
                {categoryData.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13 }}>{errFor("categories") ? `Could not load: ${errFor("categories")}` : "No category data yet."}</div> : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                    <PieChart data={categoryData} />
                    <div style={{ width: "100%" }}>
                      {categoryData.map(c => (
                        <div key={c.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                            <span style={{ color: theme.text }}>{c.label}</span>
                          </div>
                          <span style={{ color: theme.textMuted }}>{c.count} ({Math.round((c.count / categoryTotal) * 1000) / 10}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
              <Card>
                <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>📈 Uploads Per Day</div>
                {uploadsPerDay.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13 }}>{errFor("history") ? `Could not load: ${errFor("history")}` : "No upload history yet."}</div> : <LineChart points={uploadsPerDay} />}
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 18 }}>
              <Card>
                <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>📄 Recent Documents</div>
                {documents.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13 }}>{errFor("documents") ? `Could not load: ${errFor("documents")}` : "No documents yet."}</div> : (
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>{["ID","Filename","Category","Uploaded By","Date"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: theme.textMuted, fontSize: 11, borderBottom: `1px solid ${theme.borderLight}` }}>{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody>
                      {documents.slice(0, 6).map((d, i) => (
                        <tr key={d.id ?? i}>
                          <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.id ?? i + 1}</td>
                          <td style={{ padding: "9px 10px", color: theme.text, fontSize: 12 }}>{d.filename}</td>
                          <td style={{ padding: "9px 10px" }}><Badge color={CATEGORY_META[d.category]?.color ?? theme.accent}>{CATEGORY_META[d.category]?.label ?? d.category}</Badge></td>
                          <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.uploaded_by}</td>
                          <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>
              <Card>
                <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>⭐ Latest Feedback</div>
                {feedbackList.length === 0 ? <div style={{ color: theme.textMuted, fontSize: 13 }}>{errFor("feedback") ? `Could not load: ${errFor("feedback")}` : "No feedback yet."}</div> : feedbackList.slice(0, 5).map((f, i) => (
                  <div key={f.id ?? i} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: theme.text, fontWeight: 600 }}>{f.username}</span>
                      <span style={{ color: "#f59e0b", fontSize: 12 }}>{"★".repeat(f.rating || 0)}{"☆".repeat(5 - (f.rating || 0))}</span>
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{f.comment}</div>
                  </div>
                ))}
              </Card>
            </div>
          </>
        )}

        {tab === "users" && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: theme.text }}>👥 Users Table</div>
              <Badge color={theme.accent}>{users.length} Total</Badge>
            </div>
            {users.length === 0 ? <div style={{ color: theme.textMuted }}>{errFor("users") ? `Could not load: ${errFor("users")}` : "No users registered yet."}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["ID","Username","Email","Joined",""].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: theme.textMuted, fontSize: 12, borderBottom: `1px solid ${theme.borderLight}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {users.map((u, i) => (
                    <tr key={u.id ?? i}>
                      <td style={{ padding: "10px 12px", color: theme.textMuted, fontSize: 13 }}>{u.id}</td>
                      <td style={{ padding: "10px 12px", color: theme.text, fontSize: 13 }}>{u.username}</td>
                      <td style={{ padding: "10px 12px", color: theme.textMuted, fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: "10px 12px", color: theme.textMuted, fontSize: 13 }}>{u.joined}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <button onClick={() => runAction(() => deleteAdminUser(u.id))} style={{ background: theme.red + "18", color: theme.red, border: `1px solid ${theme.red}33`, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>🗑️ Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === "documents" && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: theme.text }}>📄 All Documents</div>
              <Badge color={theme.accent}>{documents.length} Total</Badge>
            </div>
            {documents.length === 0 ? <div style={{ color: theme.textMuted }}>{errFor("documents") ? `Could not load: ${errFor("documents")}` : "No documents yet."}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["ID","Filename","Category","Uploaded By","Date"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 10px", color: theme.textMuted, fontSize: 11, borderBottom: `1px solid ${theme.borderLight}` }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {documents.map((d, i) => (
                    <tr key={d.id ?? i}>
                      <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.id ?? i + 1}</td>
                      <td style={{ padding: "9px 10px", color: theme.text, fontSize: 12 }}>{d.filename}</td>
                      <td style={{ padding: "9px 10px" }}><Badge color={CATEGORY_META[d.category]?.color ?? theme.accent}>{CATEGORY_META[d.category]?.label ?? d.category}</Badge></td>
                      <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.uploaded_by}</td>
                      <td style={{ padding: "9px 10px", color: theme.textMuted, fontSize: 12 }}>{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}

        {tab === "history" && (
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>🕐 Every Summarized Document</div>
            {history.length === 0 ? <div style={{ color: theme.textMuted }}>{errFor("history") ? `Could not load: ${errFor("history")}` : "No history yet."}</div> : (
              history.map((h, i) => (
                <div key={h.id ?? i} style={{ borderBottom: `1px solid ${theme.borderLight}`, padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>{h.filename ?? h.file}</span>
                    <span style={{ fontSize: 11, color: theme.textMuted }}>{h.date}</span>
                  </div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{(h.summary || "").slice(0, 180)}{(h.summary || "").length > 180 ? "…" : ""}</div>
                </div>
              ))
            )}
          </Card>
        )}

        {tab === "categories" && (
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>🏷️ Detection Statistics</div>
            {categoryData.length === 0 ? <div style={{ color: theme.textMuted }}>{errFor("categories") ? `Could not load: ${errFor("categories")}` : "No category data available."}</div> : categoryData.map(c => (
              <div key={c.key} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${theme.borderLight}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                  <span style={{ color: theme.text, fontSize: 13 }}>{c.label}</span>
                </div>
                <span style={{ color: theme.textMuted, fontSize: 13 }}>{c.count}</span>
              </div>
            ))}
          </Card>
        )}

        {tab === "feedback" && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 17, color: theme.text }}>⭐ Client Feedback</div>
              <Badge color={theme.accent}>{feedbackList.length} Total</Badge>
            </div>
            {feedbackList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: theme.textMuted }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📭</div>
                <div>{errFor("feedback") ? `Could not load: ${errFor("feedback")}` : "No feedback submitted yet."}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {feedbackList.map((f, i) => (
                  <div key={f.id ?? i} style={{ border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: 16, background: "rgba(255,255,255,0.02)" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar name={f.username} size={30} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{f.username}</span>
                      </div>
                      <span style={{ fontSize: 16, color: "#f59e0b" }}>{"★".repeat(f.rating || 0)}{"☆".repeat(5 - (f.rating || 0))}</span>
                    </div>
                    <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.6, background: "rgba(124,58,237,0.05)", padding: "10px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, marginBottom: 10 }}>{f.comment}</div>
                    <button onClick={() => runAction(() => deleteAdminFeedback(f.id))} style={{ background: theme.red + "18", color: theme.red, border: `1px solid ${theme.red}33`, borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>🗑️ Delete</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "models" && (
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>🧠 AI Model Status</div>
            {modelEntries.map(([label, status]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${theme.borderLight}` }}>
                <span style={{ color: theme.text, fontSize: 13 }}>{label}</span>
                <Badge color={(status || "").toLowerCase() === "loaded" ? theme.green : theme.red}>{status || "Unknown"}</Badge>
              </div>
            ))}
            {errFor("modelStatus") && <div style={{ color: theme.amber, fontSize: 12, marginTop: 10 }}>ℹ️ {errFor("modelStatus")}</div>}
          </Card>
        )}

        {tab === "system" && (
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>💾 System Health</div>
            {errFor("system") ? <div style={{ color: theme.textMuted }}>Could not load: {errFor("system")}</div> : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
                {[["CPU", system.cpu, theme.teal], ["Memory", system.memory, theme.accent], ["Disk", system.disk, theme.amber]].map(([label, value, color]) => (
                  <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${theme.borderLight}`, borderRadius: 12, padding: "14px 18px" }}>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 4 }}>{label}</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "logs" && (
          <Card>
            <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>📋 System Logs</div>
            {(!Array.isArray(logs) || logs.length === 0) ? <div style={{ color: theme.textMuted }}>{errFor("logs") ? `Could not load: ${errFor("logs")}` : "No logs available."}</div> : (
              <div style={{ maxHeight: 420, overflowY: "auto" }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ fontSize: 12, color: theme.textMuted, padding: "6px 0", borderBottom: `1px solid ${theme.borderLight}`, fontFamily: "monospace" }}>
                    {typeof l === "string" ? l : JSON.stringify(l)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {tab === "profile" && (
          <AdminProfileTab />
        )}
      </div>
    </div>
  );
};

const AdminProfileTab = () => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetchAdminProfile().then(setProfile).catch(err => setError(err.message));
  }, []);
  return (
    <Card>
      <div style={{ fontWeight: 700, color: theme.text, marginBottom: 16 }}>👤 Admin Profile</div>
      {error && <div style={{ color: theme.textMuted, fontSize: 13 }}>Could not load: {error}</div>}
      {!error && !profile && <div style={{ color: theme.textMuted, fontSize: 13 }}>Loading…</div>}
      {profile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {Object.entries(profile).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${theme.borderLight}`, fontSize: 13 }}>
              <span style={{ color: theme.textMuted }}>{k}</span>
              <span style={{ color: theme.text, fontWeight: 600 }}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [auth, setAuth] = useLocalStorage("ai_auth", null);
  const [screen, setScreen] = useState("login");
  const [page, setPage] = useState("home");
  const [history, setHistory] = useLocalStorage("ai_history", []);
  const [historyId, setHistoryId] = useState(null); // most recently summarized document's history_id, used by Q&A

  const addHistory = (item) => setHistory(prev => [...prev, item]);
  const clearHistory = () => setHistory([]);
  const login = (user) => { setAuth(user); setPage(user.role === "admin" ? "admin" : "home"); };
  const logout = () => {
    setAuth(null);
    setPage("home");
    setScreen("login");
    setHistoryId(null);
    localStorage.removeItem("ai_auth");
    localStorage.removeItem("token");
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
    legal: <SummarizePage title="Legal Document Summarization" desc="Upload your legal document and get an AI-powered summary." addHistory={addHistory} setHistoryId={setHistoryId} />,
    healthcare: <SummarizePage title="Healthcare Report Summarization" desc="Upload a healthcare report and get an AI-powered summary." addHistory={addHistory} setHistoryId={setHistoryId} />,
    news: <NewsPage addHistory={addHistory} setHistoryId={setHistoryId} />,
    education: <EducationPage addHistory={addHistory} setHistoryId={setHistoryId} />,
    qa: <QAPage addHistory={addHistory} historyId={historyId} />,
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