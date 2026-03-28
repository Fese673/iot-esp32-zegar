import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getDatabase, type Database } from 'firebase/database';

type FirebaseRuntimeConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  databaseURL?: string;
};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseRuntimeConfig;
    __DEVICE_ID__?: string;
  }
}

let firebaseApp: FirebaseApp | null = null;
let firebaseDb: Database | null = null;

function resolveFirebaseConfig(): FirebaseRuntimeConfig {
  if (typeof window === 'undefined') {
    return {};
  }

  const runtimeConfig = window.__FIREBASE_CONFIG__ ?? {};
  const databaseURL = localStorage.getItem('firebaseDatabaseURL') || runtimeConfig.databaseURL;

  return {
    ...runtimeConfig,
    databaseURL,
  };
}

export function getFirebaseApp(): FirebaseApp {
  if (firebaseApp) {
    return firebaseApp;
  }

  const config = resolveFirebaseConfig();
  if (!config.apiKey || !config.authDomain || !config.projectId || !config.databaseURL) {
    throw new Error('Missing Firebase configuration. Check firebase-config.js.');
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