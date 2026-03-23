/**
 * Spanish locale strings for the ProjectMeats mobile app.
 */
import type { MobileTranslations } from './en';

export const es: MobileTranslations = {
  login: {
    title: 'ProjectMeats',
    subtitle: 'Plataforma Multi-Inquilino',
    username: 'Usuario o Correo',
    password: 'Contraseña',
    signIn: 'Iniciar Sesión',
    signingIn: 'Iniciando sesión...',
    loginFailed: 'Error de inicio de sesión',
    fillFields: 'Por favor complete todos los campos',
    invalidCredentials: 'Credenciales inválidas',
  },
  home: {
    dashboard: 'Panel de Control',
    quickActions: 'Acciones Rápidas',
    loadingDashboard: 'Cargando panel...',
    logout: 'Cerrar Sesión',
    logoutConfirm: '¿Está seguro de que desea cerrar sesión?',
    switchOrg: 'Cambiar Organización',
    switchConfirm: '¿Desea cambiar a una organización diferente?',
    switchBtn: 'Cambiar',
    cancel: 'Cancelar',
    comingSoon: 'Próximamente',
    featureSoon: 'Esta función estará disponible pronto.',
    nextUpdate: (entity: string) =>
      `La gestión de ${entity} estará disponible en la próxima actualización.`,
    createOrder: 'Crear Pedido',
    viewReports: 'Ver Informes',
    aiAssistant: 'Asistente IA',
    customers: 'Clientes',
    suppliers: 'Proveedores',
    contacts: 'Contactos',
    plants: 'Plantas',
    carriers: 'Transportistas',
    welcome: (name: string) => `Bienvenido, ${name}`,
    trialAccount: 'CUENTA DE PRUEBA',
  },
};
