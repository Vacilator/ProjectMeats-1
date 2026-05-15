/**
 * Main App Component
 *
 * Meats Central React Application
 * Full Business Management System with AI Assistant
 */
import React, { Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Skeleton } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { AIInboxSyncProvider } from './contexts/AIInboxSyncContext';
import { ImplicitFeedbackProvider } from './contexts/ImplicitFeedbackProvider';
import { NavigationProvider } from './contexts/NavigationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QuickActionsProvider } from './contexts/QuickActionsContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ActionItemsProvider } from './contexts/ActionItemsContext';
import { SessionManagerProvider } from './contexts/SessionManagerContext';
import { CockpitNavigationProvider } from './contexts/CockpitNavigationContext';
import { CockpitPinnedToolsProvider } from './contexts/CockpitPinnedToolsContext';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout/Layout';
import { OnboardingProvider } from './components/Onboarding';
import './i18n/config'; // Initialize i18n
// canonicalSearch utilities kept available for Header; App.tsx no longer uses them directly
import LegacyCommandCenterTabRedirect from './routes/LegacyCommandCenterTabRedirect';

// MyTasksRedirect removed — /my-tasks renders directly, no workforms dependency

// Cockpit routes removed — all cockpit paths redirect to Home

// Create QueryClient for data fetching (React Query)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      // IMPORTANT: Refetch on mount to ensure tenant context is correct
      // This prevents stale cached data from previous tenant after hard refresh
      refetchOnMount: 'always',
    },
  },
});
// Non-lazy imports (auth, layout, utilities)
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import { FormSubmissionModal } from './components/FormSubmission';
import { useQuickActions } from './contexts/QuickActionsContext';
import AdminErrorBoundary from './components/Admin/AdminErrorBoundary';
import { ErrorBoundary as ProductionErrorBoundary } from './components/common/ErrorBoundary';
import { logger } from './utils/logger';
import { lazyWithChunkRecovery } from './utils/chunkLoadRecovery';
import { getValidTenantId } from './utils/tenantId';
import RequireAuth from './components/Auth/RequireAuth';
import NotFoundPage from './pages/NotFound';

// Lazy-loaded page components (code-splitting)
const Suppliers = React.lazy(() => import('./pages/Suppliers'));
const Customers = React.lazy(() => import('./pages/Customers'));
const UniversalEntityRecordPage = React.lazy(() => import('./pages/Entities/UniversalEntityRecordPage'));
const UniversalEntityRecordRoute = React.lazy(() => import('./pages/Entities/UniversalEntityRecordRoute'));
const PurchaseOrders = React.lazy(() => import('./pages/PurchaseOrders'));
const PurchaseOrderReview = React.lazy(() => import('./pages/PurchaseOrderReview'));
const SalesOrders = React.lazy(() => import('./pages/SalesOrders'));
const AccountsReceivables = React.lazy(() => import('./pages/AccountsReceivables'));
const Payables = React.lazy(() => import('./pages/Payables'));
const ColdStorage = React.lazy(() => import('./pages/ColdStorage'));
const Contacts = React.lazy(() => import('./pages/Contacts'));
const Plants = React.lazy(() => import('./pages/Suppliers/Plants'));
const Home = React.lazy(() => import('./pages/Home'));
const SupplierProducts = React.lazy(() => import('./pages/Suppliers/Products'));
const CustomerLocations = React.lazy(() => import('./pages/Customers/Locations'));
const CustomerProducts = React.lazy(() => import('./pages/Customers/Products'));
const PlantProducts = React.lazy(() => import('./pages/Plants/Products'));
const PlantDetailView = React.lazy(() => import('./pages/Plants/PlantDetailView'));
const StandalonePlantEditRoute = React.lazy(() => import('./pages/Plants/StandalonePlantEditRoute'));
const LocationDetailView = React.lazy(() => import('./pages/Locations/LocationDetailView'));
const SupplierPlantDetail = React.lazy(() => import('./pages/Suppliers/PlantDetail'));
const SupplierPlantContactDetail = React.lazy(() => import('./pages/Suppliers/PlantContactDetail'));
const CustomerLocationDetail = React.lazy(() => import('./pages/Customers/LocationDetail'));
const CustomerLocationContactDetail = React.lazy(() => import('./pages/Customers/LocationContactDetail'));
const Carriers = React.lazy(() => import('./pages/Carriers'));
const AIAssistant = React.lazy(() => import('./pages/AIAssistant'));
const CallLog = React.lazy(() => import('./pages/Cockpit/CallLog'));
const Claims = React.lazy(() => import('./pages/Accounting/Claims'));
const PayablePOs = React.lazy(() => import('./pages/Accounting/PayablePOs'));
const ReceivableSOs = React.lazy(() => import('./pages/Accounting/ReceivableSOs'));
const Invoices = React.lazy(() => import('./pages/Accounting/Invoices'));
const SettlementQueue = React.lazy(() => import('./pages/Accounting/SettlementQueue'));
const FreightOrders = React.lazy(() => import('./pages/FreightOrders'));
const DealDesk = React.lazy(() => import('./pages/Deals/DealDesk'));
const Reports = React.lazy(() => import('./pages/Reports'));
const Profile = React.lazy(() => import('./pages/Profile'));
const Settings = React.lazy(() => import('./pages/Settings'));
const AISettingsPage = React.lazy(() => import('./pages/AISettings'));
const AIChatPage = React.lazy(() => import('./pages/AIChatPage'));
const MyAIPage = React.lazy(() => import('./pages/MyAI'));
const GuestInvoiceView = React.lazy(() => import('./pages/Portal/GuestInvoiceView'));
const ApiTestComponent = React.lazy(() => import('./components/ApiTestComponent'));
const WorkflowRunner = React.lazy(() => import('./pages/Workflows').then(m => ({ default: m.WorkflowRunner })));
const PerfHarness = React.lazy(() => import('./pages/Workflows').then(m => ({ default: m.PerfHarness })));
const WorkflowMonitor = React.lazy(() => import('./pages/Workflows/WorkflowMonitor').then(m => ({ default: m.WorkflowMonitor })));
const WorkflowExecutionDetails = React.lazy(() => import('./pages/Workflows/WorkflowExecutionDetails').then(m => ({ default: m.WorkflowExecutionDetails })));
const AIAgentWidgetSocketSmoke = React.lazy(() => import('./pages/Diagnostics/AIAgentWidgetSocketSmoke'));
const EntityFormSurfaceSmoke = React.lazy(() => import('./pages/Diagnostics/EntityFormSurfaceSmoke'));
const OperationalStatusReplaySmoke = React.lazy(() => import('./pages/Diagnostics/OperationalStatusReplaySmoke'));
const MySubmissions = React.lazy(() => import('./pages/MySubmissions'));
const MyTasks = React.lazy(() => import('./pages/MyTasks'));
const MyTrades = React.lazy(() => import('./pages/MyTrades'));
const Inquiries = React.lazy(() => import('./pages/Inquiries'));
const Fulfillments = React.lazy(() => import('./pages/Fulfillments'));
const InquiryTemplates = React.lazy(() => import('./pages/InquiryTemplates'));
const InquiryAnalytics = React.lazy(() => import('./pages/InquiryAnalytics'));
const OptionListsPage = React.lazy(() => import('./pages/Admin/OptionLists'));
const ConfigurationsPage = React.lazy(() => import('./pages/Admin/Configurations'));
const UsersPage = React.lazy(() => import('./pages/Admin/Users'));
const AdminProfilePage = React.lazy(() => import('./pages/Admin/Profile'));
const BillingPage = React.lazy(() => import('./pages/Admin/Billing'));
const ActivityPage = React.lazy(() => import('./pages/Admin/Activity'));
const AdminWorkspaceHome = React.lazy(() => import('./pages/Admin/Home'));
// WorkForms pages - Phase 1 Enhancement (renamed from Forms & Flows)
const WorkFormsLayout = React.lazy(() => import('./pages/WorkForms'));
const WorkFormsCatalog = React.lazy(() => import('./pages/WorkForms/Catalog'));
const WorkFormsInProgress = React.lazy(() => import('./pages/WorkForms/InProgress'));
const WorkFormsHistory = React.lazy(() => import('./pages/WorkForms/History'));
const ExecuteWorkForm = React.lazy(() => import('./pages/WorkForms/Execute'));
const WorkFormExecutionDetails = React.lazy(() => import('./pages/WorkForms/ExecutionDetails'));
const WorkFormsEditor = lazyWithChunkRecovery(
  () => import('./pages/WorkForms/Editor'),
  'App.WorkFormsEditor'
);
import WorkFormsMonitoring from './pages/WorkForms/Monitoring';

// Wrapper component to access QuickActions context
const FormSubmissionWrapper: React.FC = () => {
  const { activeSubmission, isFormModalOpen, closeFormModal } = useQuickActions();

  // Always render if we have a submission and modal is open
  if (!activeSubmission || !isFormModalOpen) {
    return null;
  }

  // Use key to force remount when submission changes
  return (
    <FormSubmissionModal
      key={activeSubmission.id}
      submission={activeSubmission}
      isOpen={true}
      onClose={closeFormModal}
    />
  );
};

const App: React.FC = () => {
  const enableEntityFormSmokeRoute = import.meta.env.VITE_ENABLE_E2E_SMOKE === '1';

  useEffect(() => {
    const currentTenantId = getValidTenantId();

    if (currentTenantId) {
      sessionStorage.setItem('currentTenantId', currentTenantId);
    } else {
      sessionStorage.removeItem('currentTenantId');
    }
  }, []);

  // Dynamic favicon and title based on environment
  useEffect(() => {
    const updateFaviconAndTitle = () => {
      // Get environment from runtime config (set by deployment pipeline)
      // Falls back to build-time env or 'development' for local dev
      const environment =
        window.ENV?.ENVIRONMENT ||
        (typeof import.meta !== 'undefined' ? import.meta.env?.MODE : undefined) ||
        (typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined) ||
        'development';

      // Normalize environment string
      const env = environment.toLowerCase();

      // Select favicon and title prefix based on environment
      let faviconPath = '/favicon-prod.svg'; // Production (red MC)
      let titlePrefix = '';

      if (env === 'development' || env === 'dev') {
        faviconPath = '/favicon-dev.svg'; // Green DEV (SVG)
        titlePrefix = '[DEV] ';
      } else if (env === 'uat' || env === 'staging') {
        faviconPath = '/favicon-uat.svg'; // Yellow UAT (SVG)
        titlePrefix = '[UAT] ';
      }

      // Update favicon
      let faviconLink = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!faviconLink) {
        // Create favicon link if it doesn't exist
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = faviconPath;

      // Update page title with environment prefix
      const baseTitle = 'Meats Central';
      if (!document.title.startsWith('[')) {
        document.title = titlePrefix + baseTitle;
      }

      // Log for debugging (only in development)
      if (env === 'development' || env === 'dev') {
        logger.debug(`[Environment] ${env} - Favicon: ${faviconPath}`, { component: 'App' });
      }
    };

    updateFaviconAndTitle();
  }, []); // Run once on mount

  return (
    <ProductionErrorBoundary
      onError={(error, errorInfo) => {
        // Log to our centralized logger
        logger.error('App-level error caught', {
          component: 'App',
          metadata: {
            componentStack: errorInfo.componentStack
          }
        }, {
          message: error.message,
          stack: error.stack
        });
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <OnboardingProvider>
              <ThemeProvider>
                <NotificationsProvider>
                  <ActionItemsProvider>
                    <AIInboxSyncProvider>
                      <ImplicitFeedbackProvider>
                      <QuickActionsProvider>
                        <CockpitNavigationProvider>
                          <CockpitPinnedToolsProvider>
                            <Router>
                            <SessionManagerProvider>
                              <NavigationProvider>
                    <Suspense fallback={<Skeleton active />}>
                    <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
                <Route
                  path="/portal/tenants/:tenantId/grants/:grantId"
                  element={<GuestInvoiceView />}
                />
                {enableEntityFormSmokeRoute && (
                  <Route
                    path="/diagnostics/ai-widget-websocket-smoke"
                    element={<AIAgentWidgetSocketSmoke />}
                  />
                )}
                {enableEntityFormSmokeRoute && (
                  <Route
                    path="/diagnostics/entity-form-surface-smoke"
                    element={<EntityFormSurfaceSmoke />}
                  />
                )}
                {enableEntityFormSmokeRoute && (
                  <Route
                    path="/diagnostics/operational-status-replay-smoke"
                    element={<OperationalStatusReplaySmoke />}
                  />
                )}
              <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
                <Route index element={<Home />} />

                {/* Canonical record destination */}
                <Route path="records/:entityType/:id" element={<UniversalEntityRecordRoute />} />
                <Route path="records/:entityType/:id/edit" element={<UniversalEntityRecordRoute mode="edit" />} />

                {/* Suppliers & Related */}
                <Route path="suppliers" element={<Suppliers />} />
                <Route
                  path="suppliers/new"
                  element={<UniversalEntityRecordPage entityType="supplier" basePath="/suppliers" mode="create" />}
                />
                <Route
                  path="suppliers/:id/edit"
                  element={<UniversalEntityRecordPage entityType="supplier" basePath="/suppliers" mode="edit" />}
                />
                <Route
                  path="suppliers/:id"
                  element={<UniversalEntityRecordPage entityType="supplier" basePath="/suppliers" mode="view" />}
                />
                <Route path="suppliers/contacts" element={<Contacts />} />
                <Route path="suppliers/:supplierId/contacts" element={<Contacts />} />
                <Route path="suppliers/plants" element={<Plants />} />
                <Route path="suppliers/:supplierId/plants" element={<Plants />} />
                <Route path="suppliers/:supplierId/plants/:plantId" element={<SupplierPlantDetail />} />
                <Route
                  path="suppliers/:supplierId/plants/:plantId/contacts/:contactId"
                  element={<SupplierPlantContactDetail />}
                />
                <Route path="suppliers/:id/products" element={<SupplierProducts />} />
                <Route path="plants/:id" element={<PlantDetailView />} />
                <Route
                  path="plants/:id/edit"
                  element={<StandalonePlantEditRoute />}
                />
                <Route path="plants/:id/products" element={<PlantProducts />} />
                <Route path="locations/:id" element={<LocationDetailView />} />

                {/* Customers & Related */}
                <Route path="customers" element={<Customers />} />
                <Route
                  path="customers/new"
                  element={<UniversalEntityRecordPage entityType="customer" basePath="/customers" mode="create" />}
                />
                <Route
                  path="customers/:id/edit"
                  element={<UniversalEntityRecordPage entityType="customer" basePath="/customers" mode="edit" />}
                />
                <Route
                  path="customers/:id"
                  element={<UniversalEntityRecordPage entityType="customer" basePath="/customers" mode="view" />}
                />
                <Route path="customers/contacts" element={<Contacts />} />
                <Route path="customers/:customerId/contacts" element={<Contacts />} />
                <Route path="customers/locations" element={<CustomerLocations />} />
                <Route path="customers/:customerId/locations" element={<CustomerLocations />} />
                <Route path="customers/:customerId/locations/:locationId" element={<CustomerLocationDetail />} />
                <Route
                  path="customers/:customerId/locations/:locationId/contacts/:contactId"
                  element={<CustomerLocationContactDetail />}
                />
                <Route path="customers/:id/products" element={<CustomerProducts />} />

                {/* Orders */}
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="purchase-orders/:id/review" element={<PurchaseOrderReview />} />
                <Route path="purchase-orders/attachments" element={<Navigate to="/purchase-orders" replace />} />
                <Route path="sales-orders" element={<SalesOrders />} />
                <Route path="sales-orders/attachments" element={<Navigate to="/sales-orders" replace />} />
                <Route path="deals" element={<DealDesk />} />

                {/* Accounting */}
                <Route path="accounts-receivables" element={<AccountsReceivables />} />
                <Route path="accounting/claims" element={<Claims />} />
                <Route path="accounting/receivables/claims" element={<Claims />} />
                <Route path="accounting/payables/claims" element={<Claims />} />
                <Route path="accounting/receivables/sos" element={<ReceivableSOs />} />
                <Route path="accounting/receivables/invoices" element={<Invoices />} />
                <Route path="accounting/payables" element={<Payables />} />
                <Route path="accounting/payables/pos" element={<PayablePOs />} />
                <Route path="accounting/settlements" element={<SettlementQueue />} />

                {/* Legacy command-center redirects to Home */}
                <Route path="command-center" element={<Navigate to="/" replace />} />

                {/* Other Pages */}
                <Route
                  path="trader-cockpit/*"
                  element={<Navigate to="/" replace />}
                />
                <Route path="cold-storage" element={<ColdStorage />} />
                <Route path="carriers" element={<Carriers />} />
                <Route path="freight-orders" element={<FreightOrders />} />
                <Route path="contacts" element={<Contacts />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="calls" element={<CallLog />} />
                <Route path="call-log" element={<Navigate to="/calls" replace />} />
                <Route path="processes" element={<Navigate to="/workforms/catalog" replace />} />
                <Route path="reports" element={<Reports />} />
                <Route
                  path="activity/*"
                  element={<LegacyCommandCenterTabRedirect tab="action-required" />}
                />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings/ai" element={<Navigate to="/workspace/my-ai?tab=preferences" replace />} />
                <Route path="ai-chat" element={<Navigate to="/workspace/my-ai?tab=sessions" replace />} />
                <Route path="settings/email-integrations" element={<Navigate to="/settings?tab=integrations" replace />} />
                <Route path="settings/notifications" element={<Navigate to="/settings?tab=notifications" replace />} />
                <Route path="api-test" element={<ApiTestComponent />} />

                {/* Inquiries & Fulfillments */}
                <Route path="inquiries" element={<Inquiries />} />
                <Route path="inquiries/templates" element={<InquiryTemplates />} />
                <Route path="inquiries/analytics" element={<InquiryAnalytics />} />
                <Route path="fulfillments" element={<Fulfillments />} />

                {/* WorkForms (consolidated forms + workflows) */}
                <Route path="workforms" element={<WorkFormsLayout />}>
                  <Route index element={<Navigate to="/workforms/catalog" replace />} />
                  <Route path="tasks" element={<MyTasks />} />
                  <Route path="in-progress" element={<WorkFormsInProgress />} />
                  <Route path="in-progress/:id" element={<WorkFormsInProgress />} />
                  <Route path="monitoring" element={<WorkFormsMonitoring />} />
                  <Route path="catalog" element={<WorkFormsCatalog />} />
                  <Route path="history" element={<WorkFormsHistory />} />
                  <Route path="execute/:id" element={<ExecuteWorkForm />} />
                  <Route path="executions/:id" element={<WorkFormExecutionDetails />} />
                  <Route
                    path="editor"
                    element={
                      <Suspense fallback={<Skeleton active />}>
                        <WorkFormsEditor />
                      </Suspense>
                    }
                  />
                  <Route
                    path="editor/:id"
                    element={
                      <Suspense fallback={<Skeleton active />}>
                        <WorkFormsEditor />
                      </Suspense>
                    }
                  />
                </Route>

                {/* Legacy routes - redirect to WorkForms */}
                <Route path="forms-flows/*" element={<Navigate to="/workforms" replace />} />
                <Route path="workflows" element={<Navigate to="/workforms/catalog" replace />} />
                <Route path="workflows/monitor" element={<WorkflowMonitor />} />
                <Route path="workflows/run/:runId" element={<WorkflowRunner />} />
                <Route path="workflows/details/:runId" element={<WorkflowExecutionDetails />} />
                <Route
                  path="workflows/perf-harness"
                  element={
                    (import.meta.env.DEV || process.env.NODE_ENV === 'development')
                      ? <PerfHarness />
                      : <Navigate to="/workforms/catalog" replace />
                  }
                />

                {/* Form Submissions */}
                <Route path="my-submissions" element={<MySubmissions />} />
                <Route path="my-tasks" element={<MyTasks />} />
                <Route path="my-trades" element={<MyTrades />} />

                {/* Admin Workspace - Wrapped with error boundary */}
                <Route path="workspace" element={
                  <AdminErrorBoundary fallbackTitle="Admin Workspace Error">
                    <AdminWorkspaceHome />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/option-lists" element={
                  <AdminErrorBoundary fallbackTitle="Option Lists Error">
                    <OptionListsPage />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/configurations" element={
                  <AdminErrorBoundary fallbackTitle="Configurations Error">
                    <ConfigurationsPage />
                  </AdminErrorBoundary>
                } />
                <Route
                  path="workspace/customizations"
                  element={<Navigate to="/workspace/option-lists?tab=overrides" replace />}
                />
                <Route path="workspace/users" element={
                  <AdminErrorBoundary fallbackTitle="Users Management Error">
                    <UsersPage />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/profile" element={
                  <AdminErrorBoundary fallbackTitle="Profile Settings Error">
                    <AdminProfilePage />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/billing" element={
                  <AdminErrorBoundary fallbackTitle="Billing Error">
                    <BillingPage />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/activity" element={
                  <AdminErrorBoundary fallbackTitle="Activity Logs Error">
                    <ActivityPage />
                  </AdminErrorBoundary>
                } />
                <Route path="workspace/my-ai" element={
                  <AdminErrorBoundary fallbackTitle="My AI Error">
                    <MyAIPage />
                  </AdminErrorBoundary>
                } />

                <Route
                  path="process-cockpit/*"
                  element={<LegacyCommandCenterTabRedirect tab="action-required" />}
                />
                <Route
                  path="cockpit/interventions/*"
                  element={<LegacyCommandCenterTabRedirect tab="action-required" />}
                />

                {/* Backward compatibility redirect */}
                <Route path="admin/*" element={<Navigate to={`/workspace/${window.location.pathname.replace('/admin/', '')}`} replace />} />

                {/* Cockpit — legacy routes redirect to new locations */}
                <Route path="cockpit" element={<Navigate to="/" replace />} />
                <Route path="cockpit/dashboard" element={<Navigate to="/" replace />} />
                <Route path="cockpit/process-monitor/*" element={<Navigate to="/" replace />} />
                <Route path="cockpit/calls" element={<Navigate to="/calls" replace />} />
                <Route path="cockpit/entity/:entityType/:entityId" element={<Navigate to="/" replace />} />
                {/* Note: /workspace now points to Admin Workspace, not Cockpit */}

                {/* 404 catch-all */}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
                    </Suspense>
            {/* Form Submission Modal - rendered at app level */}
            <FormSubmissionWrapper />
                              </NavigationProvider>
                            </SessionManagerProvider>
                          </Router>
                        </CockpitPinnedToolsProvider>
                      </CockpitNavigationProvider>
                    </QuickActionsProvider>
                      </ImplicitFeedbackProvider>
                  </AIInboxSyncProvider>
                </ActionItemsProvider>
              </NotificationsProvider>
            </ThemeProvider>
          </OnboardingProvider>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
    </ProductionErrorBoundary>
  );
};

export default App;
