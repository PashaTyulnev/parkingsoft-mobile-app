module.exports = function (api) {
  api.cache(true);
  return {
    // Absolute path avoids "Cannot find module 'babel-preset-expo'" when Metro/Babel resolve from another cwd
    presets: [require.resolve("babel-preset-expo")],
  };
};
