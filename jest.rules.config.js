/**
 * Isolated config for Firestore security-rules tests.
 * Runs in a Node environment against the Firestore emulator (CommonJS, no RN transform).
 * Invoke via `npm run test:rules`, which boots the emulator first.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.rules.test.js'],
  // These tests need the emulator; keep them out of the default `npm test` run.
};
