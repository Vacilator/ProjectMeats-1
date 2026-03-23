/**
 * French locale strings for the ProjectMeats mobile app.
 */
import type { MobileTranslations } from './en';

export const fr: MobileTranslations = {
  login: {
    title: 'ProjectMeats',
    subtitle: 'Plateforme Multi-Locataire',
    username: "Nom d'utilisateur ou E-mail",
    password: 'Mot de passe',
    signIn: 'Se connecter',
    signingIn: 'Connexion en cours...',
    loginFailed: 'Échec de connexion',
    fillFields: 'Veuillez remplir tous les champs',
    invalidCredentials: 'Identifiants invalides',
  },
  home: {
    dashboard: 'Tableau de bord',
    quickActions: 'Actions rapides',
    loadingDashboard: 'Chargement du tableau de bord...',
    logout: 'Déconnexion',
    logoutConfirm: 'Êtes-vous sûr de vouloir vous déconnecter?',
    switchOrg: "Changer d'organisation",
    switchConfirm: 'Voulez-vous passer à une autre organisation?',
    switchBtn: 'Changer',
    cancel: 'Annuler',
    comingSoon: 'Bientôt disponible',
    featureSoon: 'Cette fonctionnalité sera disponible prochainement.',
    nextUpdate: (entity: string) =>
      `La gestion de ${entity} sera disponible dans la prochaine mise à jour.`,
    createOrder: 'Créer une commande',
    viewReports: 'Voir les rapports',
    aiAssistant: 'Assistant IA',
    customers: 'Clients',
    suppliers: 'Fournisseurs',
    contacts: 'Contacts',
    plants: 'Usines',
    carriers: 'Transporteurs',
    welcome: (name: string) => `Bienvenue, ${name}`,
    trialAccount: "COMPTE D'ESSAI",
  },
};
