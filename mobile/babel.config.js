module.exports = function(api) {
  api.cache(true);
  // Use process.env directly to avoid babel caching conflicts with api.env()
  const isTest = process.env.NODE_ENV === 'test';
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Exclude reanimated plugin during Jest runs — it requires native modules
      // that are not available in the Node.js test environment.
      ...(!isTest ? ['react-native-reanimated/plugin'] : []),
    ],
  };
};
