# Phase 3 Deployment Checklist

**Pre-Deployment Review:** Use this checklist before deploying Phase 3 to production.

---

## 🔍 Pre-Deployment Verification

### Backend Verification

- [x] **Migration created:** `0009_phase3_choice_engine.py`
- [x] **Migration applied:** Run `python manage.py showmigrations system`
- [x] **Django check passes:** Run `python manage.py check`
- [x] **Models importable:** Test `from apps.system.models import TenantChoiceOverride, TenantFieldDefinition`
- [x] **Seed command works:** Run `python manage.py seed_choice_lists --dry-run`
- [x] **Data seeded:** Run `python manage.py seed_choice_lists`
- [x] **API endpoints registered:** Check `/api/v1/system/choice-overrides/` and `/api/v1/system/field-definitions/`

### Frontend Verification

- [x] **Component created:** `frontend/src/components/Admin/ChoiceListEditor.tsx`
- [x] **Component exported:** Check `frontend/src/components/Admin/index.ts`
- [ ] **Dependencies installed:** Run `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
- [ ] **Component renders:** Test in development environment
- [ ] **API integration works:** Test adding/editing/deleting items

### Documentation

- [x] **Verification report:** `/PHASE3_VERIFICATION_REPORT.md`
- [x] **Quick start guide:** `/docs/PHASE3_QUICK_START.md`
- [x] **Execution summary:** `/PHASE3_EXECUTION_SUMMARY.md`
- [x] **Deployment checklist:** This file

---

## 📦 Deployment Steps

### 1. Backend Deployment

```bash
# On production server
cd /path/to/ProjectMeats/backend

# Pull latest code
git pull origin main

# Install any new Python dependencies (if added)
pip install -r requirements.txt

# Run migrations
python manage.py migrate system

# Seed choice lists (idempotent - safe to run multiple times)
python manage.py seed_choice_lists

# Verify migration
python manage.py showmigrations system | grep phase3_choice_engine

# Check for issues
python manage.py check

# Restart backend service
sudo systemctl restart projectmeats-backend
# OR: docker restart pm-backend
```

### 2. Frontend Deployment

```bash
# On development/build machine
cd /path/to/ProjectMeats/frontend

# Install new dependencies
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Build production bundle
npm run build

# Deploy build artifacts to production
# (Method depends on your deployment strategy)
rsync -avz build/ user@prod-server:/var/www/projectmeats/
# OR: docker build and push

# Restart frontend service
sudo systemctl restart projectmeats-frontend
# OR: docker restart pm-frontend
```

### 3. Post-Deployment Verification

```bash
# Test API endpoints
curl -X GET https://your-domain.com/api/v1/system/choice-lists/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return list of choice lists including new ones:
# - protein_types
# - packaging_types
# - processing_grades
# - cut_types

# Test choice items endpoint
curl -X GET https://your-domain.com/api/v1/system/choice-lists/protein_types/items/ \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should return 8 items: Beef, Pork, Poultry, Seafood, Lamb, Veal, Game, Plant-Based
```

---

## 🧪 Testing Checklist

### Backend API Tests

- [ ] **List choice lists:** `GET /api/v1/system/choice-lists/`
- [ ] **Get specific list:** `GET /api/v1/system/choice-lists/protein_types/`
- [ ] **Get items:** `GET /api/v1/system/choice-lists/protein_types/items/`
- [ ] **Add custom item:** `POST /api/v1/system/choice-lists/protein_types/items/`
- [ ] **Edit custom item:** `PATCH /api/v1/system/choice-items/{id}/`
- [ ] **Delete custom item:** `DELETE /api/v1/system/choice-items/{id}/`
- [ ] **Reorder items:** `POST /api/v1/system/choice-lists/protein_types/reorder/`
- [ ] **Create field definition:** `POST /api/v1/system/field-definitions/`
- [ ] **List field definitions:** `GET /api/v1/system/field-definitions/`

### Frontend Component Tests

- [ ] **Component loads:** Navigate to admin page with ChoiceListEditor
- [ ] **System items display:** See system items with "System" badge
- [ ] **Add item form:** Click "Add Custom Item" button
- [ ] **Add item:** Submit form to add new item
- [ ] **Item appears:** New item shows with "Custom" badge
- [ ] **Edit item:** Click edit icon, change label, save
- [ ] **Delete item:** Click delete icon, confirm, item removed
- [ ] **Drag-to-reorder:** Drag items to new positions (if reorderable)
- [ ] **Toggle visibility:** Click eye icon to hide/show system items

### Permissions Tests

- [ ] **Tenant admin:** Can add/edit/delete custom items
- [ ] **Regular user:** Can view but not modify
- [ ] **Tenant isolation:** Users only see their tenant's custom items
- [ ] **System items protected:** Cannot delete system items

### Data Integrity Tests

- [ ] **Unique values:** Cannot create duplicate value within list
- [ ] **Required fields:** Cannot submit without value and label
- [ ] **Order preservation:** Order is maintained after reordering
- [ ] **Tenant filtering:** System items + tenant items only (not other tenants)

---

## 🚨 Rollback Procedure

If critical issues are found after deployment:

### Step 1: Rollback Migration (if needed)

```bash
# Rollback to previous migration
python manage.py migrate system 0008_rename_node_types

# Verify rollback
python manage.py showmigrations system
```

### Step 2: Remove Seeded Data (if needed)

```bash
python manage.py shell << 'EOF'
from apps.system.models import SystemChoiceList
SystemChoiceList.objects.filter(
    slug__in=['protein_types', 'packaging_types', 'processing_grades', 'cut_types']
).delete()
print("Seeded data removed")
EOF
```

### Step 3: Revert Code Changes

```bash
# Find commit hash
git log --oneline | grep "Phase 3"

# Revert commit
git revert <commit-hash>

# Push revert
git push origin main

# Redeploy
# (Follow backend/frontend deployment steps)
```

---

## 📊 Monitoring

### Post-Deployment Monitoring (First 24 Hours)

- [ ] **Error logs:** Check for Python exceptions related to choice lists
- [ ] **API response times:** Monitor `/api/v1/system/choice-lists/` endpoint
- [ ] **Database queries:** Check for N+1 queries or slow joins
- [ ] **User feedback:** Collect feedback from tenant admins
- [ ] **Browser console:** Check for JavaScript errors in ChoiceListEditor

### Metrics to Track

- **API endpoint usage:**
  - `/api/v1/system/choice-lists/` - List views
  - `/api/v1/system/choice-lists/{slug}/items/` - Item fetches
  - `/api/v1/system/field-definitions/` - Custom field usage

- **Database performance:**
  - Query time for choice item lookups
  - Custom_data JSON field query performance

- **User actions:**
  - Number of custom items added per tenant
  - Number of field definitions created
  - Usage of reorder functionality

---

## 🆘 Troubleshooting

### Issue: Migration Fails

**Symptoms:** `python manage.py migrate` fails with error

**Solution:**
```bash
# Check migration status
python manage.py showmigrations system

# If partially applied, rollback
python manage.py migrate system 0008_rename_node_types

# Fix any issues, then reapply
python manage.py migrate system
```

### Issue: Seed Command Fails

**Symptoms:** `python manage.py seed_choice_lists` throws error

**Solution:**
```bash
# Check if lists already exist
python manage.py shell -c "from apps.system.models import SystemChoiceList; print(SystemChoiceList.objects.filter(slug='protein_types').exists())"

# If exists, use --force to recreate
python manage.py seed_choice_lists --force
```

### Issue: Frontend Component Not Rendering

**Symptoms:** Blank screen or error in browser console

**Solution:**
1. Check browser console for errors
2. Verify dependencies installed: `npm list @dnd-kit/core`
3. Check API endpoint is accessible: `curl /api/v1/system/choice-lists/`
4. Verify user has permissions and tenant context

### Issue: Tenant Items Not Appearing

**Symptoms:** Custom items don't show in dropdown

**Solution:**
1. Check TenantMiddleware is active
2. Verify `request.tenant` is set
3. Check item's `is_active` is True
4. Verify tenant filtering in API call

---

## ✅ Success Criteria

Phase 3 deployment is successful when:

- [x] Migration applied without errors
- [x] Seed command runs successfully
- [x] 4 choice lists with 26 items exist
- [ ] API endpoints respond with 200 OK
- [ ] Frontend component loads without errors
- [ ] Tenant admins can add custom items
- [ ] Tenant admins can create field definitions
- [ ] No errors in production logs
- [ ] No performance degradation
- [ ] Zero breaking changes to existing functionality

---

## 📞 Support Contacts

**Backend Issues:**
- Review: `/docs/PHASE3_QUICK_START.md`
- Check: `/PHASE3_VERIFICATION_REPORT.md`

**Frontend Issues:**
- Component: `/frontend/src/components/Admin/ChoiceListEditor.tsx`
- Usage: See Quick Start Guide section "For Frontend Developers"

**Database Issues:**
- Migration: `apps/system/migrations/0009_phase3_choice_engine.py`
- Models: `apps/system/models/tenant_choice_override.py`, `tenant_field_definition.py`

---

## 📝 Notes

- **Idempotency:** Seed command is safe to run multiple times
- **No Breaking Changes:** Existing functionality unaffected
- **Backward Compatible:** Old code continues to work
- **Tenant Isolated:** All data automatically filtered by tenant
- **System Items Protected:** Cannot be deleted, only disabled per tenant

---

**Last Updated:** 2026-02-14  
**Version:** 1.0  
**Status:** Ready for Deployment
