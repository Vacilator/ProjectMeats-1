import { registerSW } from 'virtual:pwa-register';
import { logger } from '../utils/logger';

interface ServiceWorkerEnv {
  PROD: boolean;
}

export function shouldRegisterServiceWorker(
  env: ServiceWorkerEnv = import.meta.env,
  navigatorRef: Navigator | undefined = typeof window !== 'undefined' ? window.navigator : undefined
): boolean {
  return env.PROD && typeof window !== 'undefined' && Boolean(navigatorRef?.serviceWorker);
}

export function registerProjectMeatsServiceWorker(
  env: ServiceWorkerEnv = import.meta.env,
  navigatorRef: Navigator | undefined = typeof window !== 'undefined'
    ? window.navigator
    : undefined,
  register: typeof registerSW = registerSW
): ReturnType<typeof registerSW> | null {
  if (!shouldRegisterServiceWorker(env, navigatorRef)) {
    return null;
  }

  return register({
    immediate: true,
    onRegisteredSW(swUrl, registration) {
      logger.info('PWA service worker registered', {
        component: 'registerServiceWorker',
        metadata: {
          swUrl,
          scope: registration?.scope ?? 'unknown',
        },
      });
    },
    onOfflineReady() {
      logger.info('PWA app shell ready for offline use', {
        component: 'registerServiceWorker',
      });
    },
    onRegisterError(error) {
      logger.warn(
        'PWA service worker registration failed',
        {
          component: 'registerServiceWorker',
        },
        error
      );
    },
  });
}
