/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testMatch: ["**/__tests__/**/*.test.js", "**/*.test.js"],
  modulePathIgnorePatterns: ["<rootDir>/dist-web/"],
  clearMocks: true,
};
