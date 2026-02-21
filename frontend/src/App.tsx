/**
 * Main App Component
 *
 * ProjectMeats3 React Application
 * Full Business Management System with AI Assistant
 */
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationProvider } from './contexts/NavigationContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { QuickActionsProvider } from './contexts/QuickActionsContext';
import { NotificationsProvider } from './contexts/NotificationsContext';
import { ActionItemsProvider } from './contexts/ActionItemsContext';
import { ToastProvider } from './hooks/useToast';
import Layout from './components/Layout/Layout';

// Create QueryClient for data fetching (React Query)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
// Page imports - Note: Dashboard replaced by Workspace, WorkflowList replaced by FormsFlows/Catalog
import Suppliers from './pages/Suppliers';
import Customers from './pages/Customers';
import PurchaseOrders from './pages/PurchaseOrders';
import SalesOrders from './pages/SalesOrders';
import AccountsReceivables from './pages/AccountsReceivables';
import Payables from './pages/Payables';
import ColdStorage from './pages/ColdStorage';
import Contacts from './pages/Contacts';
import Plants from './pages/Suppliers/Plants';
import SupplierProducts from './pages/Suppliers/Products';
import CustomerLocations from './pages/Customers/Locations';
import CustomerProducts from './pages/Customers/Products';
import Carriers from './pages/Carriers';
import AIAssistant from './pages/AIAssistant';
import CallLog from './pages/Cockpit/CallLog';
import Claims from './pages/Accounting/Claims';
import PayablePOs from './pages/Accounting/PayablePOs';
import ReceivableSOs from './pages/Accounting/ReceivableSOs';
import Invoices from './pages/Accounting/Invoices';
import Reports from './pages/Reports';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import { ComingSoon } from './pages/ComingSoon';
import ApiTestComponent from './components/ApiTestComponent';
import { WorkflowRunner } from './pages/Workflows';
import { WorkflowMonitor } from './pages/Workflows/WorkflowMonitor';
import { WorkflowExecutionDetails } from './pages/Workflows/WorkflowExecutionDetails';
import { FormSubmissionModal } from './components/FormSubmission';
import { useQuickActions } from './contexts/QuickActionsContext';
import MySubmissions from './pages/MySubmissions';
import MyTasks from './pages/MyTasks';
import Inquiries from './pages/Inquiries';
import Fulfillments from './pages/Fulfillments';
import InquiryTemplates from './pages/InquiryTemplates';
import InquiryAnalytics from './pages/InquiryAnalytics';
import OptionListsPage from './pages/Admin/OptionLists';
import ConfigurationsPage from './pages/Admin/Configurations';
import CustomizationsPage from './pages/Admin/Customizations';
import UsersPage from './pages/Admin/Users';
import AdminProfilePage from './pages/Admin/Profile';
import BillingPage from './pages/Admin/Billing';
import ActivityPage from './pages/Admin/Activity';
import AdminErrorBoundary from './components/Admin/AdminErrorBoundary';
import ErrorBoundary from './components/ErrorBoundary';
import { ReportBugButton } from './components/ReportBugButton';
import CockpitPage from './pages/Cockpit';
import { NotificationPreferences } from './pages/Settings/index';
// WorkForms pages - Phase 1 Enhancement (renamed from Forms & Flows)
import WorkFormsLayout from './pages/WorkForms';
import WorkFormsCatalog from './pages/WorkForms/Catalog';
import WorkFormsInProgress from './pages/WorkForms/InProgress';
import WorkFormsHistory from './pages/WorkForms/History';
import WorkFormsEditor from './pages/WorkForms/Editor';

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
        console.log(`[Environment] ${env} - Favicon: ${faviconPath}`);
      }
    };

    updateFaviconAndTitle();
  }, []); // Run once on mount

  return (
    <ErrorBoundary showDetails={false}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <ThemeProvider>
              <NotificationsProvider>
                <ActionItemsProvider>
                  <QuickActionsProvider>
                <Router
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <NavigationProvider>
                    <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<SignUp />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/cockpit" replace />} />
                
                {/* Suppliers & Related */}
                <Route path="suppliers" element={<Suppliers />} />
                <Route path="suppliers/contacts" element={<Contacts />} />
                <Route path="suppliers/plants" element={<Plants />} />
                <Route path="suppliers/:id/products" element={<SupplierProducts />} />
                
                {/* Customers & Related */}
                <Route path="customers" element={<Customers />} />
                <Route path="customers/contacts" element={<Contacts />} />
                <Route path="customers/locations" element={<CustomerLocations />} />
                <Route path="customers/:id/products" element={<CustomerProducts />} />
                
                {/* Orders */}
                <Route path="purchase-orders" element={<PurchaseOrders />} />
                <Route path="purchase-orders/attachments" element={<ComingSoon title="Purchase Order Attachments" description="View and manage attachments for purchase orders." />} />
                <Route path="sales-orders" element={<SalesOrders />} />
                <Route path="sales-orders/attachments" element={<ComingSoon title="Sales Order Attachments" description="View and manage attachments for sales orders." />} />
                
                {/* Accounting */}
                <Route path="accounts-receivables" element={<AccountsReceivables />} />
                <Route path="accounting/claims" element={<Claims />} />
                <Route path="accounting/receivables/claims" element={<Claims />} />
                <Route path="accounting/payables/claims" element={<Claims />} />
                <Route path="accounting/receivables/sos" element={<ReceivableSOs />} />
                <Route path="accounting/receivables/invoices" element={<Invoices />} />
                <Route path="accounting/payables" element={<Payables />} />
                <Route path="accounting/payables/pos" element={<PayablePOs />} />
                
                {/* Other Pages */}
                <Route path="cold-storage" element={<ColdStorage />} />
                <Route path="carriers" element={<Carriers />} />
                <Route path="contacts" element={<Contacts />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="calls" element={<CallLog />} />
                <Route path="call-log" element={<Navigate to="/calls" replace />} />
                <Route path="processes" element={<Navigate to="/forms-flows/catalog" replace />} />
                <Route path="reports" element={<Reports />} />
                <Route path="profile" element={<Profile />} />
                <Route path="settings" element={<Settings />} />
                <Route path="settings/notifications" element={<NotificationPreferences />} />
                <Route path="api-test" element={<ApiTestComponent />} />
                
                {/* Inquiries & Fulfillments */}
                <Route path="inquiries" element={<Inquiries />} />
                <Route path="inquiries/templates" element={<InquiryTemplates />} />
                <Route path="inquiries/analytics" element={<InquiryAnalytics />} />
                <Route path="fulfillments" element={<Fulfillments />} />
                
                {/* WorkForms (consolidated forms + workflows) */}
                <Route path="workforms" element={<WorkFormsLayout />}>
                  <Route index element={<Navigate to="/workforms/tasks" replace />} />
                  <Route path="tasks" element={<MyTasks />} />
                  <Route path="in-progress" element={<WorkFormsInProgress />} />
                  <Route path="catalog" element={<WorkFormsCatalog />} />
                  <Route path="history" element={<WorkFormsHistory />} />
                  <Route path="editor" element={<WorkFormsEditor />} />
                  <Route path="editor/:id" element={<WorkFormsEditor />} />
                </Route>
                
                {/* Legacy routes - redirect to WorkForms */}
                <Route path="forms-flows/*" element={<Navigate to="/workforms" replace />} />
                <Route path="workflows" element={<Navigate to="/workforms/catalog" replace />} />
                <Route path="workflows/monitor" element={<WorkflowMonitor />} />
                <Route path="workflows/run/:runId" element={<WorkflowRunner />} />
                <Route path="workflows/details/:runId" element={<WorkflowExecutionDetails />} />
                
                {/* Form Submissions */}
                <Route path="my-submissions" element={<MySubmissions />} />
                <Route path="my-tasks" element={<Navigate to="/workforms/tasks" replace />} />
                
                {/* Admin Workspace - Wrapped with error boundary */}
                <Route path="admin/option-lists" element={
                  <AdminErrorBoundary fallbackTitle="Option Lists Error">
                    <OptionListsPage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/configurations" element={
                  <AdminErrorBoundary fallbackTitle="Configurations Error">
                    <ConfigurationsPage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/customizations" element={
                  <AdminErrorBoundary fallbackTitle="Customizations Error">
                    <CustomizationsPage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/users" element={
                  <AdminErrorBoundary fallbackTitle="Users Management Error">
                    <UsersPage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/profile" element={
                  <AdminErrorBoundary fallbackTitle="Profile Settings Error">
                    <AdminProfilePage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/billing" element={
                  <AdminErrorBoundary fallbackTitle="Billing Error">
                    <BillingPage />
                  </AdminErrorBoundary>
                } />
                <Route path="admin/activity" element={
                  <AdminErrorBoundary fallbackTitle="Activity Logs Error">
                    <ActivityPage />
                  </AdminErrorBoundary>
                } />
                
                {/* Cockpit (Command Center Dashboard) */}
                <Route path="cockpit" element={<CockpitPage />} />
                <Route path="workspace" element={<Navigate to="/cockpit" replace />} />
              </Route>
            </Routes>
            {/* Form Submission Modal - rendered at app level */}
            <FormSubmissionWrapper />
            
            {/* Global floating bug report button - always available */}
            <ReportBugButton variant="floating" />
          </NavigationProvider>
        </Router>
              </QuickActionsProvider>
            </ActionItemsProvider>
          </NotificationsProvider>
        </ThemeProvider>
      </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
