# ProjectMeats Planning Documents

> **Last Updated**: 2026-02-01

This directory contains **active planning documents** for ProjectMeats v2.0.

---

## 🎯 Source of Truth

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| **[PROJECTMEATS_V2_MASTER_PLAN.md](PROJECTMEATS_V2_MASTER_PLAN.md)** | THE master plan for v2.0 overhaul | Weekly |
| **[PROGRESS_TRACKER.md](PROGRESS_TRACKER.md)** | Real-time progress tracking | Daily |

---

## 📋 Active Plans

| Plan | Scope | Status |
|------|-------|--------|
| [Master Plan v3.1](PROJECTMEATS_V2_MASTER_PLAN.md) | Full v2.0 implementation | 🔄 28% Complete |
| [Progress Tracker](PROGRESS_TRACKER.md) | Task tracking & metrics | 🔄 Updated daily |
| **[Multi-Step Container](MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md)** | **Container workflows fix** | **⏳ Ready to Execute** |
| [Forms Enhancement](FORMS_FLOWS_ENHANCEMENT_PLAN.md) | Forms & workflows | 🔄 Wave 3 |
| [Doc Organization](DOCUMENTATION_ORGANIZATION_PLAN.md) | Documentation cleanup | 🔄 Wave 5 |

---

## 📦 Archived Plans

Plans that have been **consolidated into the Master Plan**:

| Plan | Now Part Of | Location |
|------|-------------|----------|
| Form System Overhaul | Wave 3: Forms & Flows | [archive/superseded-plans/](../archive/superseded-plans/) |
| Data Entity Restructuring | Wave 6: Model Migrations | [archive/superseded-plans/](../archive/superseded-plans/) |
| Admin Backend Revamp | Wave 4: Admin Studio | [archive/superseded-plans/](../archive/superseded-plans/) |
| Form Editor & Execution | Forms Enhancement Plan | [archive/superseded-plans/](../archive/superseded-plans/) |

---

## 🔄 Plan Hierarchy

```
Master Plan v3.1 (Source of Truth)
├── Wave 0: Preparation ✅
├── Wave 1: Foundation 
├── Wave 2: Cockpit Command Center
├── Wave 3: Forms & Flows ← FORMS_FLOWS_ENHANCEMENT_PLAN.md
├── Wave 4: Admin Studio Enhancement
├── Wave 5: Repository Cleanup ← DOCUMENTATION_ORGANIZATION_PLAN.md
├── Wave 6: Model Migrations
├── Wave 7: Finalization
├── Wave F: Features
├── Wave M: Mobile
├── Wave T: Testing
└── Wave I: Infrastructure
```

---

## 📏 Planning Standards

### When to Create a New Plan

- **DO** create a plan for multi-week efforts spanning multiple waves
- **DO** create a plan when detailed task breakdown needed beyond Master Plan
- **DON'T** create a plan that duplicates Master Plan content
- **DON'T** create standalone plans - link them to Master Plan wave

### Plan Document Template

```markdown
# [Feature/Area] Plan

**Document Version**: 1.0  
**Created**: YYYY-MM-DD  
**Status**: 📋 PLANNING | 🔄 IN PROGRESS | ✅ COMPLETE  
**Tracked In**: Wave X of Master Plan v3.1

---

## Related Documents
| Document | Purpose |
|----------|---------|
| [Master Plan](PROJECTMEATS_V2_MASTER_PLAN.md) | Parent plan |
| [Progress Tracker](PROGRESS_TRACKER.md) | Task tracking |

---

## Executive Summary
[Brief description of what this plan covers]

## Tasks
[Detailed task breakdown]

## Success Criteria
[How we know this plan is complete]
```

---

*This directory is part of the [Documentation Organization](DOCUMENTATION_ORGANIZATION_PLAN.md) effort*
