import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ───
const STAGES = [
  "New Lead",
  "Contacted",
  "Follow-Up",
  "Meeting Set",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
  "Nurture",
];
const OUTCOMES = [
  "Contacted",
  "Follow-Up",
  "Meeting Set",
  "Proposal Sent",
  "Negotiation",
  "Won",
  "Lost",
  "Nurture",
];

const SBG = {
  "New Lead": "#E3F2FD",
  Contacted: "#FFF3E0",
  "Follow-Up": "#FCE4EC",
  "Meeting Set": "#E8F5E9",
  "Proposal Sent": "#F3E5F5",
  Negotiation: "#FFF8E1",
  Won: "#C8E6C9",
  Lost: "#FFCDD2",
  Nurture: "#E0E0E0",
};
const SFG = {
  "New Lead": "#1565C0",
  Contacted: "#E65100",
  "Follow-Up": "#C62828",
  "Meeting Set": "#2E7D32",
  "Proposal Sent": "#7B1FA2",
  Negotiation: "#F57F17",
  Won: "#1B5E20",
  Lost: "#B71C1C",
  Nurture: "#616161",
};

const SCRIPTS = [
  {
    title: "Opening Script",
    color: "#E3F2FD",
    accent: "#1565C0",
    lines: [
      {
        label: "SAY",
        text: "Hi [Name], this is [Your Name] from [Company]. Did I catch you at an okay time?",
      },
      {
        label: "IF YES",
        text: "Great! I'll be super quick — just 30 seconds.",
      },
      {
        label: "HOOK",
        text: "I noticed [personal hook from research]. We've been helping companies like yours with [specific result].",
      },
      {
        label: "ASK",
        text: "Would it make sense to block 15 minutes this week so I can show you how we can help?",
      },
    ],
  },
  {
    title: "Gatekeeper Script",
    color: "#FFF3E0",
    accent: "#E65100",
    lines: [
      {
        label: "SAY",
        text: "Hi, this is [Your Name] calling for [Prospect Name]. Could you connect me?",
      },
      {
        label: "IF ASKED WHY",
        text: "I'm reaching out regarding [industry topic] — [Prospect] would find this relevant.",
      },
      {
        label: "IF BLOCKED",
        text: "Completely understand. Could you tell me the best time to reach [Prospect]?",
      },
    ],
  },
  {
    title: "Voicemail Script",
    subtitle: "Under 20 seconds",
    color: "#E8F5E9",
    accent: "#2E7D32",
    lines: [
      {
        label: "SAY",
        text: "Hi [Name], [Your Name] from [Company]. We helped [similar company] achieve [result]. I'd love 10 minutes to explore this. My number is [number]. Thanks!",
      },
    ],
  },
  {
    title: "When They Say NO",
    color: "#FFEBEE",
    accent: "#C62828",
    lines: [
      {
        label: '"Not interested"',
        text: "Totally fair. Can I send a 1-page case study? Zero commitment.",
      },
      {
        label: '"Send email"',
        text: "Happy to! What's your biggest challenge with [area] right now?",
      },
      {
        label: '"No budget"',
        text: "That's why [Company X] came to us — we helped them save [amount]. Worth a 10-min chat?",
      },
      {
        label: '"Have someone"',
        text: "How's it working out? A lot of our clients came after trying other approaches.",
      },
    ],
  },
];

const WEEKLYTASKS = [
  "Review weekly numbers: Dials, Connects, Meetings, Pipeline",
  "Which industries/titles responded best? Focus next week",
  "Top 3 objections — prepare better answers",
  "Follow-Up leads older than 7 days — breakup or Nurture",
  "Prepare fresh lead list for next week",
  "Update all Deal Stages — make sure nothing is stale",
];

// ─── HELPERS ───
const BASE = import.meta.env.VITE_API_URL || "";

const api = async (url, opts = {}) => {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed");
  return data;
};

const totalFrom = (a) => (a ? a.reduce((s, c) => s + c.c, 0) : 0);
const connFrom = (a) =>
  a
    ? a
        .filter((c) => c.outcome !== "Lost" && c.outcome !== "Nurture")
        .reduce((s, c) => s + c.c, 0)
    : 0;
const meetFrom = (a) =>
  a
    ? a
        .filter(
          (c) =>
            c.outcome === "Meeting Set" ||
            c.outcome === "Proposal Sent" ||
            c.outcome === "Won",
        )
        .reduce((s, c) => s + c.c, 0)
    : 0;
const getLeadName = (l) =>
  ((l.first_name || "") + " " + (l.last_name || "")).trim() ||
  l.company_name ||
  "—";
const getCallIconClass = (outcome) =>
  outcome === "Meeting Set" || outcome === "Won"
    ? "booked"
    : outcome === "Contacted"
      ? "connected"
      : outcome === "Follow-Up"
        ? "voicemail"
        : "other";
const getCallEmoji = (outcome) =>
  outcome === "Won"
    ? "🏆"
    : outcome === "Meeting Set"
      ? "🤝"
      : outcome === "Proposal Sent"
        ? "📄"
        : outcome === "Contacted"
          ? "✅"
          : outcome === "Follow-Up"
            ? "🔄"
            : outcome === "Negotiation"
              ? "💬"
              : outcome === "Lost"
                ? "❌"
                : outcome === "Nurture"
                  ? "🌱"
                  : "📞";

// ─── LOGIN SCREEN ───
function LoginScreen({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!u || !p) return;
    setLoading(true);
    setErr("");
    try {
      await onLogin(u, p);
    } catch (e) {
      setErr("Invalid credentials");
    }
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <div className="login-subtitle">Cold Calling CRM</div>
          <h1 className="login-title">Welcome Back</h1>
        </div>
        {err && <div className="msg-banner msg-error">{err}</div>}
        <input
          value={u}
          onChange={(e) => {
            setU(e.target.value);
            setErr("");
          }}
          placeholder="Username"
          className="input input-mb"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <input
          value={p}
          onChange={(e) => {
            setP(e.target.value);
            setErr("");
          }}
          placeholder="Password"
          type="password"
          className="input input-mb-lg"
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button
          onClick={submit}
          disabled={loading}
          className="btn-primary"
          style={{ opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN APP ───
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [weekly, setWeekly] = useState({});
  const [dupes, setDupes] = useState([]);

  // Modal
  const [modal, setModal] = useState(null);
  const [mOutcome, setMOutcome] = useState("");
  const [mNotes, setMNotes] = useState("");

  // Filters
  const [sf, setSf] = useState("All");
  const [cf, setCf] = useState("All");
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(null);

  // New user form
  const [nN, setNN] = useState("");
  const [nU, setNU] = useState("");
  const [nP, setNP] = useState("");
  const [nR, setNR] = useState("employee");

  // Follow-up date picker (default to today)
  const [followUpDate, setFollowUpDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  const fileRef = useRef(null);

  // ─── AUTH ───
  useEffect(() => {
    api("/api/me")
      .then((d) => {
        setUser(d.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(() => {
    if (!user) return;
    api("/api/leads")
      .then(setLeads)
      .catch(() => {});
    api("/api/calls")
      .then(setCalls)
      .catch(() => {});
    api("/api/stats")
      .then(setStats)
      .catch(() => {});
    api("/api/weekly")
      .then(setWeekly)
      .catch(() => {});
    if (user.role === "admin") {
      api("/api/users")
        .then(setUsers)
        .catch(() => {});
      api("/api/duplicates")
        .then(setDupes)
        .catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!user) return;
    const iv = setInterval(load, 30000);
    return () => clearInterval(iv);
  }, [user, load]);

  const login = async (username, password) => {
    const d = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setUser(d.user);
  };

  const logout = async () => {
    await api("/api/logout", { method: "POST" }).catch(() => {});
    setUser(null);
  };

  // ─── UPLOAD ───
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append(
      "batch_name",
      file.name.replace(/\.[^.]+$/, "") +
        " — " +
        new Date().toLocaleDateString(),
    );
    try {
      const res = await fetch(
        (import.meta.env.VITE_API_URL || "") + "/api/leads/upload",
        {
          method: "POST",
          body: fd,
        },
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      let m = d.count + " leads uploaded!";
      if (d.dupeCount) m += " " + d.dupeCount + " duplicates removed.";
      setMsg(m);
      load();
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      setMsg("Upload failed: " + err.message);
    }
    if (e.target) e.target.value = "";
  };

  // ─── ACTIONS ───
  const logCall = async () => {
    if (!mOutcome || !modal) return;
    try {
      await api("/api/leads/" + modal.id + "/call", {
        method: "POST",
        body: JSON.stringify({ outcome: mOutcome, notes: mNotes }),
      });
      setModal(null);
      setMOutcome("");
      setMNotes("");
      load();
    } catch (e) {
      alert(e.message);
    }
  };

  const claim = async (id) => {
    try {
      await api("/api/leads/" + id + "/claim", { method: "PUT" });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const unclaim = async (id) => {
    try {
      await api("/api/leads/" + id + "/unclaim", { method: "PUT" });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const setStage = async (id, s) => {
    try {
      await api("/api/leads/" + id + "/stage", {
        method: "PUT",
        body: JSON.stringify({ stage: s }),
      });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const addUser = async () => {
    if (!nN || !nU || !nP) return;
    try {
      await api("/api/users", {
        method: "POST",
        body: JSON.stringify({
          username: nU,
          password: nP,
          display_name: nN,
          role: nR,
        }),
      });
      setNN("");
      setNU("");
      setNP("");
      setNR("employee");
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const delUser = async (id) => {
    if (!confirm("Remove?")) return;
    try {
      await api("/api/users/" + id, { method: "DELETE" });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const delBatch = async (b) => {
    if (!confirm("Delete batch: " + b + "?")) return;
    try {
      await api("/api/leads/batch/" + encodeURIComponent(b), {
        method: "DELETE",
      });
      load();
    } catch (e) {
      alert(e.message);
    }
  };
  const toggleW = async (k) => {
    setWeekly((p) => ({ ...p, [k]: !p[k] }));
    await api("/api/weekly/toggle", {
      method: "POST",
      body: JSON.stringify({ key: k }),
    }).catch(() => {});
  };
  const exportReport = () => {
    window.open((import.meta.env.VITE_API_URL || "") + "/api/export", "_blank");
  };

  // ─── LOADING / AUTH GATE ───
  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <LoginScreen onLogin={login} />;

  const isAdmin = user.role === "admin";
  const employees = isAdmin && stats?.empStats ? stats.empStats : [];
  const empCount = isAdmin ? Math.max(employees.length, 1) : 1;

  // ─── METRICS ───
  let tD = 0,
    tC = 0,
    tM = 0,
    wD = 0,
    wC = 0,
    wM = 0,
    pipeline = [];
  if (stats) {
    if (isAdmin && stats.empStats) {
      stats.empStats.forEach((e) => {
        tD += totalFrom(e.todayCalls);
        tC += connFrom(e.todayCalls);
        tM += meetFrom(e.todayCalls);
        wD += totalFrom(e.weekCalls);
        wC += connFrom(e.weekCalls);
        wM += meetFrom(e.weekCalls);
      });
      pipeline = stats.pipeline || [];
    } else {
      tD = totalFrom(stats.todayCalls);
      tC = connFrom(stats.todayCalls);
      tM = meetFrom(stats.todayCalls);
      wD = totalFrom(stats.weekCalls);
      wC = connFrom(stats.weekCalls);
      wM = meetFrom(stats.weekCalls);
      pipeline = stats.pipeline || [];
    }
  }
  const cRate = tD > 0 ? Math.round((tC / tD) * 100) : 0;
  const wonC = pipeline.find((p) => p.stage === "Won");
  const convR =
    leads.length > 0
      ? Math.round(((wonC ? wonC.c : 0) / leads.length) * 100)
      : 0;

  // ─── FILTERS ───
  const shown = leads.filter((l) => {
    if (sf !== "All" && l.stage !== sf) return false;
    if (cf === "Unclaimed" && l.claimed_by) return false;
    if (cf === "Mine" && l.claimed_by !== user.id) return false;
    if (
      cf !== "All" &&
      cf !== "Unclaimed" &&
      cf !== "Mine" &&
      l.claimed_by_name !== cf
    )
      return false;
    if (q) {
      const s = q.toLowerCase();
      return [
        l.first_name,
        l.last_name,
        l.company_name,
        l.work_email,
        l.city,
        l.claimed_by_name,
      ].some((f) => (f || "").toLowerCase().includes(s));
    }
    return true;
  });

  const batches = [...new Set(leads.map((l) => l.batch_name).filter(Boolean))];
  const tabs = isAdmin
    ? [
        { id: "dashboard", l: "Dashboard" },
        { id: "team", l: "Team" },
        { id: "leads", l: "Leads" },
        { id: "log", l: "All Calls" },
        { id: "settings", l: "Settings" },
      ]
    : [
        { id: "dashboard", l: "Dashboard" },
        { id: "leads", l: "Leads" },
        { id: "log", l: "My Calls" },
        { id: "scripts", l: "Scripts" },
        { id: "followup", l: "Follow-Up" },
        { id: "weekly", l: "Friday Review" },
      ];

  const getWeekKey = (i) => {
    const d = new Date();
    const day = d.getDay();
    d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
    return "w-" + d.toISOString().slice(0, 10) + "-" + i;
  };

  return (
    <div className="app-wrapper">
      {/* ═══ HEADER ═══ */}
      <div className="header">
        <div className="header-top">
          <div>
            <div className="header-label">
              {isAdmin ? "Admin Panel" : "Execution Playbook"}
            </div>
            <h1 className="header-title">Cold Calling Dashboard</h1>
          </div>
          <div className="header-user">
            <div className="header-username">{user.display_name}</div>
            <button onClick={logout} className="header-logout">
              Logout
            </button>
          </div>
        </div>
        <div className="header-stats">
          {[
            { n: tD, l: "Dials", t: "/" + empCount * 50 },
            { n: tC, l: "Conn.", t: "/" + empCount * 15 },
            { n: tM, l: "Meet.", t: "/" + empCount * 3 },
            { n: cRate + "%", l: "Rate", t: "" },
          ].map((k, i) => (
            <div key={i} className="header-stat">
              <div className="header-stat-number">{k.n}</div>
              <div className="header-stat-label">
                {k.l} {k.t}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
          >
            {t.l}
            {t.id === "leads" && leads.length > 0 && (
              <span className="tab-badge">{leads.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {/* ═══ DASHBOARD ═══ */}
        {tab === "dashboard" && (
          <>
            <div className="section-label">
              {isAdmin
                ? "TEAM PERFORMANCE — TODAY"
                : "YOUR PERFORMANCE — TODAY"}
            </div>
            <div className="metric-grid">
              {[
                {
                  n: tD,
                  l: "Total Dials",
                  t: "/ " + empCount * 50,
                  c: "#1565C0",
                  bg: "#E3F2FD",
                },
                {
                  n: tC,
                  l: "Connects",
                  t: "/ " + empCount * 15,
                  c: "#2E7D32",
                  bg: "#E8F5E9",
                },
                {
                  n: tM,
                  l: "Meetings",
                  t: "/ " + empCount * 3,
                  c: "#E65100",
                  bg: "#FFF3E0",
                },
                {
                  n: cRate + "%",
                  l: "Connect Rate",
                  t: "goal 30%",
                  c: "#7B1FA2",
                  bg: "#F3E5F5",
                },
              ].map((m, i) => (
                <div
                  key={i}
                  className="card metric-card"
                  style={{ background: m.bg, borderColor: m.c + "22" }}
                >
                  <div className="metric-number" style={{ color: m.c }}>
                    {m.n}
                  </div>
                  <div className="metric-label" style={{ color: m.c }}>
                    {m.l}
                  </div>
                  <div className="metric-target" style={{ color: m.c }}>
                    {m.t}
                  </div>
                </div>
              ))}
            </div>

            <div className="section-label">THIS WEEK</div>
            <div className="week-row">
              {[
                { n: wD, l: "Dials", t: empCount * 250 },
                { n: wC, l: "Connects", t: empCount * 75 },
                { n: wM, l: "Meetings", t: empCount * 15 },
              ].map((m, i) => (
                <div key={i} className="card week-card">
                  <div className="week-number">{m.n}</div>
                  <div className="week-label">{m.l}</div>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${m.n >= m.t ? "complete" : "incomplete"}`}
                      style={{ width: Math.min((m.n / m.t) * 100, 100) + "%" }}
                    />
                  </div>
                  <div className="week-target">Target: {m.t}</div>
                </div>
              ))}
            </div>

            <div className="section-label">PIPELINE</div>
            <div className="card" style={{ padding: "14px" }}>
              {STAGES.map((s, i) => {
                const c = pipeline.find((p) => p.stage === s);
                const cnt = c ? c.c : 0;
                const pct =
                  leads.length > 0 ? Math.round((cnt / leads.length) * 100) : 0;
                return (
                  <div key={i} className="pipeline-row">
                    <div
                      className="pipeline-stage-name"
                      style={{ color: SFG[s] }}
                    >
                      {s}
                    </div>
                    <div className="pipeline-bar-bg">
                      <div
                        className="pipeline-bar-fill"
                        style={{
                          width: pct + "%",
                          background: SBG[s],
                          minWidth: cnt > 0 ? "6px" : "0",
                        }}
                      />
                    </div>
                    <div className="pipeline-count" style={{ color: SFG[s] }}>
                      {cnt}
                    </div>
                  </div>
                );
              })}
              <div className="pipeline-footer">
                <span>
                  Total: <strong>{leads.length}</strong>
                </span>
                <span>
                  Conversion:{" "}
                  <strong style={{ color: convR > 0 ? "#2E7D32" : "#333" }}>
                    {convR}%
                  </strong>
                </span>
              </div>
            </div>

            {isAdmin && leads.length > 0 && (
              <button onClick={exportReport} className="btn-export">
                📥 Export Active Pipeline Report (Excel)
              </button>
            )}

            {isAdmin && employees.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: "8px" }}>
                  PER-EMPLOYEE — TODAY
                </div>
                {employees.map((emp) => {
                  const ed = totalFrom(emp.todayCalls);
                  const ec = connFrom(emp.todayCalls);
                  const em = meetFrom(emp.todayCalls);
                  return (
                    <div key={emp.id} className="card emp-card">
                      <div className="emp-header">
                        <div>
                          <div className="emp-name">{emp.display_name}</div>
                          <div className="emp-claimed">
                            {emp.claimedCount} leads claimed
                          </div>
                        </div>
                        <div className="emp-stats">
                          <div className="emp-stat">
                            <div
                              className="emp-stat-num"
                              style={{ color: "#1565C0" }}
                            >
                              {ed}
                            </div>
                            <div className="emp-stat-label">Dials</div>
                          </div>
                          <div className="emp-stat">
                            <div
                              className="emp-stat-num"
                              style={{ color: "#2E7D32" }}
                            >
                              {ec}
                            </div>
                            <div className="emp-stat-label">Conn.</div>
                          </div>
                          <div className="emp-stat">
                            <div
                              className="emp-stat-num"
                              style={{ color: "#E65100" }}
                            >
                              {em}
                            </div>
                            <div className="emp-stat-label">Meet.</div>
                          </div>
                        </div>
                      </div>
                      <div className="emp-progress">
                        <div
                          className={`progress-fill ${ed >= 50 ? "complete" : "incomplete"}`}
                          style={{
                            width: Math.min((ed / 50) * 100, 100) + "%",
                          }}
                        />
                      </div>
                      <div className="emp-target">{ed} / 50 daily target</div>
                    </div>
                  );
                })}
              </>
            )}

            {leads.length === 0 && (
              <div className="card empty-state">
                <div className="empty-icon">📊</div>
                {isAdmin
                  ? "Upload your first lead list in the Leads tab."
                  : "No data yet. Ask admin to upload."}
              </div>
            )}
          </>
        )}

        {/* ═══ TEAM ═══ */}
        {tab === "team" && isAdmin && (
          <>
            <div className="section-label">ALL CALLS TODAY</div>
            {stats?.allTodayCalls?.length > 0 ? (
              stats.allTodayCalls.map((c, i) => (
                <div key={i} className="card call-item">
                  <div className={`call-icon ${getCallIconClass(c.outcome)}`}>
                    {getCallEmoji(c.outcome)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="call-name">
                      {c.lead_name}{" "}
                      <span className="call-company">• {c.company}</span>
                    </div>
                    <div className="call-by">
                      by {c.user_name} at {c.call_time}
                    </div>
                    {c.notes && <div className="call-notes">{c.notes}</div>}
                  </div>
                  <div
                    className={`call-outcome ${["Meeting Set", "Won", "Proposal Sent"].includes(c.outcome) ? "booked" : "default"}`}
                  >
                    {c.outcome}
                  </div>
                </div>
              ))
            ) : (
              <div className="card empty-state">No calls today yet</div>
            )}
          </>
        )}

        {/* ═══ LEADS ═══ */}
        {tab === "leads" && (
          <>
            {isAdmin && (
              <div
                className="upload-area"
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleUpload}
                  style={{ display: "none" }}
                />
                <div className="upload-icon">📁</div>
                <div className="upload-title">Upload Lead List</div>
                <div className="upload-subtitle">
                  Apollo export or any Excel/CSV with your 13 columns
                </div>
                <div className="upload-note">
                  Duplicates auto-detected by First Name + Last Name + LinkedIn
                </div>
              </div>
            )}

            {!isAdmin && leads.length === 0 && (
              <div
                className="info-banner warning"
                style={{ textAlign: "center" }}
              >
                No leads yet. Ask admin to upload.
              </div>
            )}
            {!isAdmin && leads.length > 0 && (
              <div className="info-banner info">
                Claim unclaimed leads to start calling. You cannot modify the
                list.
              </div>
            )}
            {msg && (
              <div
                className={`msg-banner ${msg.includes("uploaded") || msg.includes("removed") ? "msg-success" : "msg-error"}`}
              >
                {msg}
              </div>
            )}

            {isAdmin && batches.length > 0 && (
              <div className="card" style={{ padding: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <div className="section-label" style={{ marginBottom: 0 }}>
                    UPLOADED BATCHES
                  </div>
                  <button onClick={exportReport} className="btn-export-small">
                    📥 Export Active
                  </button>
                </div>
                {batches.map((b, i) => (
                  <div key={i} className="batch-row">
                    <span className="batch-name">
                      {b}{" "}
                      <span className="batch-count">
                        ({leads.filter((l) => l.batch_name === b).length})
                      </span>
                    </span>
                    <button onClick={() => delBatch(b)} className="btn-delete">
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}

            {leads.length > 0 && (
              <>
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, company, city, email..."
                  className="input input-mb"
                />
                <div className="filter-row">
                  {[
                    "All",
                    "Unclaimed",
                    ...(!isAdmin ? ["Mine"] : []),
                    ...(isAdmin ? employees.map((e) => e.display_name) : []),
                  ]
                    .filter(Boolean)
                    .map((s) => (
                      <button
                        key={s}
                        onClick={() => setCf(s)}
                        className={`pill ${cf === s ? "active" : ""}`}
                      >
                        {s}
                      </button>
                    ))}
                </div>
                <div className="filter-row filter-row-stages">
                  {["All", ...STAGES].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSf(s)}
                      className="pill"
                      style={
                        sf === s
                          ? {
                              border: "2px solid " + (SFG[s] || "#333"),
                              background: SFG[s] || "#333",
                              color: "#fff",
                            }
                          : {}
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="count-text">
                  {shown.length} of {leads.length} leads
                </div>

                {shown.slice(0, 50).map((lead) => {
                  const mine = lead.claimed_by === user.id;
                  const claimed = !!lead.claimed_by;
                  const isExp = expanded === lead.id;
                  return (
                    <div
                      key={lead.id}
                      className={`card lead-card ${claimed && !mine && !isAdmin ? "faded" : ""}`}
                    >
                      <div className="lead-header">
                        <div
                          style={{ flex: 1, cursor: "pointer" }}
                          onClick={() => setExpanded(isExp ? null : lead.id)}
                        >
                          <div className="lead-name">{getLeadName(lead)}</div>
                          <div className="lead-company">
                            {lead.company_name}
                            {lead.city ? " • " + lead.city : ""}
                          </div>
                        </div>
                        <span
                          className="stage-badge"
                          style={{
                            background: SBG[lead.stage],
                            color: SFG[lead.stage],
                          }}
                        >
                          {lead.stage}
                        </span>
                      </div>

                      <div className="lead-contact">
                        {lead.phone ? "📞 " + lead.phone : ""}
                        {lead.phone && lead.work_email ? "  •  " : ""}
                        {lead.work_email ? "✉ " + lead.work_email : ""}
                      </div>

                      {claimed && (
                        <div className="lead-claim-badge">
                          <span className={mine ? "badge-mine" : "badge-other"}>
                            {mine
                              ? "⭐ Assigned to you"
                              : "👤 " + lead.claimed_by_name + " is on this"}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => unclaim(lead.id)}
                              className="btn-unclaim"
                            >
                              Unclaim
                            </button>
                          )}
                        </div>
                      )}

                      {lead.call_count > 0 && (
                        <div className="lead-stats">
                          Calls: {lead.call_count}
                          {lead.last_outcome ? " • " + lead.last_outcome : ""}
                          {lead.follow_up_date && (
                            <span className="lead-followup">
                              {" "}
                              • Follow-up: {lead.follow_up_date}
                            </span>
                          )}
                        </div>
                      )}

                      {isExp && (
                        <div className="expanded-panel">
                          <div className="detail-label-header">
                            FULL DETAILS
                          </div>
                          {[
                            { l: "Company Website", v: lead.company_website },
                            {
                              l: "Personal LinkedIn",
                              v: lead.personal_linkedin,
                            },
                            { l: "Company LinkedIn", v: lead.company_linkedin },
                            { l: "Company Phone", v: lead.company_phone },
                            { l: "Company Address", v: lead.company_address },
                            {
                              l: "Service/Industry",
                              v: lead.service_description,
                            },
                            { l: "City", v: lead.city },
                            { l: "Added", v: lead.added_date },
                            { l: "Batch", v: lead.batch_name },
                          ]
                            .filter((x) => x.v)
                            .map((x, i) => (
                              <div key={i} className="detail-row">
                                <span className="detail-key">{x.l}:</span>
                                <span className="detail-value">{x.v}</span>
                              </div>
                            ))}
                          {lead.remarks?.length > 0 && (
                            <>
                              <div
                                className="detail-label-header"
                                style={{ marginTop: "10px" }}
                              >
                                REMARK HISTORY
                              </div>
                              {lead.remarks
                                .slice()
                                .reverse()
                                .map((r, i) => (
                                  <div key={i} className="remark-item">
                                    <div className="remark-text">{r.text}</div>
                                    <div className="remark-meta">
                                      {r.added_by} • {r.added_date}{" "}
                                      {r.added_time}
                                    </div>
                                  </div>
                                ))}
                            </>
                          )}
                        </div>
                      )}

                      <div className="lead-actions">
                        {!claimed && !isAdmin && (
                          <button
                            onClick={() => claim(lead.id)}
                            className="btn-claim"
                          >
                            ✋ Claim
                          </button>
                        )}
                        {(mine || isAdmin) && (
                          <button
                            onClick={() => {
                              setModal(lead);
                              setMOutcome("");
                              setMNotes("");
                            }}
                            className="btn-call"
                          >
                            📞 Log Call
                          </button>
                        )}
                        {(mine || isAdmin) && (
                          <select
                            value={lead.stage}
                            onChange={(e) => setStage(lead.id, e.target.value)}
                            className="input select-stage"
                          >
                            {STAGES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => setExpanded(isExp ? null : lead.id)}
                          className="btn-expand"
                        >
                          {isExp ? "▲" : "▼"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {leads.length === 0 && isAdmin && (
              <div className="card empty-state">
                <div className="empty-icon">📋</div>Upload your first lead list
                above.
              </div>
            )}
          </>
        )}

        {/* ═══ CALL LOG ═══ */}
        {tab === "log" && (
          <>
            <div className="section-label">
              {isAdmin ? "ALL TEAM CALLS" : "YOUR CALLS"} ({calls.length})
            </div>
            {calls.length === 0 && (
              <div className="card empty-state">No calls yet.</div>
            )}
            {calls.slice(0, 60).map((c, i) => (
              <div key={i} className="card call-item">
                <div className={`call-icon ${getCallIconClass(c.outcome)}`}>
                  {getCallEmoji(c.outcome)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="call-name">
                    {c.lead_name}{" "}
                    <span className="call-company">• {c.company}</span>
                  </div>
                  {isAdmin && <div className="call-by">by {c.user_name}</div>}
                  {c.notes && <div className="call-notes">{c.notes}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div
                    className={`call-outcome ${["Meeting Set", "Won", "Proposal Sent"].includes(c.outcome) ? "booked" : "default"}`}
                  >
                    {c.outcome}
                  </div>
                  <div className="call-time">
                    {c.call_date} {c.call_time}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ═══ SCRIPTS ═══ */}
        {tab === "scripts" && (
          <>
            <div className="script-tip">
              <strong>⚡</strong> Keep open during calls. Sound natural.
            </div>
            {SCRIPTS.map((s, i) => (
              <div key={i} className="card">
                <div className="script-header" style={{ background: s.color }}>
                  <span className="script-title" style={{ color: s.accent }}>
                    {s.title}
                  </span>
                  {s.subtitle && (
                    <span
                      className="script-subtitle"
                      style={{ color: s.accent }}
                    >
                      {s.subtitle}
                    </span>
                  )}
                </div>
                <div className="script-body">
                  {s.lines.map((line, li) => (
                    <div key={li} className="script-line">
                      <span
                        className="script-label"
                        style={{ background: s.color, color: s.accent }}
                      >
                        {line.label}
                      </span>
                      <span className="script-text">{line.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ═══ FOLLOW-UP ═══ */}
        {tab === "followup" && (
          <>
            <div className="section-label">SELECT DATE</div>
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
              className="input"
              style={{ marginBottom: "12px" }}
            />

            {(() => {
              const dueLeads = leads.filter(
                (l) =>
                  l.follow_up_date === followUpDate &&
                  l.stage !== "Won" &&
                  l.stage !== "Lost",
              );

              const isToday =
                followUpDate === new Date().toISOString().slice(0, 10);
              const dateLabel = isToday
                ? "TODAY'S FOLLOW-UPS"
                : `FOLLOW-UPS FOR ${followUpDate}`;

              return (
                <>
                  <div className="section-label">
                    {dateLabel} ({dueLeads.length})
                  </div>

                  {dueLeads.length === 0 ? (
                    <div className="card empty-state">
                      <div className="empty-icon">📅</div>
                      No follow-ups scheduled for this date.
                    </div>
                  ) : (
                    dueLeads.map((lead) => {
                      const mine = lead.claimed_by === user.id;
                      const claimed = !!lead.claimed_by;
                      const isExp = expanded === lead.id;

                      return (
                        <div
                          key={lead.id}
                          className={`card lead-card ${claimed && !mine && !isAdmin ? "faded" : ""}`}
                        >
                          <div className="lead-header">
                            <div
                              style={{ flex: 1, cursor: "pointer" }}
                              onClick={() =>
                                setExpanded(isExp ? null : lead.id)
                              }
                            >
                              <div className="lead-name">
                                {getLeadName(lead)}
                              </div>
                              <div className="lead-company">
                                {lead.company_name}
                                {lead.city ? " • " + lead.city : ""}
                              </div>
                            </div>
                            <span
                              className="stage-badge"
                              style={{
                                background: SBG[lead.stage],
                                color: SFG[lead.stage],
                              }}
                            >
                              {lead.stage}
                            </span>
                          </div>

                          <div className="lead-contact">
                            {lead.phone ? "📞 " + lead.phone : ""}
                            {lead.phone && lead.work_email ? "  •  " : ""}
                            {lead.work_email ? "✉ " + lead.work_email : ""}
                          </div>

                          {claimed && (
                            <div className="lead-claim-badge">
                              <span
                                className={mine ? "badge-mine" : "badge-other"}
                              >
                                {mine
                                  ? "⭐ Assigned to you"
                                  : "👤 " +
                                    lead.claimed_by_name +
                                    " is on this"}
                              </span>
                              {isAdmin && (
                                <button
                                  onClick={() => unclaim(lead.id)}
                                  className="btn-unclaim"
                                >
                                  Unclaim
                                </button>
                              )}
                            </div>
                          )}

                          {lead.call_count > 0 && (
                            <div className="lead-stats">
                              Calls: {lead.call_count}
                              {lead.last_outcome
                                ? " • " + lead.last_outcome
                                : ""}
                              {lead.follow_up_date && (
                                <span className="lead-followup">
                                  {" "}
                                  • Follow-up: {lead.follow_up_date}
                                </span>
                              )}
                            </div>
                          )}

                          {isExp && (
                            <div className="expanded-panel">
                              <div className="detail-label-header">
                                FULL DETAILS
                              </div>
                              {[
                                {
                                  l: "Company Website",
                                  v: lead.company_website,
                                },
                                {
                                  l: "Personal LinkedIn",
                                  v: lead.personal_linkedin,
                                },
                                {
                                  l: "Company LinkedIn",
                                  v: lead.company_linkedin,
                                },
                                { l: "Company Phone", v: lead.company_phone },
                                {
                                  l: "Company Address",
                                  v: lead.company_address,
                                },
                                {
                                  l: "Service/Industry",
                                  v: lead.service_description,
                                },
                                { l: "City", v: lead.city },
                                { l: "Added", v: lead.added_date },
                                { l: "Batch", v: lead.batch_name },
                              ]
                                .filter((x) => x.v)
                                .map((x, i) => (
                                  <div key={i} className="detail-row">
                                    <span className="detail-key">{x.l}:</span>
                                    <span className="detail-value">{x.v}</span>
                                  </div>
                                ))}
                              {lead.remarks?.length > 0 && (
                                <>
                                  <div
                                    className="detail-label-header"
                                    style={{ marginTop: "10px" }}
                                  >
                                    REMARK HISTORY
                                  </div>
                                  {lead.remarks
                                    .slice()
                                    .reverse()
                                    .map((r, i) => (
                                      <div key={i} className="remark-item">
                                        <div className="remark-text">
                                          {r.text}
                                        </div>
                                        <div className="remark-meta">
                                          {r.added_by} • {r.added_date}{" "}
                                          {r.added_time}
                                        </div>
                                      </div>
                                    ))}
                                </>
                              )}
                            </div>
                          )}

                          <div className="lead-actions">
                            {!claimed && !isAdmin && (
                              <button
                                onClick={() => claim(lead.id)}
                                className="btn-claim"
                              >
                                ✋ Claim
                              </button>
                            )}
                            {(mine || isAdmin) && (
                              <button
                                onClick={() => {
                                  setModal(lead);
                                  setMOutcome("");
                                  setMNotes("");
                                }}
                                className="btn-call"
                              >
                                📞 Log Call
                              </button>
                            )}
                            {(mine || isAdmin) && (
                              <select
                                value={lead.stage}
                                onChange={(e) =>
                                  setStage(lead.id, e.target.value)
                                }
                                className="input select-stage"
                              >
                                {STAGES.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button
                              onClick={() =>
                                setExpanded(isExp ? null : lead.id)
                              }
                              className="btn-expand"
                            >
                              {isExp ? "▲" : "▼"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </>
              );
            })()}
          </>
        )}

        {/* ═══ FRIDAY REVIEW ═══ */}
        {tab === "weekly" && (
          <>
            <div className="weekly-tip">
              <strong>Every Friday, 4:30 – 5:00 PM</strong> — Complete before
              the weekend.
            </div>
            <div className="card">
              {WEEKLYTASKS.map((task, i) => {
                const key = getWeekKey(i);
                const done = weekly[key];
                return (
                  <div
                    key={i}
                    className="weekly-item"
                    onClick={() => toggleW(key)}
                  >
                    <div className={`checkbox ${done ? "checked" : ""}`}>
                      {done && <span className="checkbox-mark">✓</span>}
                    </div>
                    <span className={`weekly-text ${done ? "done" : ""}`}>
                      {task}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="weekly-targets">
              <div className="weekly-targets-label">Weekly Targets</div>
              <div className="weekly-targets-grid">
                {[
                  { n: wD, l: "Dials", t: 250 },
                  { n: wC, l: "Connects", t: 75 },
                  { n: wM, l: "Meetings", t: 15 },
                  { n: convR + "%", l: "Conversion", t: null },
                ].map((k, i) => (
                  <div key={i} className="weekly-target-item">
                    <div className="weekly-target-num">{k.n}</div>
                    <div className="weekly-target-label">
                      {k.l}
                      {k.t ? " / " + k.t : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ═══ SETTINGS ═══ */}
        {tab === "settings" && isAdmin && (
          <>
            <div className="section-label">TEAM MEMBERS</div>
            {users.map((u) => (
              <div key={u.id} className="card user-card">
                <div>
                  <div className="user-name">{u.display_name}</div>
                  <div className="user-meta">
                    @{u.username} •{" "}
                    <span
                      className={
                        u.role === "admin" ? "role-admin" : "role-employee"
                      }
                    >
                      {u.role}
                    </span>
                  </div>
                </div>
                {u.role !== "admin" && (
                  <button
                    onClick={() => delUser(u.id)}
                    className="btn-delete-large"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <div className="section-label" style={{ marginTop: "16px" }}>
              ADD NEW MEMBER
            </div>
            <div className="card" style={{ padding: "16px" }}>
              <input
                value={nN}
                onChange={(e) => setNN(e.target.value)}
                placeholder="Display Name"
                className="input input-mb"
              />
              <input
                value={nU}
                onChange={(e) => setNU(e.target.value)}
                placeholder="Username"
                className="input input-mb"
              />
              <input
                value={nP}
                onChange={(e) => setNP(e.target.value)}
                placeholder="Password"
                type="password"
                className="input input-mb"
              />
              <select
                value={nR}
                onChange={(e) => setNR(e.target.value)}
                className="input"
                style={{ marginBottom: "12px" }}
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
              <button onClick={addUser} className="btn-primary">
                Add Member
              </button>
            </div>
            {dupes.length > 0 && (
              <>
                <div className="section-label" style={{ marginTop: "16px" }}>
                  DUPLICATES REMOVED ({dupes.length})
                </div>
                <div className="card dupe-log" style={{ padding: "12px" }}>
                  {dupes.map((d, i) => (
                    <div key={i} className="dupe-item">
                      {d.first_name} {d.last_name}{" "}
                      {d.personal_linkedin ? "• " + d.personal_linkedin : ""}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ═══ CALL MODAL ═══ */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(null)}>
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="modal-handle" />
            <h3 className="modal-title">Log Call — {getLeadName(modal)}</h3>
            <div className="modal-subtitle">
              {modal.company_name}
              {modal.phone ? " • " + modal.phone : ""}
            </div>
            <div className="modal-field-label">Call Outcome *</div>
            <div className="outcome-grid">
              {OUTCOMES.map((o) => (
                <button
                  key={o}
                  onClick={() => setMOutcome(o)}
                  className={`outcome-btn ${mOutcome === o ? "active" : ""}`}
                >
                  {o}
                </button>
              ))}
            </div>
            <div className="modal-field-label">Remark / Notes</div>
            <textarea
              value={mNotes}
              onChange={(e) => setMNotes(e.target.value)}
              placeholder="What did they say? Objections? Next step..."
              rows={3}
              className="input"
              style={{ resize: "vertical", marginBottom: "16px" }}
            />
            <button
              onClick={logCall}
              disabled={!mOutcome}
              className="btn-primary"
            >
              {mOutcome ? "Save Call Log" : "Select outcome first"}
            </button>
            <button
              onClick={() => setModal(null)}
              className="btn-secondary"
              style={{ marginTop: "8px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
