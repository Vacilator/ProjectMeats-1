# V4.0 — Dynamic Pricing & Yield Management (Margin Optimization)

**Status**: Vision / Architecture Plan (no code)

## Why this matters
Perishable inventory turns margin into a time‑dependent function:
- Days to expiration and grade changes drive sell‑through urgency
- Cold storage and shrink/trim loss impose real carrying costs
- Market prices move daily/weekly

The moat: a pricing/yield system that **continuously surfaces the best move** (discount / substitute / bundle / rework) before inventory becomes a write‑off.

## Current architecture snapshot (as‑is)
- Sales Orders and Products exist, but pricing is largely **static** (price books/overrides).
- There is no single “pricing decision service” or “yield/age risk” signal.

---

## Proposed architecture
### Principle
Move from “price = field on line item” to “price = decision produced by a service with explainability”.

### Core components
#### 1) Pricing Engine service (backend module)
A pure service that produces:
- recommended price
- pricing floor/ceiling
- explanation (“why”) + sensitivity

**Inputs** (tenant‑scoped):
- inventory lots (age, expiration, grade, on‑hand)
- storage cost model (per day, per pallet, facility)
- demand curve (historical sell‑through by product/customer/season)
- market index prices (Urner Barry / USDA) via integration adapter
- customer contract constraints (min price, locked pricing windows)

**Outputs**:
- `recommended_unit_price`
- `floor_price`
- `confidence_score`
- `reason_codes[]`

#### 2) Yield / shrink model
A small service that estimates:
- expected yield % by product + process step
- expected shrink over time / temperature band

Outputs feed pricing (e.g., lower floor if shrink risk is high).

#### 3) Cockpit UX integration
When drafting a Sales Order:
- show an **“Aging Inventory”** panel
- annotate line items with:
  - recommended price
  - “must move” tags
  - substitution suggestions

---

## Data model (proposed)
> Tenant aware + RLS.

### `PricingRule`
- tenant
- scope: product / customer / plant / channel
- constraints: min margin, min price, max discount
- effective dates

### `MarketPriceSnapshot`
- tenant (optional: global + mapped)
- provider (USDA/UrnerBarry)
- product mapping key
- price
- captured_at

### `StorageCostModel`
- tenant
- facility/location
- cost_per_day_per_unit (or tiered)

### `PriceRecommendation`
Persisted recommendation to ensure auditability and allow analytics.
- tenant
- context (sales_order_draft_id, product, customer)
- recommended_unit_price / floor / ceiling
- explanation json
- created_at

---

## Pricing algorithm (MVP)
Start with deterministic heuristics + explainability; add ML later.

### Baseline formula
- `market_anchor = market_index_price(product)`
- `age_penalty = f(days_to_expiration, grade_risk)`
- `carry_cost = storage_cost_per_day * days_in_storage`
- `demand_factor = g(rolling_4w_velocity, seasonality)`

Then compute:
- `floor = max(cost_basis + carry_cost + min_margin, contractual_min)`
- `recommended = clamp(market_anchor - age_penalty + demand_factor, floor, ceiling)`

### Explainability
Return “reason codes” like:
- `AGING_INVENTORY` (expires in 7 days)
- `COLD_STORAGE_COST_HIGH`
- `MARKET_PRICE_DROP`
- `DEMAND_SOFT`

---

## API design
- `GET /api/v1/pricing/recommendations/?customer=<id>&product=<id>`
- `POST /api/v1/pricing/recommendations/preview/` (draft SO payload → recommendations)
- `POST /api/v1/pricing/recommendations/accept/` (persist acceptance)

## Frontend UX: Cockpit “Pricing Coach”
### Where it shows up
- Sales Order draft screen (inline on each line)
- Inventory dashboard (highlight “must move” lots)

### UX elements
- Price pill: Recommended / Floor / Contract
- Tooltip: explanation + links to lots driving recommendation
- Quick actions:
  - “Apply recommendation”
  - “Offer substitution”
  - “Bundle discount”

---

## Integration dependencies
- Traceability lots (optional but strongly synergistic)
- Market price ingestion connector
- Accurate expiration dates and on‑hand inventory counts

---

## Rollout plan
### Phase 1
- Create service + deterministic recommendation
- Cockpit UI display + apply

### Phase 2
- Learning loop: compare recommended vs achieved margin
- Add forecasting / optimization

### Phase 3
- Autopilot pricing rules with HITL approval queue

---

## Business feasibility checks (must validate)
- Do we have reliable expiration/on‑hand data per lot?
- Can we compute a defensible cost basis (including storage + shrink)?
- Is there a market index we can legally license for pricing signals?
