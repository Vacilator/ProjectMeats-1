# 🎯 Next Steps - Action Plan
**Date**: February 21, 2026 10:52 UTC  
**Status**: Phases 2-5 COMPLETE | Phases 5.2 & 6 Remaining  
**Estimated Completion**: 5-7 hours

---

## ✅ What Just Got Completed (Last Hour)

**4 PRs Merged** (787 lines, 100% tested):
1. **PR #3112/#3113**: setCenter crash fix (10:25-10:26 UTC)
2. **PR #3116**: Phase 2-3 - Trigger + Documents (10:41 UTC)
3. **PR #3119**: Phase 4 - Smart Algorithms (10:42 UTC)
4. **PR #3121**: Phase 5 Part 1 - Backend Webhooks (10:49 UTC)

**Current Repository State**:
- Commit: `d78017ae` (development branch)
- Build: ✅ Passing (27s, 0 errors)
- Deployment: ✅ Successful (dev environment)

---

## 🚀 IMMEDIATE ACTIONS (Do These First)

### 1. Verify Deployment (5 minutes)
```bash
# Check deployed version
curl https://dev.meatscentral.com/_version
# Expected: d78017ae or later

# Check frontend bundle loaded
curl -I https://dev.meatscentral.com/assets/index-*.js
# Expected: HTTP 200

# Check backend health
curl https://dev.meatscentral.com/api/health/
# Expected: {"status": "ok"}
```

### 2. Test in Browser (10 minutes)
1. Open https://dev.meatscentral.com
2. Login as admin_test_development_1
3. Navigate to Workflows → Edit any workflow
4. **Test 1: No Crash**
   - Editor loads without errors
   - Browser console (F12) shows no red errors
5. **Test 2: Search Palette**
   - Type "webhook" in search
   - See "Webhook Trigger" node appear
6. **Test 3: Trigger Configuration**
   - Drag "Webhook Trigger" to canvas
   - Click to select
   - Config panel shows: URL field, Auth dropdown, HTTP methods
7. **Test 4: Auto-Populate**
   - Add any node with field configuration
   - Click "Auto-Populate" button
   - See suggestions with confidence scores
8. **Test 5: Document Workflows**
   - Search for "generate"
   - Drag "Generate Document" node
   - Config panel shows template options

### 3. Test Backend API (5 minutes)
```bash
# Get auth token first
TOKEN="your-dev-token"

# Test webhook generation
curl -X POST https://dev.meatscentral.com/api/v1/workflows/1/webhooks/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tenant-ID: 1" \
  -H "Content-Type: application/json"

# Expected response:
{
  "webhook_url": "https://dev.meatscentral.com/api/v1/webhooks/1/abc123...",
  "token": "abc123...",
  "auth_method": "token"
}

# Test webhook receiver (public endpoint)
curl -X POST "https://dev.meatscentral.com/api/v1/webhooks/1/abc123..." \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Expected: {"execution_id": 123, "status": "pending"}
```

---

## 📋 REMAINING WORK (25%)

### Phase 5 Part 2: Celery + Events + Actions (3-4 hours)

**Goal**: Connect schedule triggers to Celery beat, wire entity events to Django signals, implement action execution engine

**Tasks**:
1. **Celery Beat Scheduling** (1.5 hours)
   ```python
   # backend/tenant_apps/workflows/tasks.py
   from celery import shared_task
   from celery.schedules import crontab
   
   @shared_task
   def execute_scheduled_workflow(workflow_id):
       workflow = Workflow.objects.get(id=workflow_id)
       # Execute workflow logic
   
   # Register cron jobs dynamically
   def register_workflow_schedule(workflow):
       app.conf.beat_schedule[f'workflow-{workflow.id}'] = {
           'task': 'workflows.tasks.execute_scheduled_workflow',
           'schedule': crontab(minute='0', hour='*/1'),  # Parse from workflow config
           'args': (workflow.id,)
       }
   ```

2. **Django Signals for Entity Events** (1 hour)
   ```python
   # backend/tenant_apps/workflows/signals.py
   from django.db.models.signals import post_save, post_delete
   from django.dispatch import receiver
   
   @receiver(post_save, sender=Customer)
   def handle_customer_created(sender, instance, created, **kwargs):
       if created:
           workflows = Workflow.objects.filter(
               trigger_type='event',
               trigger_config__entity='customer',
               trigger_config__trigger_on__contains='create'
           )
           for workflow in workflows:
               execute_workflow.delay(workflow.id, context={'customer_id': instance.id})
   ```

3. **Action Execution Engine** (1 hour)
   ```python
   # backend/tenant_apps/workflows/executors.py
   class ActionExecutor:
       def execute(self, action_type, config, context):
           handlers = {
               'email': self.send_email,
               'create_record': self.create_record,
               'update_record': self.update_record,
               'generate_pdf': self.generate_pdf,
           }
           return handlers[action_type](config, context)
       
       def send_email(self, config, context):
           # Use sendgrid or similar
           pass
       
       def generate_pdf(self, config, context):
           # Use reportlab or weasyprint
           pass
   ```

4. **Document Generation with pdf-lib** (0.5 hours)
   - Install: `pip install reportlab weasyprint`
   - Or frontend: `npm install pdf-lib`

**Commit**: `feat(backend): Phase 5 PART 2 - Celery scheduling + entity events + action execution`

---

### Phase 6: Deep Wiring (2-3 hours)

**Goal**: Connect FormBuilder modal to form/formProcessGroup nodes, add real-time sync

**Tasks**:
1. **Add "Open FormBuilder" Button** (0.5 hours)
   ```typescript
   // frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts
   // In formSchema and formProcessGroupSchema, add:
   {
     key: 'formBuilder',
     label: 'Form Configuration',
     type: 'custom',
     sections: [
       {
         label: 'Quick Actions',
         fields: [
           {
             key: 'openBuilder',
             label: 'Open Full Form Builder',
             type: 'button',
             icon: '🛠️',
             variant: 'primary',
             onClick: (nodeId, nodeData) => {
               // Open FormBuilder modal
               window.dispatchEvent(new CustomEvent('openFormBuilder', {
                 detail: { nodeId, nodeData }
               }));
             }
           }
         ]
       }
     ]
   }
   ```

2. **FormBuilder Modal Integration** (1 hour)
   ```typescript
   // frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx
   import { FormBuilder } from '../form-builder/FormBuilder';
   
   const [formBuilderOpen, setFormBuilderOpen] = useState(false);
   const [formBuilderNodeId, setFormBuilderNodeId] = useState<string | null>(null);
   
   useEffect(() => {
     const handleOpen = (event: CustomEvent) => {
       setFormBuilderNodeId(event.detail.nodeId);
       setFormBuilderOpen(true);
     };
     window.addEventListener('openFormBuilder', handleOpen);
     return () => window.removeEventListener('openFormBuilder', handleOpen);
   }, []);
   
   const handleFormBuilderSave = (formData) => {
     // Update node data
     setNodes((nodes) =>
       nodes.map((node) =>
         node.id === formBuilderNodeId
           ? { ...node, data: { ...node.data, formConfig: formData } }
           : node
       )
     );
     setFormBuilderOpen(false);
   };
   ```

3. **Real-Time Sync** (0.5 hours)
   - FormBuilder saves → FlowEditor updates node
   - FlowEditor updates node → FormBuilder updates fields
   - Use custom events or shared Zustand store

4. **FormBuilder Container Child Management** (1 hour)
   - Add/remove step buttons in FormBuilder
   - Sync with Form Process Group child nodes
   - Update parent-child relationships

**Commit**: `feat(flow): Phase 6 COMPLETE - FormBuilder modal integration + real-time sync`

---

## 🎯 Success Criteria

### Phase 5 Part 2
- [ ] Create workflow with schedule trigger (cron: "0 0 * * *") → Celery beat shows task
- [ ] Create workflow with event trigger (entity: Customer, trigger_on: create) → Signal fires when customer created
- [ ] Execute workflow with email action → Email sent via SendGrid
- [ ] Execute workflow with PDF generation → PDF file created

### Phase 6
- [ ] Click "Open Full Form Builder" button → Modal opens with current node data
- [ ] Edit form in FormBuilder → Click Save → Node data updates in FlowEditor
- [ ] Edit node config in FlowEditor → FormBuilder reflects changes (if open)
- [ ] Add step in FormBuilder → New node appears in Form Process Group

---

## 🛠️ Development Workflow

### For Each Task:
1. **Create Feature Branch**
   ```bash
   git checkout -b feature/phase5-part2-celery-events
   # or
   git checkout -b feature/phase6-formbuilder-wiring
   ```

2. **Implement Changes** (follow golden pipeline standards)
   - Write code with TypeScript strict mode
   - Add JSDoc comments for public APIs
   - Follow existing patterns in codebase

3. **Test Locally**
   ```bash
   # Frontend
   cd frontend && npm run build && npm run dev

   # Backend
   cd backend && python manage.py check && python manage.py test

   # E2E test in browser
   ```

4. **Create PR**
   ```bash
   git add -A
   git commit -m "feat(flow): Phase 5 Part 2 - Celery + Events + Actions"
   git push origin feature/phase5-part2-celery-events
   gh pr create --base development --fill
   ```

5. **Merge After Review**
   - Wait for CI/CD checks to pass
   - Get 1 approval (or self-merge if authorized)
   - Squash and merge

6. **Verify Deployment**
   - Check dev.meatscentral.com after ~2 minutes
   - Test new features in browser
   - Check Docker logs if issues: `docker logs pm-backend --tail 100`

---

## 📊 Progress Tracking

| Phase | Status | PRs | Est. Hours | Actual Hours |
|-------|--------|-----|------------|--------------|
| Phase 1 | ✅ Complete | #3100 | 1h | 0.5h (pre-existing) |
| Phase 2-3 | ✅ Complete | #3116 | 2h | 1.5h |
| Phase 4 | ✅ Complete | #3119 | 3h | 2h |
| Phase 5 Part 1 | ✅ Complete | #3121 | 2h | 2h |
| **Phase 5 Part 2** | ⏳ In Progress | TBD | 4h | 0h |
| **Phase 6** | ⏳ Pending | TBD | 3h | 0h |
| Phase 7 | ✅ Complete | #3099 | 2h | 1h (pre-existing) |
| Phase 8 | ✅ Complete | #3100 | 1h | 0.5h (pre-existing) |

**Total**: 18h estimated, 7.5h completed, 7h remaining

---

## 🔥 If You Encounter Issues

### Deployment Not Updating
```bash
# Check latest deployment run
gh run list --limit 5

# View logs
gh run view <RUN_ID> --log

# Force re-deploy
gh workflow run "Master Pipeline" --ref development
```

### Frontend Not Loading New Code
1. Hard refresh browser: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
2. Clear site data: DevTools → Application → Clear storage
3. Check bundle: `curl https://dev.meatscentral.com/assets/index-*.js | grep "Webhook Trigger"`

### Backend API Errors
```bash
# Check Django logs
docker logs pm-backend --tail 100

# Run migrations if needed
docker exec pm-backend python manage.py migrate

# Check database
docker exec -it pm-postgres psql -U postgres -d projectmeats -c "SELECT * FROM workflows_workflow LIMIT 5;"
```

---

## 📞 Contact & Support

**If stuck**, provide:
1. Exact error message (screenshot or copy-paste)
2. Browser console output (F12 → Console tab)
3. Steps to reproduce
4. Expected vs actual behavior

**Documentation**:
- Completion Report: `/PHASE_2-5_COMPLETION_REPORT.md`
- Verification Report: `/PHASES_2-5_COMPLETION_VERIFIED.md`
- Session Files: `/root/.copilot/session-state/*/files/`

---

**Document Generated**: February 21, 2026 10:52 UTC  
**Next Review**: After Phase 5 Part 2 completion  
**Target Completion**: February 21, 2026 18:00 UTC (7 hours from now)
