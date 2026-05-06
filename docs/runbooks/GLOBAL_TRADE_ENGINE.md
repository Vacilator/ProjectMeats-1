# Global Trade Engine Runbook

**Status:** B2B-02.1 contract and surface audit only  
**Contract version:** `b2b-02.1.v1`

This runbook defines the canonical **trade invariants contract** for weight conversion and time handling. It does **not** roll the contract out across the application yet. `B2B-02.1` establishes the rules, sources of truth, and adoption inventory that `B2B-02.2+` must implement.

## Scope and current constraints

- The backend already runs with `TIME_ZONE = "UTC"` and `USE_TZ = True` in `backend/projectmeats/settings/base.py`.
- Trade entities already persist explicit weight units (`WeightUnitChoices`, `weight_unit`, `uom`), but there is no shared backend conversion service yet.
- Plant and location models do **not** currently store a canonical IANA timezone field, so true plant-local datetime rendering is not yet possible without guessing from address data.
- Frontend datetime helpers in `frontend/src/utils/formatters.ts` currently render aware timestamps in the viewer's local timezone.
- Backend exports and PDFs currently format timestamps independently (`backend/apps/core/exporting.py`, `backend/apps/core/services/pdf_generator.py`).

## Canonical invariants

### 1. Weight contract

1. **Supported business units:** `LBS` and `KG` only.
2. **Canonical computational base unit:** pounds (`lbs`).
3. **Persistence contract for current schema:** preserve the source numeric field plus its explicit `weight_unit` / `uom`; do not silently overwrite user-entered units.
4. **Conversion contract:** all cross-unit math must flow through one Decimal-based helper/service, not ad hoc floats in views, serializers, PDFs, or frontend components.
5. **Current factor contract:** `1 kg = 2.20462262 lbs`, `1 lb = 0.45359237 kg`.
6. **Display contract:** round only at the edge using explicit quantization; keep internal conversion math unrounded until the final display/persistence step.

### 2. Datetime contract

1. **Absolute instants** must be stored as aware UTC datetimes.
2. **Date-only business values** (`DateField`) are calendar values and must not be shifted by timezone conversion.
3. **Plant-local rendering** is the target for facility-bound operational timestamps, but it is blocked until `tenant_apps.locations.Location` (or the surviving plant source) owns a canonical IANA timezone field.
4. **Interim rendering rule:** until that field exists, interactive frontend surfaces may render UTC instants in the viewer's local timezone, but exports/PDFs/audit trails must not pretend they are plant-local.
5. **No inferred timezone guesses:** state, ZIP code, or country must not be used as a surrogate timezone source.

## Canonical source files

| Concern | Source |
| --- | --- |
| Trade invariants contract | `docs/runbooks/GLOBAL_TRADE_ENGINE.md` |
| Backend helper contract | `backend/apps/core/conversions.py` |
| Weight unit enum | `backend/apps/core/models.py` |
| Backend UTC settings | `backend/projectmeats/settings/base.py` |
| Frontend datetime formatter seam | `frontend/src/utils/formatters.ts` |
| Backend CSV export seam | `backend/apps/core/exporting.py` |
| Backend operational PDF seam | `backend/apps/core/services/pdf_generator.py` |

## Current adoption inventory

### Backend model and serializer surfaces

| Surface | Current state | Adoption note |
| --- | --- | --- |
| `backend/apps/core/model_mixins.py` (`BaseLineItem`) | Stores `uom` and `total_net_weight` | Must adopt the shared conversion helper for line-item math and normalized display. |
| `backend/tenant_apps/purchase_orders/models.py` | Stores `total_weight`, `weight_unit`, `order_date`, `delivery_date`, `date_time_stamp` | Keep source units; future services must normalize to pounds for calculations and treat `DateField` values as calendar-only. |
| `backend/tenant_apps/sales_orders/models.py` | Stores `total_weight`, `weight_unit`, `date_time_stamp` and plant/pickup/delivery locations | Needs the future plant-timezone source before plant-local instant rendering can be correct. |
| `backend/tenant_apps/fulfillments/models.py` | Stores `ship_date`, `expected_delivery`, `actual_delivery`, `quantity_fulfilled`, `unit_price` | Date fields stay calendar-only; quantity math must remain Decimal-based. |
| `backend/tenant_apps/invoices/models.py` and serializers | Stores weights, quantities, and payment dates | Must consume the same weight/date contract as purchase and sales orders. |

### Backend export / PDF / document surfaces

| Surface | Current state | Adoption note |
| --- | --- | --- |
| `backend/apps/core/exporting.py` | Calls `timezone.localtime(raw)` for aware datetimes before CSV serialization | Must switch to the shared trade datetime contract so exports know whether a value is UTC, viewer-local, or future plant-local. |
| `backend/apps/core/services/pdf_generator.py` | Formats timestamps with `strftime("%Y-%m-%d %H:%M")` | Must use the canonical rendering helper once B2B-02.2 rolls out. |
| `backend/tenant_apps/inquiries/services/pdf_generator.py` | Formats dates ad hoc for quotes | Must keep date-only values calendar-safe and reuse the shared contract when operational trade timestamps are introduced. |

### Frontend display surfaces

| Surface | Current state | Adoption note |
| --- | --- | --- |
| `frontend/src/utils/formatters.ts` | Renders UTC instants in the viewer's local timezone | Becomes the rollout seam for the contract once plant-local rendering is supported. |
| `frontend/src/pages/SalesOrders/SalesOrders.tsx` | Uses shared formatters and weight fields in order grids/details | Must adopt future weight/time helpers instead of local ad hoc formatting. |
| `frontend/src/pages/PurchaseOrders.tsx` | Displays trade quantities, weights, and dates | Must preserve date-only semantics and unit labels from the shared contract. |
| `frontend/src/pages/Accounting/{Invoices,PayablePOs,ReceivableSOs,Claims}.tsx` | Displays financial/order dates and totals | Must follow the same date-only vs instant split so invoice/payment dates do not drift. |
| `frontend/src/components/Fulfillment/*` | Displays shipment dates, quantities, and totals | Must stay calendar-safe for `DateField` values while later tickets decide if any instants are plant-bound. |

### Current source-of-truth gap

- `tenant_apps.locations.Location` has plant-identifying fields (`location_type`, `plant_est_num`, address metadata) but **no** timezone column.
- The legacy `tenant_apps.plants.Plant` model also has no timezone field.
- Until a timezone source is added, the contract forbids claiming plant-local correctness for rendered instants.

## Non-goals for B2B-02.1

- No schema migration for a timezone column yet.
- No rollout of conversion helpers across existing serializers, PDFs, exports, or frontend pages yet.
- No settlement math changes, guest portal implementation, or public API changes.

## Validation

```bash
bash scripts/verify_golden_state.sh
cd backend && python manage.py test apps.core tenant_apps.purchase_orders tenant_apps.sales_orders tenant_apps.invoices
```

## Rollback

- Revert `backend/apps/core/conversions.py`, the runbook, and the validator/registry updates together.
- Do not revert unrelated order, invoice, or plant code because this ticket does not change runtime business behavior.
