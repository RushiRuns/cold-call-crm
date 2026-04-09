const express = require("express");
const Database = require("better-sqlite3");
const multer = require("multer");
const XLSX = require("xlsx");
const crypto = require("crypto");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");

const app = express();

// ─── CORS ───
app.use((req, res, next) => {
  const allowed = process.env.FRONTEND_URL || "http://localhost:5173";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,x-token");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(cookieParser());

// ─── DATABASE ───
const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'employee',
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    company_linkedin TEXT DEFAULT '',
    personal_linkedin TEXT DEFAULT '',
    company_name TEXT DEFAULT '',
    company_website TEXT DEFAULT '',
    work_email TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    city TEXT DEFAULT '',
    company_address TEXT DEFAULT '',
    service_description TEXT DEFAULT '',
    company_phone TEXT DEFAULT '',
    stage TEXT DEFAULT 'New Lead',
    claimed_by INTEGER,
    claimed_by_name TEXT DEFAULT '',
    call_count INTEGER DEFAULT 0,
    last_call_date TEXT DEFAULT '',
    last_outcome TEXT DEFAULT '',
    follow_up_date TEXT DEFAULT '',
    added_date TEXT DEFAULT (date('now')),
    batch_name TEXT DEFAULT '',
    is_duplicate INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS remarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    added_by TEXT DEFAULT '',
    added_date TEXT DEFAULT (date('now')),
    added_time TEXT DEFAULT (time('now'))
  );
  CREATE TABLE IF NOT EXISTS calls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    lead_name TEXT,
    company TEXT,
    user_id INTEGER NOT NULL,
    user_name TEXT,
    outcome TEXT NOT NULL,
    notes TEXT DEFAULT '',
    call_date TEXT DEFAULT (date('now')),
    call_time TEXT DEFAULT (time('now'))
  );
  CREATE TABLE IF NOT EXISTS duplicate_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    personal_linkedin TEXT,
    reason TEXT,
    logged_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS weekly_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    check_key TEXT NOT NULL,
    done INTEGER DEFAULT 0,
    UNIQUE(user_id, check_key)
  );
`);

// ─── SEED USERS ───
const hash = (pw) => crypto.createHash("sha256").update(pw).digest("hex");
const seeds = [
  ["admin", hash("admin123"), "Admin (Owner)", "admin"],
  ["nishant", hash("nishant123"), "Nishant", "admin"],
  ["manishini", hash("manishini123"), "Manishini", "employee"],
  ["aalima", hash("aalima123"), "Aalima", "employee"],
  ["bharat", hash("bharat123"), "Bharat", "employee"],
];
const ins = db.prepare(
  "INSERT OR IGNORE INTO users (username,password,display_name,role) VALUES (?,?,?,?)",
);
seeds.forEach((s) => ins.run(...s));

// ─── AUTH ───
function auth(req, res, next) {
  const token = req.cookies.token || req.headers["x-token"];
  if (!token) return res.status(401).json({ error: "Not logged in" });
  const s = db
    .prepare(
      "SELECT u.id,u.username,u.display_name,u.role FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.token=?",
    )
    .get(token);
  if (!s) return res.status(401).json({ error: "Invalid session" });
  req.user = s;
  next();
}
function adminOnly(req, res, next) {
  if (req.user.role !== "admin")
    return res.status(403).json({ error: "Admin only" });
  next();
}

// ─── AUTH ROUTES ───
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!u || u.password !== hash(password))
    return res.status(401).json({ error: "Invalid credentials" });
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token,user_id) VALUES (?,?)").run(
    token,
    u.id,
  );
  res.cookie("token", token, {
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
  res.json({
    token,
    user: {
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      role: u.role,
    },
  });
});

app.post("/api/logout", (req, res) => {
  const token = req.cookies.token;
  if (token) db.prepare("DELETE FROM sessions WHERE token=?").run(token);
  res.clearCookie("token");
  res.json({ ok: true });
});

app.get("/api/me", auth, (req, res) => res.json({ user: req.user }));

// ─── USERS ───
app.get("/api/users", auth, adminOnly, (req, res) => {
  res.json(
    db
      .prepare("SELECT id,username,display_name,role,created_at FROM users")
      .all(),
  );
});

app.post("/api/users", auth, adminOnly, (req, res) => {
  const { username, password, display_name, role } = req.body;
  if (!username || !password || !display_name)
    return res.status(400).json({ error: "Missing fields" });
  try {
    db.prepare(
      "INSERT INTO users (username,password,display_name,role) VALUES (?,?,?,?)",
    ).run(username, hash(password), display_name, role || "employee");
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: "Username exists" });
  }
});

app.delete("/api/users/:id", auth, adminOnly, (req, res) => {
  const id = +req.params.id;
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(id);
  if (!u) return res.status(404).json({ error: "Not found" });
  if (u.role === "admin")
    return res.status(400).json({ error: "Cannot delete admin" });
  db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
  db.prepare(
    'UPDATE leads SET claimed_by=NULL,claimed_by_name="" WHERE claimed_by=?',
  ).run(id);
  db.prepare("DELETE FROM users WHERE id=?").run(id);
  res.json({ ok: true });
});

// ─── FIELD MAPPER ───
function mapField(row, keys) {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim())
      return String(v).trim();
  }
  return "";
}

// ─── DUPLICATE KEY ───
function dupeKey(fn, ln, li) {
  fn = (fn || "").toLowerCase().trim();
  ln = (ln || "").toLowerCase().trim();
  li = (li || "").toLowerCase().trim().replace(/\/$/, "");
  if (!fn && !ln) return null;
  return fn + "|" + ln + "|" + li;
}

// ─── LEADS UPLOAD (admin) ───
const upload = multer({ dest: "/tmp/uploads/" });
app.post(
  "/api/leads/upload",
  auth,
  adminOnly,
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file" });
    try {
      const wb = XLSX.readFile(req.file.path);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const batchName =
        req.body.batch_name || new Date().toISOString().slice(0, 10);

      const existingLeads = db
        .prepare(
          "SELECT first_name,last_name,personal_linkedin FROM leads WHERE is_duplicate=0",
        )
        .all();
      const existingKeys = new Set();
      existingLeads.forEach((l) => {
        const k = dupeKey(l.first_name, l.last_name, l.personal_linkedin);
        if (k) existingKeys.add(k);
      });

      const insertLead = db.prepare(
        "INSERT INTO leads (first_name,last_name,company_linkedin,personal_linkedin,company_name,company_website,work_email,phone,city,company_address,service_description,company_phone,batch_name,is_duplicate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,0)",
      );
      const insertRemark = db.prepare(
        'INSERT INTO remarks (lead_id,text,added_by,added_date,added_time) VALUES (?,?,?,date("now"),"")',
      );
      const insertDupe = db.prepare(
        "INSERT INTO duplicate_log (first_name,last_name,personal_linkedin,reason) VALUES (?,?,?,?)",
      );

      let count = 0,
        dupeCount = 0;
      const newKeys = new Set();

      const tx = db.transaction(() => {
        for (const r of rows) {
          const firstName = mapField(r, [
            "First Name",
            "First name",
            "first_name",
            "first name",
            "firstName",
            "FIRST NAME",
            "First",
          ]);
          const lastName = mapField(r, [
            "Last Name",
            "Last name",
            "last_name",
            "last name",
            "lastName",
            "LAST NAME",
            "Last",
          ]);
          const companyLinkedin = mapField(r, [
            "Company LinkedIn URL",
            "Company Linkedin",
            "company_linkedin",
            "Company LinkedIn",
          ]);
          const personalLinkedin = mapField(r, [
            "Personal LinkedIn URL",
            "Personal Linkedin",
            "Linkedin URL",
            "LinkedIn",
            "personal_linkedin",
            "LinkedIn URL",
            "Person Linkedin Url",
          ]);
          const companyName = mapField(r, [
            "Company Name",
            "Company",
            "company_name",
            "company",
            "COMPANY",
          ]);
          const companyWebsite = mapField(r, [
            "Company Website",
            "Website",
            "company_website",
            "website",
            "Company Domain",
          ]);
          const workEmail = mapField(r, [
            "Work Email",
            "Work email",
            "Email",
            "email",
            "work_email",
            "EMAIL",
            "Email Address",
          ]);
          const phone = String(
            mapField(r, [
              "Person's Phone Number",
              "Phone",
              "Phone Number",
              "phone",
              "Mobile",
              "PHONE",
              "Person Phone",
              "Direct Phone",
            ]),
          );
          const city = mapField(r, [
            "City Name",
            "City",
            "city",
            "CITY",
            "Person City",
          ]);
          const companyAddress = mapField(r, [
            "Company Address",
            "Address",
            "company_address",
            "Company Location",
          ]);
          const serviceDescription = mapField(r, [
            "Service Description",
            "Service",
            "service_description",
            "Industry",
            "Description",
          ]);
          const companyPhone = String(
            mapField(r, [
              "Company Phone Number",
              "Company Phone",
              "company_phone",
              "Company Number",
            ]),
          );
          const remark = mapField(r, [
            "Remark",
            "Remarks",
            "remark",
            "remarks",
            "Notes",
            "notes",
          ]);

          if (!firstName && !lastName && !companyName && !phone && !workEmail)
            continue;

          const key = dupeKey(firstName, lastName, personalLinkedin);
          if (key && (existingKeys.has(key) || newKeys.has(key))) {
            insertDupe.run(
              firstName,
              lastName,
              personalLinkedin,
              "Duplicate: same name + LinkedIn",
            );
            dupeCount++;
            continue;
          }
          if (key) {
            existingKeys.add(key);
            newKeys.add(key);
          }

          const result = insertLead.run(
            firstName,
            lastName,
            companyLinkedin,
            personalLinkedin,
            companyName,
            companyWebsite,
            workEmail,
            phone,
            city,
            companyAddress,
            serviceDescription,
            companyPhone,
            batchName,
          );
          if (remark)
            insertRemark.run(result.lastInsertRowid, remark, "Import");
          count++;
        }
      });
      tx();
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
      res.json({ ok: true, count, dupeCount });
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: "Failed to parse file" });
    }
  },
);

// ─── LEADS ───
app.get("/api/leads", auth, (req, res) => {
  const leads = db
    .prepare("SELECT * FROM leads WHERE is_duplicate=0 ORDER BY id DESC")
    .all();
  const getRemarks = db.prepare(
    "SELECT * FROM remarks WHERE lead_id=? ORDER BY id ASC",
  );
  leads.forEach((l) => {
    l.remarks = getRemarks.all(l.id);
  });
  res.json(leads);
});

app.delete("/api/leads/batch/:batch", auth, adminOnly, (req, res) => {
  const batch = req.params.batch;
  const ids = db
    .prepare("SELECT id FROM leads WHERE batch_name=?")
    .all(batch)
    .map((r) => r.id);
  if (ids.length) {
    db.prepare(
      "DELETE FROM remarks WHERE lead_id IN (" + ids.join(",") + ")",
    ).run();
    db.prepare(
      "DELETE FROM calls WHERE lead_id IN (" + ids.join(",") + ")",
    ).run();
  }
  db.prepare("DELETE FROM leads WHERE batch_name=?").run(batch);
  res.json({ ok: true });
});

// ─── CLAIM ───
app.put("/api/leads/:id/claim", auth, (req, res) => {
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(+req.params.id);
  if (!lead) return res.status(404).json({ error: "Not found" });
  if (lead.claimed_by && lead.claimed_by !== req.user.id)
    return res
      .status(400)
      .json({ error: "Claimed by " + lead.claimed_by_name });
  db.prepare("UPDATE leads SET claimed_by=?,claimed_by_name=? WHERE id=?").run(
    req.user.id,
    req.user.display_name,
    +req.params.id,
  );
  res.json({ ok: true });
});

app.put("/api/leads/:id/unclaim", auth, adminOnly, (req, res) => {
  db.prepare(
    'UPDATE leads SET claimed_by=NULL,claimed_by_name="" WHERE id=?',
  ).run(+req.params.id);
  res.json({ ok: true });
});

app.put("/api/leads/:id/stage", auth, (req, res) => {
  const { stage } = req.body;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(+req.params.id);
  if (!lead) return res.status(404).json({ error: "Not found" });
  if (req.user.role !== "admin" && lead.claimed_by !== req.user.id)
    return res.status(403).json({ error: "Not your lead" });
  db.prepare("UPDATE leads SET stage=? WHERE id=?").run(stage, +req.params.id);
  res.json({ ok: true });
});

// ─── LOG CALL ───
app.post("/api/leads/:id/call", auth, (req, res) => {
  const { outcome, notes } = req.body;
  const lid = +req.params.id;
  const lead = db.prepare("SELECT * FROM leads WHERE id=?").get(lid);
  if (!lead) return res.status(404).json({ error: "Not found" });

  if (!lead.claimed_by) {
    db.prepare(
      "UPDATE leads SET claimed_by=?,claimed_by_name=? WHERE id=?",
    ).run(req.user.id, req.user.display_name, lid);
  } else if (lead.claimed_by !== req.user.id && req.user.role !== "admin") {
    return res
      .status(403)
      .json({ error: "Claimed by " + lead.claimed_by_name });
  }

  // Outcome IS the new stage (outcomes now match pipeline stages)
  const newStage = outcome;
  const today = new Date().toISOString().slice(0, 10);
  const time = new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  let followUp = "";
  // Set follow-up for active stages, not for terminal ones
  if (outcome !== "Won" && outcome !== "Lost" && outcome !== "Nurture") {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    followUp = d.toISOString().slice(0, 10);
  }

  db.prepare(
    "UPDATE leads SET stage=?,last_call_date=?,last_outcome=?,call_count=call_count+1,follow_up_date=?,claimed_by=?,claimed_by_name=? WHERE id=?",
  ).run(
    newStage,
    today,
    outcome,
    followUp,
    req.user.id,
    req.user.display_name,
    lid,
  );

  const leadName =
    ((lead.first_name || "") + " " + (lead.last_name || "")).trim() ||
    lead.company_name;
  db.prepare(
    "INSERT INTO calls (lead_id,lead_name,company,user_id,user_name,outcome,notes,call_date,call_time) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    lid,
    leadName,
    lead.company_name,
    req.user.id,
    req.user.display_name,
    outcome,
    notes || "",
    today,
    time,
  );

  const remarkText = outcome + (notes ? " — " + notes : "");
  db.prepare(
    "INSERT INTO remarks (lead_id,text,added_by,added_date,added_time) VALUES (?,?,?,?,?)",
  ).run(lid, remarkText, req.user.display_name, today, time);

  res.json({ ok: true });
});

app.get("/api/calls", auth, (req, res) => {
  const calls =
    req.user.role === "admin"
      ? db.prepare("SELECT * FROM calls ORDER BY id DESC LIMIT 200").all()
      : db
          .prepare(
            "SELECT * FROM calls WHERE user_id=? ORDER BY id DESC LIMIT 200",
          )
          .all(req.user.id);
  res.json(calls);
});

// ─── STATS ───
app.get("/api/stats", auth, (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  const weekStart = d.toISOString().slice(0, 10);

  if (req.user.role === "admin") {
    const employees = db
      .prepare("SELECT id,display_name FROM users WHERE role='employee'")
      .all();
    const empStats = employees.map((emp) => {
      const todayCalls = db
        .prepare(
          "SELECT outcome,COUNT(*) as c FROM calls WHERE user_id=? AND call_date=? GROUP BY outcome",
        )
        .all(emp.id, today);
      const weekCalls = db
        .prepare(
          "SELECT outcome,COUNT(*) as c FROM calls WHERE user_id=? AND call_date>=? GROUP BY outcome",
        )
        .all(emp.id, weekStart);
      const claimedCount = db
        .prepare(
          "SELECT COUNT(*) as c FROM leads WHERE claimed_by=? AND is_duplicate=0",
        )
        .get(emp.id).c;
      return { ...emp, todayCalls, weekCalls, claimedCount };
    });
    const totalLeads = db
      .prepare("SELECT COUNT(*) as c FROM leads WHERE is_duplicate=0")
      .get().c;
    const pipeline = db
      .prepare(
        "SELECT stage,COUNT(*) as c FROM leads WHERE is_duplicate=0 GROUP BY stage",
      )
      .all();
    const allTodayCalls = db
      .prepare("SELECT * FROM calls WHERE call_date=? ORDER BY id DESC")
      .all(today);
    res.json({ empStats, totalLeads, pipeline, allTodayCalls });
  } else {
    const todayCalls = db
      .prepare(
        "SELECT outcome,COUNT(*) as c FROM calls WHERE user_id=? AND call_date=? GROUP BY outcome",
      )
      .all(req.user.id, today);
    const weekCalls = db
      .prepare(
        "SELECT outcome,COUNT(*) as c FROM calls WHERE user_id=? AND call_date>=? GROUP BY outcome",
      )
      .all(req.user.id, weekStart);
    const claimedCount = db
      .prepare(
        "SELECT COUNT(*) as c FROM leads WHERE claimed_by=? AND is_duplicate=0",
      )
      .get(req.user.id).c;
    const pipeline = db
      .prepare(
        "SELECT stage,COUNT(*) as c FROM leads WHERE claimed_by=? AND is_duplicate=0 GROUP BY stage",
      )
      .all(req.user.id);
    res.json({ todayCalls, weekCalls, claimedCount, pipeline });
  }
});

// ─── EXPORT (admin only) — only leads with activity ───
app.get("/api/export", auth, adminOnly, (req, res) => {
  // Only export leads that have been worked on (call_count > 0 OR stage changed from New Lead OR has remarks beyond import)
  const leads = db
    .prepare(
      `
    SELECT * FROM leads 
    WHERE is_duplicate=0 
      AND (call_count > 0 OR stage != 'New Lead' OR claimed_by IS NOT NULL)
    ORDER BY 
      CASE stage 
        WHEN 'Won' THEN 1 WHEN 'Proposal Sent' THEN 2 WHEN 'Negotiation' THEN 3
        WHEN 'Meeting Set' THEN 4 WHEN 'Follow-Up' THEN 5 WHEN 'Contacted' THEN 6
        WHEN 'Nurture' THEN 7 WHEN 'Lost' THEN 8 ELSE 9 
      END,
      last_call_date DESC
  `,
    )
    .all();
  const getRemarks = db.prepare(
    "SELECT * FROM remarks WHERE lead_id=? ORDER BY id ASC",
  );

  if (!leads.length) {
    // Return empty sheet with message
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "No active leads found. Only leads with calls, stage changes, or assignments are exported.",
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pipeline Report");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=Active_Pipeline_" +
        new Date().toISOString().slice(0, 10) +
        ".xlsx",
    );
    return res.send(buf);
  }

  const rows = leads.map((l) => {
    const remarks = getRemarks.all(l.id);
    return {
      "First Name": l.first_name,
      "Last Name": l.last_name,
      Company: l.company_name,
      Stage: l.stage,
      "Assigned To": l.claimed_by_name || "Unclaimed",
      "Calls Made": l.call_count,
      "Last Outcome": l.last_outcome,
      "Last Call": l.last_call_date,
      "Next Follow-Up": l.follow_up_date,
      Phone: l.phone,
      Email: l.work_email,
      City: l.city,
      LinkedIn: l.personal_linkedin,
      "Company Website": l.company_website,
      "Company LinkedIn": l.company_linkedin,
      "Company Phone": l.company_phone,
      "Industry/Service": l.service_description,
      "Company Address": l.company_address,
      Batch: l.batch_name,
      "Date Added": l.added_date,
      Remarks: remarks
        .map(
          (r) => "[" + r.added_date + " " + (r.added_by || "") + "] " + r.text,
        )
        .join("\n"),
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths for readability
  ws["!cols"] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 8 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 14 },
    { wch: 32 },
    { wch: 28 },
    { wch: 32 },
    { wch: 16 },
    { wch: 20 },
    { wch: 30 },
    { wch: 24 },
    { wch: 12 },
    { wch: 50 },
  ];

  // Summary sheet
  const summaryData = [
    ["Cold Call CRM — Active Pipeline Report"],
    ["Generated", new Date().toLocaleString("en-IN")],
    [""],
    ["Total Active Leads", leads.length],
    ["Won", leads.filter((l) => l.stage === "Won").length],
    ["Meeting Set", leads.filter((l) => l.stage === "Meeting Set").length],
    ["Proposal Sent", leads.filter((l) => l.stage === "Proposal Sent").length],
    ["Negotiation", leads.filter((l) => l.stage === "Negotiation").length],
    ["Follow-Up", leads.filter((l) => l.stage === "Follow-Up").length],
    ["Contacted", leads.filter((l) => l.stage === "Contacted").length],
    ["Lost", leads.filter((l) => l.stage === "Lost").length],
    ["Nurture", leads.filter((l) => l.stage === "Nurture").length],
    [""],
    ["Employee", "Leads Assigned", "Total Calls"],
  ];

  // Per-employee summary
  const empMap = {};
  leads.forEach((l) => {
    const name = l.claimed_by_name || "Unassigned";
    if (!empMap[name]) empMap[name] = { leads: 0, calls: 0 };
    empMap[name].leads++;
    empMap[name].calls += l.call_count;
  });
  Object.entries(empMap).forEach(([name, data]) => {
    summaryData.push([name, data.leads, data.calls]);
  });

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 24 }, { wch: 16 }, { wch: 14 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
  XLSX.utils.book_append_sheet(wb, ws, "Active Leads");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=Active_Pipeline_" +
      new Date().toISOString().slice(0, 10) +
      ".xlsx",
  );
  res.send(buf);
});

// ─── DUPLICATES LOG ───
app.get("/api/duplicates", auth, adminOnly, (req, res) => {
  res.json(
    db.prepare("SELECT * FROM duplicate_log ORDER BY id DESC LIMIT 50").all(),
  );
});

// ─── WEEKLY ───
app.get("/api/weekly", auth, (req, res) => {
  const checks = db
    .prepare("SELECT check_key,done FROM weekly_checks WHERE user_id=?")
    .all(req.user.id);
  const obj = {};
  checks.forEach((c) => {
    obj[c.check_key] = !!c.done;
  });
  res.json(obj);
});

app.post("/api/weekly/toggle", auth, (req, res) => {
  const { key } = req.body;
  const ex = db
    .prepare("SELECT * FROM weekly_checks WHERE user_id=? AND check_key=?")
    .get(req.user.id, key);
  if (ex)
    db.prepare(
      "UPDATE weekly_checks SET done=? WHERE user_id=? AND check_key=?",
    ).run(ex.done ? 0 : 1, req.user.id, key);
  else
    db.prepare(
      "INSERT INTO weekly_checks (user_id,check_key,done) VALUES (?,?,1)",
    ).run(req.user.id, key);
  res.json({ ok: true });
});

// ─── SPA FALLBACK — serve index.html for all non-API routes ───
app.get("/", (req, res) => res.json({ status: "API running" }));

app.listen(PORT, () => {
  console.log(`\n  Cold Call CRM → http://localhost:${PORT}\n`);
  console.log("  Logins:");
  console.log("  admin / admin123   |   nishant / nishant123");
  console.log("  manishini / manishini123");
  console.log("  aalima / aalima123  |   bharat / bharat123\n");
});
