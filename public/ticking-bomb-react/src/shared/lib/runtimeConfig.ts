export type FirebaseRuntimeConfig = {
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

function safeReadLocalStorage(key: string): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function getRuntimeDeviceId(): string {
  if (typeof window === 'undefined') {
    return 'device1';
  }

  const runtimeDeviceId = window.__DEVICE_ID__?.trim();
  if (runtimeDeviceId) {
    return runtimeDeviceId;
  }

  const storedDeviceId = safeReadLocalStorage('firebaseDeviceId')?.trim();
  return storedDeviceId || 'device1';
}

export function getRuntimeFirebaseConfig(): FirebaseRuntimeConfig {
  if (typeof window === 'undefined') {
    return {};
  }

  const runtimeConfig = window.__FIREBASE_CONFIG__ ?? {};
  const storedDatabaseUrl = safeReadLocalStorage('firebaseDatabaseURL');

  return {
    ...runtimeConfig,
    databaseURL: storedDatabaseUrl || runtimeConfig.databaseURL,
  };
}
