# Admin Workspace

Complete tenant administration system for ProjectMeats.

## 🎯 Overview

The Admin Workspace provides tenant administrators and owners with comprehensive tools to manage their organization, users, configurations, and monitor activity.

## 📁 Structure

```
frontend/src/pages/Admin/
├── Users/           # User management & invitations
├── Profile/         # Organization profile & branding
├── OptionLists/     # System choice lists (dropdown options)
├── Configurations/  # Tenant configuration settings
├── Activity/        # Activity logs & audit trail
├── Billing/         # Subscription & billing management
└── Customizations/  # UI customization settings
```

## ✨ Features

### 1. Users & Invitations (Phase 1)
**Route**: `/workspace/users`

- View all tenant users
- Invite new users via email
- Assign roles (owner, admin, member, viewer)
- Deactivate/reactivate users
- Edit user details
- Activity tracking for user actions

**Permissions**: Owners and admins only

### 2. Profile & Branding (Phase 2)
**Route**: `/workspace/profile`

- Organization information (name, description, address, website)
- Logo upload with preview
- Theme customization (light/dark mode colors)
- Live preview of branding changes
- Save and reset options

**Permissions**: Owners and admins only

### 3. Option Lists Management (Phase 3)
**Route**: `/workspace/option-lists`

- View all system choice lists
- Create custom option lists
- Edit list options (add/remove/reorder)
- Delete unused lists
- Search and filter
- Usage indicators (shows where lists are used)

**Permissions**: Owners and admins only

### 4. Configurations (Phase 4)
**Route**: `/workspace/configurations`

- Category-based organization (6 categories)
  - General
  - Security
  - Notifications
  - Integrations
  - Appearance
  - Advanced
- Dynamic form fields (string, integer, float, boolean, JSON)
- Bulk save (save multiple changes at once)
- Reset to defaults (per config or entire category)
- System config protection (can't delete)
- Required field indicators
- Metadata display (last updated by & when)

**Permissions**: Owners and admins only

### 5. Activity & Audit Logs (Phase 5)
**Route**: `/workspace/activity`

- Timeline view of all admin actions
- Color-coded action types (create/update/delete)
- Advanced filtering:
  - Search by description/entity
  - Filter by action type (11 types)
  - Filter by entity type (4 types)
  - Date range filtering
- CSV export (respects current filters)
- Pagination (20 logs per page)
- Relative time display ("2 hours ago")
- Entity tracking (who did what to which entity)
- IP address logging

**Permissions**: Owners and admins only

### 6. Billing (Placeholder)
**Route**: `/workspace/billing`

- Subscription management (coming soon)
- Payment methods (coming soon)
- Invoices & billing history (coming soon)

**Permissions**: Owners only

### 7. Customizations (Consolidated)
Customizations have been consolidated into **Option Lists** under the "Tenant Overrides" tab.

**Route Redirect**: `/workspace/customizations` → `/workspace/option-lists?tab=overrides`

- UI customization options (coming soon)
- Custom fields (coming soon)
- Workflow templates (coming soon)

**Permissions**: Owners and admins only

## 🔒 Permissions System

### Roles
1. **Owner**: Full access to all admin features
2. **Admin**: Full access except billing and dangerous operations
3. **Member**: No admin access (regular user)
4. **Viewer**: Read-only access (no admin)

### Permission Checks
All admin pages use `useAdminPermissions()` hook to verify:
- User is authenticated
- User has admin/owner role in current tenant
- Tenant is active

## 🎨 Design System

### Color Coding
- **Primary**: Brand colors (purple/blue)
- **Success**: Green (#22c55e) - create, invite actions
- **Warning**: Yellow (#eab308) - warning states
- **Error**: Red (#ef4444) - delete, deactivate actions
- **Info**: Blue (#3b82f6) - update, change actions

### Component Patterns
All admin pages follow consistent patterns:
- Header with title and subtitle
- Action buttons in top-right
- Search and filter controls
- Data tables or cards
- Loading skeletons
- Empty states with CTAs
- Error messages with icons
- Success toasts (auto-dismiss)

## 🧪 Testing

### Manual Testing Checklist
- [ ] All pages load without errors
- [ ] Permission checks prevent unauthorized access
- [ ] Forms validate inputs correctly
- [ ] Success/error messages display
- [ ] Loading states show during API calls
- [ ] Empty states display when no data
- [ ] Search and filters work correctly
- [ ] Pagination works correctly
- [ ] CSV export downloads successfully
- [ ] Mobile responsive on all pages
- [ ] Keyboard navigation works
- [ ] Screen reader announces changes

### Automated Tests
Location: `frontend/src/pages/Admin/__tests__/`

Run tests:
```bash
npm test -- Admin
```

## ♿ Accessibility

### WCAG 2.1 AA Compliance
- ✅ Keyboard navigation for all interactions
- ✅ ARIA labels for screen readers
- ✅ Focus indicators visible
- ✅ Color contrast 4.5:1 minimum
- ✅ Touch targets 44x44px minimum
- ✅ Error messages associated with fields
- ✅ Loading states announced
- ✅ Skip links for keyboard users

### Keyboard Shortcuts
- `Esc`: Close modals/dialogs
- `Enter`: Submit forms, confirm actions
- `Tab`: Navigate between fields
- `Shift+Tab`: Navigate backwards
- `Arrow Keys`: Navigate lists/tables

## 📱 Mobile Responsiveness

All admin pages are optimized for:
- **Desktop**: Full-width tables, multi-column grids
- **Tablet**: 2-column grids, condensed tables
- **Mobile**: Single column, stacked cards, hamburger menus

Breakpoints:
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🚀 Performance

### Optimization Techniques
- React Query for data caching (5-minute stale time)
- Lazy loading for large lists
- Debounced search inputs
- Pagination (20-50 items per page)
- Image optimization for logo uploads
- Code splitting (admin pages separate chunk)

### Bundle Size
- Admin workspace: ~150KB (gzipped)
- Shared components: Reused from main app
- Icons: Tree-shaken from lucide-react

## 🔗 API Endpoints

All endpoints require authentication and tenant filtering.

### Users & Invitations
- `GET /api/v1/tenant-users/` - List tenant users
- `PATCH /api/v1/tenant-users/:id/` - Update tenant user (role, is_active)
- `GET /api/v1/invitations/?status=pending` - List invitations
- `POST /api/v1/invitations/` - Create invitation
- `POST /api/v1/invitations/:id/resend/` - Resend invitation
- `POST /api/v1/invitations/:id/revoke/` - Revoke invitation

### Profile
- `GET /api/v1/tenants/current/` - Get current tenant details
- `PATCH /api/v1/tenants/:id/` - Update tenant (includes branding/logo)

### Option Lists
- `GET /api/v1/system/choice-lists/` - List all choice lists
- `GET /api/v1/system/choice-lists/:slug/items/` - List items (system + tenant)
- `POST /api/v1/system/choice-lists/:slug/items/` - Add tenant custom item
- `GET /api/v1/system/tenant-overrides/?choice_list=:id` - Read tenant override
- `POST /api/v1/system/tenant-overrides/` - Create tenant override
- `PATCH /api/v1/system/tenant-overrides/:id/` - Update tenant override

### Configurations
- `GET /api/v1/configurations/` - List tenant configurations
- `POST /api/v1/configurations/bulk_update/` - Bulk update
- `POST /api/v1/configurations/reset_category/` - Reset category

### Activity Logs
- `GET /api/v1/activity-logs/` - List logs
- `GET /api/v1/activity-logs/export/` - Export CSV

## 🐛 Troubleshooting

### Common Issues

**"Permission denied" error**
- Ensure user has admin/owner role
- Check tenant is active
- Verify token is valid

**Pages not loading**
- Check browser console for errors
- Verify API endpoints are accessible
- Clear browser cache and reload

**CSV export not working**
- Check browser allows downloads
- Verify export endpoint returns data
- Try with fewer filters

**Forms not submitting**
- Check for validation errors (red borders)
- Verify all required fields filled
- Check network tab for API errors

## 📚 Documentation

- **User Guide**: `/docs/USER_GUIDE.md`
- **API Docs**: `/docs/API_REFERENCE.md`
- **Architecture**: `/docs/ARCHITECTURE.md`
- **Design System**: `/docs/DESIGN_SYSTEM.md`

## 🎓 Development

### Adding a New Admin Page

1. Create page component in `frontend/src/pages/Admin/NewPage/`
2. Import and add route in `App.tsx`
3. Wrap with `AdminErrorBoundary`
4. Add permission checks with `useAdminPermissions()`
5. Follow design patterns from existing pages
6. Add tests in `__tests__/` directory
7. Update this README

### Code Style
- Use functional components with hooks
- TypeScript strict mode
- Styled-components for styling
- React Query for data fetching
- Follow existing patterns

## 🔄 Change Log

### Phase 1 (Users & Invitations) - PR #2727
- Initial admin workspace structure
- User management with CRUD operations
- Invitation system
- Activity logging

### Phase 2 (Profile & Branding) - PR #2728
- Organization profile editor
- Logo upload
- Theme customization
- Live preview

### Phase 3 (Option Lists) - PR #2731
- Choice list management
- CRUD operations
- Usage indicators

### Phase 4 (Configurations) - PR #2756
- Configuration system
- Category organization
- Bulk operations
- Reset functionality

### Phase 5 (Activity & Audit Logs) - PR #2757
- Timeline visualization
- Advanced filtering
- CSV export

### Phase 6 (Polish & Testing) - PR #TBD
- Error boundaries
- Accessibility improvements
- Mobile optimization
- Documentation

## 📧 Support

For issues or questions:
- GitHub Issues: https://github.com/Meats-Central/ProjectMeats/issues
- Email: support@meatscentral.com
- Slack: #admin-workspace

---

**Last Updated**: 2026-02-09
**Version**: 1.0.0
**Maintainers**: Frontend Team
