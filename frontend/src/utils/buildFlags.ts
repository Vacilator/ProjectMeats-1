const IS_TEST_RUNTIME = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export const IS_DEV_BUILD = !IS_TEST_RUNTIME && import.meta.env.DEV;
export const IS_PROD_BUILD = !IS_DEV_BUILD;
