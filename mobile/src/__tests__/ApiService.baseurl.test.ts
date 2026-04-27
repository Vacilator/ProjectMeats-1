/* eslint-disable import/first */
// Base URL resolution tests for ApiService.
// We keep this isolated so we can reset modules and assert axios.create config.

jest.mock('axios', () => {
  const axiosMock = {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  };

  return {
    __esModule: true,
    default: axiosMock,
    ...axiosMock,
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      hostUri: '192.168.0.2:8081',
      extra: { apiBaseUrl: 'http://localhost:8000/api/v1' },
    },
  },
}));

describe('ApiService – baseURL resolution', () => {
  it('rewrites localhost to the Expo dev host IP in dev', () => {
    jest.resetModules();

    // NOTE: use require() (not dynamic import) to keep jest-expo + tsc happy.
    const axios = require('axios').default;
    const create = axios.create as jest.Mock;
    create.mockClear();

    jest.isolateModules(() => {
      require('../services/ApiService');
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://192.168.0.2:8000/api/v1',
      })
    );
  });
});
