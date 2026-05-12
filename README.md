# Invert — Before you act, run your decision through Charlie first.

An AI-powered behavioural accountability tool that interrogates your investment decisions through five specialist agents before you act. Each agent conducts a multi-turn conversation, pressing until it is satisfied, then produces a scored judgment. All five feed into a synthesised Decision Memo with a clear Proceed / Pause / Reconsider recommendation.

**P** · Price Signal Separator &nbsp;|&nbsp; **R** · Ruin Risk Assessor &nbsp;|&nbsp; **I** · Independence Verifier &nbsp;|&nbsp; **C** · Confirmation Challenger &nbsp;|&nbsp; **E** · Ego & Inertia Probe

---

## Quick start (local dev)

### 1. Get a free Groq API key
Sign up at [console.groq.com](https://console.groq.com) → API Keys → Create key.
Model used: `llama-3.3-70b-versatile` — included in the free tier.

### 2. Set up the backend

```bash
cd backend
cp .env.example .env
# Edit .env:
#   GROQ_API_KEY=gsk_...
#   DATABASE_URL=          (leave blank → SQLite; or paste Supabase connection string)
#   SECRET_KEY=            (generate with: python -c "import secrets; print(secrets.token_hex(32))")

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies all `/api` calls to the FastAPI backend on port 8000.

> **First run:** delete any old `invert.db` if upgrading — SQLAlchemy recreates the schema automatically on startup.

---

## Deploying to Render

Render's free tier runs everything as a single web service. FastAPI builds and serves the React app as static files — no separate frontend host needed.

### Step 1 — Supabase database

1. [supabase.com](https://supabase.com) → New project
2. Settings → Database → Connection string (URI mode) → copy the URL

### Step 2 — Create the Render service

1. Push the repository to GitHub
2. [render.com](https://render.com) → New → Web Service → connect the repo
3. Configure:

| Field | Value |
|---|---|
| **Root directory** | `backend` |
| **Build command** | `pip install -r requirements-prod.txt && cd ../frontend && npm install && npm run build` |
| **Start command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

### Step 3 — Environment variables (Render → Environment tab)

| Key | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq key |
| `DATABASE_URL` | Supabase connection string |
| `SECRET_KEY` | A long random string — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `PYTHON_VERSION` | `3.12.0` |

### Step 4 — Deploy

Click **Deploy**. Tables are created automatically on first boot. The app will be live at `https://your-service.onrender.com`.

> **Note:** Render free tier spins down after 15 minutes of inactivity. First request after idle takes ~30 seconds. Upgrade to a $7/mo instance for always-on.

---

## Project structure

```
├── backend/
│   ├── main.py                  # FastAPI app, CORS, static file serving
│   ├── agents.py                # Five P.R.I.C.E. agents + synthesis + research questions (Groq / Llama 3.3 70b)
│   ├── database.py              # SQLAlchemy models: User, Decision, AgentRun, JournalNote
│   ├── schemas.py               # Pydantic schemas (auth, decisions, agents, journal, bias)
│   ├── routes/
│   │   ├── auth.py              # POST /register, POST /login, POST /demo, GET /me — JWT auth
│   │   ├── decisions.py         # Decision CRUD, multi-turn converse, synthesise, research questions
│   │   ├── journal.py           # Journal view + per-decision notes
│   │   └── bias.py              # Bias fingerprint aggregations
│   ├── requirements.txt         # Cross-platform deps (no psycopg2)
│   ├── requirements-prod.txt    # Adds psycopg2-binary for Linux/Render
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx              # Auth gate → protected routes
│   │   ├── api.js               # All API calls with Bearer token injection
│   │   └── components/
│   │       ├── AuthPage.jsx         # Login / create account / try demo
│   │       ├── NavBar.jsx           # User name + sign-out
│   │       ├── DecisionGate.jsx     # New decision form → five agent conversations
│   │       ├── AgentPanel.jsx       # Per-agent chat UI (multi-turn, typing indicator)
│   │       ├── SessionView.jsx      # Persistent memo view at /session/:id
│   │       ├── SynthesisMemo.jsx    # Decision memo, PDF download, further research
│   │       ├── Journal.jsx          # Decision history + notes + outcome logging
│   │       └── BiasFingerprint.jsx  # P.R.I.C.E. radar chart + personal insights
│   └── package.json
│
└── render.yaml                  # Render deployment config
```

---

## The five agents

Each agent conducts a multi-turn conversation — up to 2 follow-up questions — before delivering a final scored judgment (0–10). Conversations are preserved in the database and feed the synthesis layer.

| | Agent | Job | Key question |
|---|---|---|---|
| **P** | Price Signal Separator | Distinguishes price reaction from business change | What *specifically* changed in the business — not the price? |
| **R** | Ruin Risk Assessor | Runs the pre-mortem you keep deferring | What is the single most dangerous assumption inside this thesis? |
| **I** | Independence Verifier | Detects mimetic pressure and borrowed conviction | Would you have reached this conclusion independently, without hearing anyone else's view? |
| **C** | Confirmation Challenger | Argues the bear case — every time, without relenting | What disconfirming evidence are you most likely ignoring? |
| **E** | Ego & Inertia Probe | Detects sunk cost, identity attachment, overconfidence | If you didn't already own this, would you buy it today at this price? |

> **Note:** Agent E (Ego & Inertia) is automatically skipped for new **Buy** decisions, since its sunk-cost and holding-inertia questions only apply to existing positions. For Buy decisions it is replaced by an overconfidence probe if manually started.

---

## User accounts

Invert is multi-user. Each person creates an account (name + email + password) and sees only their own journal and bias fingerprint. Sessions are authenticated with 30-day JWT tokens stored in `localStorage`.

To add the first user, open the app and click **Create Account** on the login screen.

A **Try Demo Account** button is also available on the login page — it logs in to a shared `demo@invert.app` account so visitors can explore the app without registering. Because it is shared, users should not enter real positions in the demo account.

---

## Bias Fingerprint

After 5+ decisions your personal profile builds automatically:

- **P.R.I.C.E. Radar** — average scores across all five dimensions
- **Skip pattern detection** — which agents you avoid and how often
- **Emotional regret rate** — % of high-stress decisions (emotional state ≥ 4) later rated as poor outcomes
- **Mimetic influence rate** — % of decisions where Independence score < 5
- **Plain-language insights** generated from your aggregated data

---

## End-of-session outputs

After all five agents complete, the **Synthesise** button generates a Decision Memo containing:

- **Invert Recommendation** — Proceed / Pause / Reconsider with rationale
- **Reflective Mind** — what rational analysis concluded across all agents
- **Emotional Patterns Detected** — biases surfaced during the conversations
- **P.R.I.C.E. scores** with per-dimension summaries
- **Key risks** to monitor

Two PDF exports are available:
1. **Download PDF** — the full Decision Memo for your records
2. **Further Research →** — a structured questionnaire of open questions, recommended data sources, and a ready-to-paste AI research agent prompt

The memo lives at a permanent URL (`/session/:id`) so it survives tab switching and can be reopened from the Journal at any time.

---

## Mobile support

The app is fully responsive. All layouts adapt from a standard desktop width down to a 375 px mobile viewport:

- Navigation labels shorten on small screens ("New", "Journal", "Bias") and padding tightens
- The decision form, Reflective/Emotional grid, P.R.I.C.E. scores, and Bias Fingerprint panels stack to a single column below the `sm` breakpoint (640 px)
- Agent panel headers truncate long agent names and abbreviate button labels on mobile
- The four action buttons on the Decision Memo use a 2×2 grid on mobile
- The Synthesise button goes full-width and stacks below its description text on small screens

---

## Inspired by

[Quality Compounder's PRICE-Guard series](https://qualitycompounder.substack.com/p/can-ai-save-us-from-our-behavioural) — the source of the P.R.I.C.E. framework and the PRICE-Guard concept.

Built on ideas from Charlie Munger's mental models, Luca Dellanna's *The Control Heuristic*, and Atul Gawande's *The Checklist Manifesto*.
#   i n v e r t - a i  
 