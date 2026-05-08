> [!IMPORTANT]
> ARCHIVED (Historical)
>
> This document is retained for historical context only and is **not canonical**.
> The canonical source of truth for priorities and definitions of done is **/MASTER_PLAN.md**.
> Roadmaps in **/ROADMAP.md** and **/UI_ROADMAP.md** are reference-only unless promoted in MASTER_PLAN.

# V4.0 Field Ops Architecture (Warehouse + Drivers)

**Status**: Vision / Architecture Plan (no code)

## Problem
Field users (receiving, QA, dock, drivers) cannot operate dense desktop UIs. They need a fast, offline-tolerant workflow for scanning, photo capture, and quick confirmations.

## Target experiences
1. **Warehouse Receiving Mode**
   - Scan → identify PO / line
   - Confirm quantities/weights
   - Capture damage photos
   - Submit receiving report
2. **Driver / Carrier Mode**
   - View assigned pickups/deliveries
   - Check-in/out timestamps
   - Temperature exceptions (if IoT integrated)

## Client options
- **React Native** (preferred for camera/scanner + offline)
- PWA as fallback for quick deployment

## Backend requirements
### Core models (tenant-aware)
- `ReceivingReport` + `ReceivingLine`
- `Attachment` / `Photo` (linked to receiving lines)
- `DeviceSession` (optional, for per-device auth and audit)

### APIs (examples)
- `POST /api/v1/receiving/reports/` (create report)
- `POST /api/v1/receiving/reports/{id}/lines/` (append/update line)
- `POST /api/v1/receiving/reports/{id}/photos/` (multipart upload)
- `GET /api/v1/receiving/lookup/?barcode=...`

### Security
- JWT user auth (normal users) with warehouse role
- RLS enforced via tenant FK
- Audit trail events for receiving confirmations

## Offline strategy
- Local queue of mutations
- Idempotency keys per mutation
- Background sync with exponential backoff

## Telemetry hooks
- Capture scan latency + sync failures in Sentry

## Definition of Done
- Receiving workflow completes on mobile with <= 3 taps per line item
- Works on spotty connectivity (queue + retry)
