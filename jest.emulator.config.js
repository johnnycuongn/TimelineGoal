/**
 * Config for tests that run against the Firebase Emulator Suite in a Node environment:
 *   - *.rules.test.js  — security-rules tests (@firebase/rules-unit-testing)
 *   - *.emulator.test.ts — integration tests exercising src/features data-layer code
 *
 * Kept out of the default `npm test` (they need the emulator). Run via `npm run test:emulator`,
 * which wraps this in `firebase emulators:exec`.
 *
 * Transforms TS + ESM→CJS with minimal babel (no preset-env / no RN preset), so it works
 * with the project's @babel/core@8 pin.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.rules.test.js', '**/*.emulator.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': [
      'babel-jest',
      {
        presets: ['@babel/preset-typescript'],
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(firebase|@firebase)/)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
