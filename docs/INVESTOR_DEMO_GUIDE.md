# Investor Demo Guide — Meats Central

> **Duration:** 5-7 minutes  
> **Environment:** https://dev.meatscentral.com  
> **Credentials:** `admin_test_development_1` / `password123!`

---

## Pre-Demo Setup

1. Open browser to https://dev.meatscentral.com (clear cache if needed)
2. Have a second tab ready for email trigger demo (optional)
3. Ensure Wi-Fi is stable (WebSocket connections power real-time updates)

---

## Demo Script

### Scene 1: The Command Center (60 seconds)

**Narration:** "This is the Trader Command Center — the single screen where a meat trader manages their entire business."

1. **Login** → auto-redirects to `/trader-cockpit`
2. **Point out KPI cards** at the top: Active Trades, Pending Approvals, AI Confidence Score
3. **Show 4 tabs**: Command Center | Live Pipeline | Operations | History
4. **Key message:** "Everything a trader needs. One screen. Zero navigation."

---

### Scene 2: Smart Trade Creator (90 seconds)

**Narration:** "Watch how a trade gets created with almost zero effort."

1. Click **"New Trade"** button (top right of Command Center tab)
2. **Natural Language mode**: Type `"50,000 lbs ground beef 81/19 for Sysco, deliver next Tuesday"`
3. **AI fills the form** — show that supplier, product, quantity, dates, contacts are all auto-populated
4. Point out the **confidence badge** (e.g., "92% confidence")
5. **One click** → trade enters the pipeline

**Key message:** "Natural language in, fully structured trade out. The AI handles the data entry."

---

### Scene 3: AI Trade Proposals (60 seconds)

**Narration:** "The system doesn't just react — it proactively suggests trades."

1. Switch to the **AI Proposals** section within Command Center
2. Show a **proactive suggestion** (e.g., "Based on recent RFQs, suggest purchasing X from Y")
3. Point out:
   - Confidence score
   - Reasoning/explanation
   - One-click "Execute" button
   - Feedback thumbs up/down
4. **Key message:** "When confidence is high enough, these execute automatically. Zero human touch."

---

### Scene 4: Live Pipeline (60 seconds)

**Narration:** "Every trade flows through an intelligent pipeline — email to PO, fully automated."

1. Switch to **Live Pipeline** tab
2. Show Kanban columns: Inquiry → Bid → Sales Order → Purchase Order → Fulfillment
3. Click a trade card to show the **React Flow process diagram**
4. Show **clickable nodes** with enriched contact details (Plant Contact Type, Title, Responsibilities)
5. **Key message:** "Complete visibility. Every stage tracked. Every contact enriched."

---

### Scene 5: AI Inbox (45 seconds)

**Narration:** "Emails come in, get parsed by AI, and draft trades automatically."

1. Navigate to **Process Cockpit** → AI Inbox tab (or `/process-cockpit`)
2. Show a parsed email with extracted fields (PO number, quantities, contacts)
3. Show the **editable draft** with pre-filled form
4. Point out the **feedback loop** (thumbs up/down trains the model)
5. **Key message:** "The AI gets smarter with every trade. Human feedback improves accuracy."

---

### Scene 6: Master Data Intelligence (45 seconds)

**Narration:** "Every form node, every RFQ, every email — leverages enriched master data."

1. Navigate to `/suppliers` → select a supplier → Plants tab
2. Show **Plant Contact Types** (Commercial, Quality, Logistics, Billing)
3. Show **Responsible For** multi-selects and **Title** fields
4. **Key message:** "When the system sends an RFQ, it knows exactly who to email based on role, responsibility, and plant."

---

### Scene 7: The Vision — Hands-Free Trading (30 seconds)

**Narration (closing):**

> "What you're seeing is a platform where:
> - **Emails become trades** — automatically
> - **AI proposes actions** — with confidence scoring
> - **Humans approve or override** — training the model
> - **Eventually, the AI runs trades end-to-end** — when confidence is high enough
> 
> This is the future of meat trading: **hands-free, AI-powered, always improving.**"

---

## Q&A Prep

### "How does multi-tenancy work?"
"Shared PostgreSQL schema with Row-Level Security. Each tenant's data is physically isolated at the database engine level — not just application logic."

### "What's the AI stack?"
"OpenAI GPT-4 for parsing and proposals. Confidence scoring with RLHF-style feedback loops. Celery for async orchestration. The model improves with every thumbs-up/down."

### "How do you handle unsupervised automation?"
"Confidence thresholds. When the AI is above a configurable threshold (e.g., 95%), it can execute without human approval. Below that, it drafts for review. The trader is always in control."

### "What about scalability?"
"Django + PostgreSQL + Redis + Celery. Horizontal scaling via Docker Swarm. 149 backend tests, TypeScript strict mode, structured observability. Enterprise-grade from day one."

### "How many customers?"
"Multi-tenant SaaS — each customer gets their own isolated data space. Onboarding is instant: create tenant, invite users, start trading."

---

## Emergency Fallbacks

| Issue | Solution |
|-------|----------|
| Site won't load | Refresh; check dev.meatscentral.com is up |
| WebSocket disconnects | Refresh page (auto-reconnects) |
| AI features not responding | Check Celery workers (backend health endpoint) |
| Slow loading | Clear browser cache; ensure no VPN interference |

---

**Last Updated:** May 8, 2026
