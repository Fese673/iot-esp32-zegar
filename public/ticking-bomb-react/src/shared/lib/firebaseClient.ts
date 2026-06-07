import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';
import { getRuntimeFirebaseConfig, type FirebaseRuntimeConfig } from './runtimeConfig';

let firebaseApp: FirebaseApp | null = null;
let firebaseDb: Database | null = null;

function resolveFirebaseConfig(): FirebaseRuntimeConfig {
  return getRuntimeFirebaseConfig();
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config = resolveFirebaseConfig();
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.databaseURL) {
    throw new Error(
      'Missing or invalid Firebase configuration. Check firebase-config.js and ensure databaseURL points to the RTDB root (without child path).',
    );
  }

  firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
  return firebaseApp;
}

export function getFirebaseDb(): Database {
  if (!firebaseDb) {
    firebaseDb = getDatabase(getFirebaseApp());
  }

  return firebaseDb;
}