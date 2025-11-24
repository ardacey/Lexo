module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  const isProduction = process.env.EXPO_PUBLIC_ENVIRONMENT === 'production' || process.env.NODE_ENV === 'production';
  if (isProduction) {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins,
  };
};