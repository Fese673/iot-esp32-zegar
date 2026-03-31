// @vitest-environment jsdom
import { beforeEach, expect, test } from 'vitest';
import { describe } from 'vitest';
import { getRuntimeFirebaseConfig, normalizeFirebaseDatabaseUrl } from '../runtimeConfig';

const FIREBASE_DB_STORAGE_KEY = 'firebaseDatabaseURL';

describe('runtimeConfig databaseURL hardening', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete window.__FIREBASE_CONFIG__;
  });

  test('normalizeFirebaseDatabaseUrl keeps origin and strips child path', () => {
    expect(normalizeFirebaseDatabaseUrl('https://demo-default-rtdb.europe-west1.firebasedatabase.app/devices/device1/latest'))
      .toBe('https://demo-default-rtdb.europe-west1.firebasedatabase.app');

    expect(normalizeFirebaseDatabaseUrl('demo-default-rtdb.europe-west1.firebasedatabase.app/history?ns=demo-app'))
      .toBe('https://demo-default-rtdb.europe-west1.firebasedatabase.app?ns=demo-app');
  });

  test('normalizeFirebaseDatabaseUrl returns undefined for invalid values', () => {
    expect(normalizeFirebaseDatabaseUrl('')).toBeUndefined();
    expect(normalizeFirebaseDatabaseUrl('not-a-url')).toBeUndefined();
    expect(normalizeFirebaseDatabaseUrl('ftp://demo-default-rtdb.europe-west1.firebasedatabase.app')).toBeUndefined();
  });

  test('getRuntimeFirebaseConfig sanitizes and persists localStorage override', () => {
    window.__FIREBASE_CONFIG__ = {
      databaseURL: 'https://runtime-default-rtdb.europe-west1.firebasedatabase.app',
    };

    window.localStorage.setItem(
      FIREBASE_DB_STORAGE_KEY,
      'https://runtime-default-rtdb.europe-west1.firebasedatabase.app/devices/device1/latest',
    );

    const config = getRuntimeFirebaseConfig();

    expect(config.databaseURL).toBe('https://runtime-default-rtdb.europe-west1.firebasedatabase.app');
    expect(window.localStorage.getItem(FIREBASE_DB_STORAGE_KEY))
      .toBe('https://runtime-default-rtdb.europe-west1.firebasedatabase.app');
  });

  test('getRuntimeFirebaseConfig drops invalid localStorage override and falls back to runtime config', () => {
    window.__FIREBASE_CONFIG__ = {
      databaseURL: 'https://fallback-default-rtdb.europe-west1.firebasedatabase.app/devices/device1/latest',
    };

    window.localStorage.setItem(FIREBASE_DB_STORAGE_KEY, 'not-a-url');

    const config = getRuntimeFirebaseConfig();

    expect(config.databaseURL).toBe('https://fallback-default-rtdb.europe-west1.firebasedatabase.app');
    expect(window.localStorage.getItem(FIREBASE_DB_STORAGE_KEY)).toBeNull();
  });
});
