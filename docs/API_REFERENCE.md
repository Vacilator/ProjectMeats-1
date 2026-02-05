# ProjectMeats API Reference

**Version**: 2.0.0  
**Base URL**: `https://api.meatscentral.com/api/v1/`  
**Documentation**: `/api/docs/` (Swagger UI) | `/api/redoc/` (ReDoc)

---

## Authentication

All API requests require authentication via Token header:

```bash
curl -H "Authorization: Token YOUR_AUTH_TOKEN" \
     -H "X-Tenant-ID: YOUR_TENANT_UUID" \
     https://api.meatscentral.com/api/v1/customers/
```

### Obtain Token

```bash
POST /api/v1/auth/login/
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

Response:
```json
{
  "token": "abc123...",
  "user": { "id": 1, "email": "user@example.com" }
}
```

---

## API Endpoints Overview

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health/` | Basic health check |
| GET | `/api/v1/health/detailed/` | Detailed health with DB status |
| GET | `/api/v1/ready/` | Kubernetes readiness probe |

### System Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/system/choice-lists/` | List all choice lists |
| GET | `/api/v1/system/choice-lists/{slug}/` | Get choice list by slug |
| GET | `/api/v1/system/config/choices/{slug}/` | Get choice items for list |
| GET | `/api/v1/system/config/resolve/` | Resolve config value |
| GET | `/api/v1/system/tenant-configs/` | List tenant configurations |
| POST | `/api/v1/system/tenant-configs/` | Create tenant config |
| PATCH | `/api/v1/system/tenant-configs/{id}/` | Update tenant config |
| DELETE | `/api/v1/system/tenant-configs/{id}/` | Delete tenant config |
| GET | `/api/v1/system/field-schemas/` | List field schemas |
| GET | `/api/v1/system/audit-logs/` | List config audit logs |
| GET | `/api/v1/system/audit-logs/{id}/` | Get audit log detail |
| GET | `/api/v1/system/audit-logs/summary/` | Get audit summary stats |
| GET | `/api/v1/system/audit-logs/entity/{type}/{id}/` | Get entity history |

### Tenants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/tenants/` | List tenants (superuser) |
| POST | `/api/v1/tenants/` | Create tenant |
| GET | `/api/v1/tenants/{id}/` | Get tenant details |
| PATCH | `/api/v1/tenants/{id}/` | Update tenant |
| GET | `/api/v1/tenants/current/` | Get current tenant |
| GET | `/api/v1/tenants/{id}/users/` | List tenant users |
| POST | `/api/v1/tenants/{id}/invite/` | Invite user to tenant |

### Customers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/customers/` | List customers |
| POST | `/api/v1/customers/` | Create customer |
| GET | `/api/v1/customers/{id}/` | Get customer |
| PATCH | `/api/v1/customers/{id}/` | Update customer |
| DELETE | `/api/v1/customers/{id}/` | Delete customer |
| GET | `/api/v1/customers/{id}/contacts/` | List customer contacts |
| GET | `/api/v1/customers/{id}/orders/` | List customer orders |

### Suppliers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/suppliers/` | List suppliers |
| POST | `/api/v1/suppliers/` | Create supplier |
| GET | `/api/v1/suppliers/{id}/` | Get supplier |
| PATCH | `/api/v1/suppliers/{id}/` | Update supplier |
| DELETE | `/api/v1/suppliers/{id}/` | Delete supplier |
| GET | `/api/v1/suppliers/{id}/products/` | List supplier products |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products/` | List products |
| POST | `/api/v1/products/` | Create product |
| GET | `/api/v1/products/{id}/` | Get product |
| PATCH | `/api/v1/products/{id}/` | Update product |
| DELETE | `/api/v1/products/{id}/` | Delete product |
| GET | `/api/v1/products/search/` | Search products |

### Purchase Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/purchase-orders/` | List purchase orders |
| POST | `/api/v1/purchase-orders/` | Create PO |
| GET | `/api/v1/purchase-orders/{id}/` | Get PO |
| PATCH | `/api/v1/purchase-orders/{id}/` | Update PO |
| DELETE | `/api/v1/purchase-orders/{id}/` | Delete PO |
| POST | `/api/v1/purchase-orders/{id}/submit/` | Submit for approval |
| POST | `/api/v1/purchase-orders/{id}/approve/` | Approve PO |
| POST | `/api/v1/purchase-orders/{id}/reject/` | Reject PO |
| GET | `/api/v1/purchase-orders/{id}/line-items/` | List PO line items |

### Sales Orders

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/sales-orders/` | List sales orders |
| POST | `/api/v1/sales-orders/` | Create SO |
| GET | `/api/v1/sales-orders/{id}/` | Get SO |
| PATCH | `/api/v1/sales-orders/{id}/` | Update SO |
| DELETE | `/api/v1/sales-orders/{id}/` | Delete SO |
| POST | `/api/v1/sales-orders/{id}/confirm/` | Confirm SO |
| GET | `/api/v1/sales-orders/{id}/line-items/` | List SO line items |

### Invoices / Accounting

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/accounting/invoices/` | List invoices |
| POST | `/api/v1/accounting/invoices/` | Create invoice |
| GET | `/api/v1/accounting/invoices/{id}/` | Get invoice |
| PATCH | `/api/v1/accounting/invoices/{id}/` | Update invoice |
| POST | `/api/v1/accounting/invoices/{id}/send/` | Send invoice |
| POST | `/api/v1/accounting/invoices/{id}/mark-paid/` | Mark as paid |
| GET | `/api/v1/accounting/payments/` | List payments |

### Plants

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/plants/` | List plants |
| POST | `/api/v1/plants/` | Create plant |
| GET | `/api/v1/plants/{id}/` | Get plant |
| PATCH | `/api/v1/plants/{id}/` | Update plant |
| DELETE | `/api/v1/plants/{id}/` | Delete plant |

### Carriers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/carriers/` | List carriers |
| POST | `/api/v1/carriers/` | Create carrier |
| GET | `/api/v1/carriers/{id}/` | Get carrier |
| PATCH | `/api/v1/carriers/{id}/` | Update carrier |
| DELETE | `/api/v1/carriers/{id}/` | Delete carrier |

### Contacts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/contacts/` | List contacts |
| POST | `/api/v1/contacts/` | Create contact |
| GET | `/api/v1/contacts/{id}/` | Get contact |
| PATCH | `/api/v1/contacts/{id}/` | Update contact |
| DELETE | `/api/v1/contacts/{id}/` | Delete contact |

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workflows/forms/` | List forms |
| POST | `/api/v1/workflows/forms/` | Create form |
| GET | `/api/v1/workflows/forms/{id}/` | Get form |
| PATCH | `/api/v1/workflows/forms/{id}/` | Update form |
| DELETE | `/api/v1/workflows/forms/{id}/` | Delete form |
| GET | `/api/v1/workflows/submissions/` | List submissions |
| POST | `/api/v1/workflows/submissions/` | Create submission |
| GET | `/api/v1/workflows/submissions/{id}/` | Get submission |
| PATCH | `/api/v1/workflows/submissions/{id}/` | Update submission |
| POST | `/api/v1/workflows/submissions/{id}/submit/` | Submit form |

### Workspace (Cockpit)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/workspace/dashboard/` | Get dashboard data |
| GET | `/api/v1/workspace/quick-actions/` | List quick actions |
| GET | `/api/v1/workspace/recent-activity/` | Get recent activity |
| GET | `/api/v1/workspace/notifications/` | List notifications |
| PATCH | `/api/v1/workspace/notifications/{id}/read/` | Mark notification read |

### AI Assistant

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/ai-assistant/chat/` | Send chat message |
| GET | `/api/v1/ai-assistant/suggestions/` | Get AI suggestions |
| POST | `/api/v1/ai-assistant/analyze/` | Analyze data |

### Feedback

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/feedback/` | List feedback items |
| POST | `/api/v1/feedback/` | Submit feedback |
| GET | `/api/v1/feedback/{id}/` | Get feedback |

---

## Pagination

List endpoints return paginated results:

```json
{
  "count": 150,
  "next": "https://api.meatscentral.com/api/v1/customers/?page=2",
  "previous": null,
  "results": [...]
}
```

Query parameters:
- `page`: Page number (default: 1)
- `page_size`: Results per page (default: 20, max: 100)

---

## Filtering & Search

Most list endpoints support filtering:

```bash
# Filter customers by industry
GET /api/v1/customers/?industry=retail

# Search products
GET /api/v1/products/?search=beef

# Filter orders by status
GET /api/v1/purchase-orders/?status=pending

# Date range filtering
GET /api/v1/sales-orders/?created_after=2026-01-01&created_before=2026-02-01
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Validation failed",
  "details": {
    "field_name": ["Error message"]
  }
}
```

### 401 Unauthorized
```json
{
  "detail": "Authentication credentials were not provided."
}
```

### 403 Forbidden
```json
{
  "detail": "You do not have permission to perform this action."
}
```

### 404 Not Found
```json
{
  "detail": "Not found."
}
```

### 500 Internal Server Error
```json
{
  "error": "An unexpected error occurred",
  "reference": "ERR-12345"
}
```

---

## Rate Limiting

API requests are rate-limited per tenant:
- **Standard**: 1000 requests/minute
- **Burst**: 100 requests/second

Headers in response:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1706918400
```

---

## Webhooks

Configure webhooks for real-time notifications:

```bash
POST /api/v1/system/webhooks/
{
  "url": "https://your-app.com/webhook",
  "events": ["order.created", "invoice.paid"],
  "secret": "your-webhook-secret"
}
```

Webhook payload:
```json
{
  "event": "order.created",
  "timestamp": "2026-02-03T03:00:00Z",
  "data": {...}
}
```

---

## SDK & Libraries

- **Python**: `pip install projectmeats-sdk`
- **JavaScript**: `npm install @meatscentral/api-client`

---

## Interactive Documentation

- **Swagger UI**: `/api/docs/`
- **ReDoc**: `/api/redoc/`
- **OpenAPI Schema**: `/api/schema/`

Download the OpenAPI spec:
```bash
curl https://api.meatscentral.com/api/schema/ > openapi.yaml
```

---

*Last updated: 2026-02-03*
