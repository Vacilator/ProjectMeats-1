module.exports = {
  extends: ['expo'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
    'react/no-unescaped-entities': 'off',
    // Expo's default import rules pull in a TS resolver that is currently incompatible
    // with our eslint runtime; using node resolver keeps linting stable.
    'import/namespace': 'off',
  },
};
