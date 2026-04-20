// Minimal NativeModules mock for jest-expo setup.
// jest-expo expects `require(...).default` to be an object and assumes a couple of
// nested properties exist.
module.exports = {
  default: {
    NativeUnimoduleProxy: {
      viewManagersMetadata: {},
    },
    UIManager: {},
    Linking: {},
  },
};
