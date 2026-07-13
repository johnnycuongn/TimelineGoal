// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      // Reanimated shared values are mutated by design (`sv.value = x` inside
      // effects/handlers is the documented v4 API); the React Compiler's
      // immutability lint doesn't model them yet.
      'react-hooks/immutability': 'off',
      // Advisory only: the Firestore reset-then-subscribe idiom (clear state,
      // then onSnapshot) trips this; the reset half is intentional.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // Jest suites — includes the plain-JS rules tests that run outside the app bundle.
    files: ['**/*.test.{js,ts,tsx}', 'jest.*.js'],
    languageOptions: { globals: { ...globals.jest, ...globals.node } },
  },
]);
