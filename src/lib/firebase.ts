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
import { Platform } from 'react-native';
import { getApps, initializeApp } from 'firebase/app';
import * as firebaseAuth from 'firebase/auth';
import {
  connectAuthEmulator,
  getAuth,
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
 * `getReactNativePersistence` exists ONLY in Firebase's React Native build (which Metro
 * resolves on iOS/Android). On web — and in the router-server's Node render used for
 * static web output — `firebase/auth` resolves to builds without it, so we must feature-
 * detect and fall back to the platform default (getAuth) instead of crashing.
 */
const getReactNativePersistence = (
  firebaseAuth as unknown as {
    getReactNativePersistence?: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

/**
 * Host the emulators are reachable at.
 *  - iOS simulator / web: localhost IS the Mac.
 *  - Android emulator: localhost is the phone; 10.0.2.2 is the host Mac.
 *  - Physical device: set EXPO_PUBLIC_FIREBASE_EMULATOR_HOST to the Mac's LAN IP.
 */
const EMULATOR_HOST =
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ??
  Platform.select({ android: '10.0.2.2', default: 'localhost' }) ??
  'localhost';

/** In dev, use emulators unless explicitly disabled. */
const USE_EMULATORS =
  __DEV__ && process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATORS !== 'false';

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth =
  typeof getReactNativePersistence === 'function'
    ? // Native (iOS/Android): persist sessions in AsyncStorage.
      initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
    : // Web / Node render: platform default persistence.
      getAuth(app);

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
