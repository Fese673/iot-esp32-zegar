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

const FIREBASE_DB_STORAGE_KEY = 'firebaseDatabaseURL';

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

function safeWriteLocalStorage(key: string, value: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
}

function safeRemoveLocalStorage(key: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage remove errors.
  }
}

export function normalizeFirebaseDatabaseUrl(input: string | undefined | null): string | undefined {
  const raw = input?.trim();
  if (!raw) {
    return undefined;
  }

  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return undefined;
  }

  if (!/^https?:$/i.test(parsed.protocol) || !parsed.hostname) {
    return undefined;
  }

  const host = parsed.hostname.toLowerCase();
  const isIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host);
  const isLikelyHost = host === 'localhost' || isIpv4 || host.includes('.');
  if (!isLikelyHost) {
    return undefined;
  }

  return `${parsed.origin}${parsed.search}`;
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
  const storedDatabaseUrl = safeReadLocalStorage(FIREBASE_DB_STORAGE_KEY);
  const normalizedStoredDatabaseUrl = normalizeFirebaseDatabaseUrl(storedDatabaseUrl);
  const normalizedRuntimeDatabaseUrl = normalizeFirebaseDatabaseUrl(runtimeConfig.databaseURL);

  if (storedDatabaseUrl && !normalizedStoredDatabaseUrl) {
    safeRemoveLocalStorage(FIREBASE_DB_STORAGE_KEY);
  }

  if (storedDatabaseUrl && normalizedStoredDatabaseUrl && storedDatabaseUrl !== normalizedStoredDatabaseUrl) {
    safeWriteLocalStorage(FIREBASE_DB_STORAGE_KEY, normalizedStoredDatabaseUrl);
  }

  return {
    ...runtimeConfig,
    databaseURL: normalizedStoredDatabaseUrl ?? normalizedRuntimeDatabaseUrl,
  };
}
