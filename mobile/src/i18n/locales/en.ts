/**
 * English (default) locale strings for the ProjectMeats mobile app.
 *
 * Dynamic strings (those requiring runtime interpolation) are represented as
 * typed arrow functions rather than i18next-style `{{variable}}` templates,
 * because the mobile app does not bundle the full i18next runtime.  Call them
 * directly: `t.home.welcome(user.name)` instead of `t('home.welcome', { name })`.
 */
export const en = {
  login: {
    title: 'ProjectMeats',
    subtitle: 'Multi-Tenant Platform',
    username: 'Username or Email',
    password: 'Password',
    signIn: 'Sign In',
    signingIn: 'Signing In...',
    loginFailed: 'Login Failed',
    fillFields: 'Please fill in all fields',
    invalidCredentials: 'Invalid credentials',
  },
  home: {
    dashboard: 'Dashboard',
    quickActions: 'Quick Actions',
    loadingDashboard: 'Loading dashboard...',
    logout: 'Logout',
    logoutConfirm: 'Are you sure you want to logout?',
    switchOrg: 'Switch Organization',
    switchConfirm: 'Do you want to switch to a different organization?',
    switchBtn: 'Switch',
    cancel: 'Cancel',
    comingSoon: 'Coming Soon',
    featureSoon: 'This feature will be available soon.',
    nextUpdate: (entity: string) =>
      `${entity} management will be available in the next update.`,
    createOrder: 'Create Order',
    viewReports: 'View Reports',
    aiAssistant: 'AI Assistant',
    customers: 'Customers',
    suppliers: 'Suppliers',
    contacts: 'Contacts',
    plants: 'Plants',
    carriers: 'Carriers',
    welcome: (name: string) => `Welcome, ${name}`,
    trialAccount: 'TRIAL ACCOUNT',
  },
} as const;

export type MobileTranslations = typeof en;
