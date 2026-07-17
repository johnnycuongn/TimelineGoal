/**
 * Integration tests for Storage rules — photos live under couples/{coupleId}/
 * and only that couple's members can read or write them; uploads must be images.
 * Run: `npm run test:emulator` (needs the storage emulator, port 9199).
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import type { Firestore } from 'firebase/firestore';

import { createCouple } from '@/features/couple/api';

const PROJECT_ID = 'demo-timelinegoal';
const ALICE = 'alice_uid';
const MALLORY = 'mallory_uid';

let testEnv: RulesTestEnvironment;
let coupleId: string;

// A 1x1 transparent PNG.
const TINY_PNG = Uint8Array.from(
  atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='),
  (c) => c.charCodeAt(0),
);

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8') },
    storage: { rules: readFileSync(resolve(__dirname, '../../../storage.rules'), 'utf8') },
  });
});
afterAll(async () => {
  await testEnv.cleanup();
});
beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
  coupleId = (
    await createCouple(
      testEnv.authenticatedContext(ALICE).firestore() as unknown as Firestore,
      { uid: ALICE, partnerColor: '#BE185D' },
    )
  ).coupleId;
});

describe('storage rules', () => {
  it('lets a member upload an image under their couple and read it back', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage();
    const photoRef = ref(storage, `couples/${coupleId}/corners/c1/p1.png`);
    await assertSucceeds(uploadBytes(photoRef, TINY_PNG, { contentType: 'image/png' }));
    await assertSucceeds(getBytes(photoRef));
  });

  it('locks strangers out of the couple folder entirely', async () => {
    const alice = testEnv.authenticatedContext(ALICE).storage();
    const aliceRef = ref(alice, `couples/${coupleId}/corners/c1/p1.png`);
    await assertSucceeds(uploadBytes(aliceRef, TINY_PNG, { contentType: 'image/png' }));

    const evil = testEnv.authenticatedContext(MALLORY).storage();
    const evilRef = ref(evil, `couples/${coupleId}/corners/c1/p1.png`);
    await assertFails(getBytes(evilRef));
    await assertFails(uploadBytes(evilRef, TINY_PNG, { contentType: 'image/png' }));
  });

  it('rejects non-image uploads even from members', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage();
    const badRef = ref(storage, `couples/${coupleId}/corners/c1/sneaky.txt`);
    await assertFails(
      uploadBytes(badRef, new TextEncoder().encode('not a picture'), {
        contentType: 'text/plain',
      }),
    );
  });

  it('denies anything outside couples/', async () => {
    const storage = testEnv.authenticatedContext(ALICE).storage();
    await assertFails(
      uploadBytes(ref(storage, 'loose/file.png'), TINY_PNG, { contentType: 'image/png' }),
    );
  });
});
