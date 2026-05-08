> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 UX Excellence Roadmap (Consumerization of IT)

**Status**: Vision / UX Engineering Plan (no code)

## Goal
Reduce interaction cost (clicks, context switches) while preserving enterprise safety (auditability, role checks, recovery paths).

## UX pillars
1. **Command Palette (Cmd/Ctrl+K)** for global search + actions
2. **Optimistic mutations** for common edits
3. **Skeleton loading** and “no-jank” transitions
4. **Predictable information architecture** (nested drill-down, not flat arrays)

## Current strengths (retain)
- UniversalEntityForm + schema-driven forms
- Cockpit navigation context + drilldowns
- RLS and tenant-safe viewset patterns

## Gaps / pain patterns to eliminate
- Multiple table/grid paradigms across pages
- Inconsistent loading states (spinners vs blank)
- Silent failures (now improved via Sentry hardening)
- Too many modal variants for creation/editing

## Plan (phased, actionable)

### Phase A — Command Palette foundation
**Frontend**
- Add `CommandPaletteProvider` at app root
- Index core entities (customers, suppliers, POs, SOs, products, workforms)
- Include actions:
  - “Create Purchase Order”
  - “Open Customer …”
  - “Switch Tenant …”

**Backend**
- Add a unified search endpoint (if not already):
  - `GET /api/v1/system/search/?q=` returning typed results

**Accessibility**
- Full keyboard nav, ARIA roles, focus trap

### Phase B — Optimistic UI (safe defaults)
**Rules**
- Optimistic only for low-risk fields
- Always preserve undo/rollback hooks

**Implementation**
- Use React Query mutations with:
  - optimistic cache update
  - rollback on error
  - toast + inline error region

### Phase C — Skeletons + transition system
- Standard skeleton components for:
  - entity detail
  - list tables
  - form surfaces
- Prefer “layout skeleton” over spinners

### Phase D — Standardize data grids
- Single `ResponsiveTable` contract:
  - consistent filter bar
  - column presets
  - export button integration
  - row drilldown affordances

### Phase E — Error experience (enterprise-grade)
- Error boundaries per route segment
- Retry affordances
- “Copy debug info” panel for support

## Non-goals
- Cosmetic redesign without workflow impact
- Replacing AntD with a new component library

## Definition of Done
- Users can reach any common entity/action with Cmd+K
- Critical pages feel instant (optimistic) and never flash blank (skeleton)
- Tables look/behave consistently across modules
