/**
 * Firebase client (modular SDK v12).
 *
 * Config values below are PUBLIC (safe to commit / ship in the client bundle) — the only
 * real secret would be a service-account JSON, which never lives here.
 *
 * Dev builds connect to the local Emulator Suite (Firestore/Auth/Storage) so we never
 * touch production data while developing. Toggle with EXPO_PUBLIC_USE_FIREBASE_EMULATORS.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  connectAuthEmulator,
  initializeAuth,
  type Auth,
  type Persistence,
} from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage';

// Public web config for the `timelinegoal` project.
const firebaseConfig = {
  apiKey: 'AIzaSyCG_Z3mVFPm4k-waHuomlxMDjm8nP3ffcc',
  authDomain: 'timelinegoal.firebaseapp.com',
  projectId: 'timelinegoal',
  storageBucket: 'timelinegoal.firebasestorage.app',
  messagingSenderId: '1070162148867',
  appId: '1:1070162148867:web:220950bffc9a799f8e9836',
} as const;

/**
 * `getReactNativePersistence` is exported only from Firebase's React Native build, so the
 * default (web) typings don't see it. Metro resolves the RN build at runtime; we cast here.
 */
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

/** Host the emulators are reachable at. localhost works for iOS sim + web; */
/** set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST to your Mac's LAN IP for a physical device. */
const EMULATOR_HOST = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ?? 'localhost';

/** In dev, use emulators unless explicitly disabled. */
const USE_EMULATORS =
  __DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== 'false';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Long polling avoids the streaming-transport issues Firestore hits on some RN networks.
export const db: Firestore = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const storage: FirebaseStorage = getStorage(app);

// Wire emulators exactly once.
let emulatorsConnected = false;
if (USE_EMULATORS && !emulatorsConnected) {
  emulatorsConnected = true;
  connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, EMULATOR_HOST, 8080);
  connectStorageEmulator(storage, EMULATOR_HOST, 9199);
}

export { app, USE_EMULATORS };
