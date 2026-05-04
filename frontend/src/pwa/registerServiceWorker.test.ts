import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerSW } from 'virtual:pwa-register';
import {
  registerProjectMeatsServiceWorker,
  shouldRegisterServiceWorker,
} from './registerServiceWorker';

vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn(),
}));

describe('registerServiceWorker', () => {
  const mockedRegisterSW = vi.mocked(registerSW);

  beforeEach(() => {
    mockedRegisterSW.mockReset();
  });

  it('skips registration outside production builds', () => {
    const result = registerProjectMeatsServiceWorker(
      { PROD: false },
      { serviceWorker: {} as ServiceWorkerContainer } as Navigator,
      mockedRegisterSW
    );

    expect(result).toBeNull();
    expect(mockedRegisterSW).not.toHaveBeenCalled();
  });

  it('checks browser support before attempting registration', () => {
    expect(shouldRegisterServiceWorker({ PROD: true }, undefined)).toBe(false);
  });

  it('registers the service worker in supported production browsers', () => {
    const unregister = vi.fn();
    mockedRegisterSW.mockReturnValue(unregister);

    const result = registerProjectMeatsServiceWorker(
      { PROD: true },
      { serviceWorker: {} as ServiceWorkerContainer } as Navigator,
      mockedRegisterSW
    );

    expect(result).toBe(unregister);
    expect(mockedRegisterSW).toHaveBeenCalledOnce();
    expect(mockedRegisterSW.mock.calls[0]?.[0]).toMatchObject({
      immediate: true,
    });
  });
});
