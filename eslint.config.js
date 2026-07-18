// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  // NOTE (sdk54 branch): the React-Compiler-era hook rules we tuned on SDK 57
  // (react-hooks/immutability off, set-state-in-effect → warn, the refs rule)
  // don't exist in eslint-plugin-react-hooks 5.x that SDK 54 ships — configuring
  // them crashes ESLint, so the overrides are gone. The inline
  // eslint-disable-next-line comments for those rules become "unused directive"
  // warnings, which is fine.
  {
    // Jest suites — includes the plain-JS rules tests that run outside the app bundle.
    files: ['**/*.test.{js,ts,tsx}', 'jest.*.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
]);
