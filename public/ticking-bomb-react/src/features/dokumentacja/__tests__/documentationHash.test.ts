import { describe, expect, test } from 'vitest';
import {
  DOCUMENTATION_HASH_PREFIX,
  buildDocumentationHash,
  parseDocumentationHash,
} from '../lib/documentationHash';

describe('documentationHash', () => {
  test('builds section hash and section-target hash', () => {
    expect(buildDocumentationHash('sekcja-start')).toBe('#dokumentacja/sekcja-start');
    expect(buildDocumentationHash('sekcja-start', 'sekcja-start-konfiguracja')).toBe(
      '#dokumentacja/sekcja-start/sekcja-start-konfiguracja',
    );
  });

  test('parses section hash and subtarget hash', () => {
    expect(parseDocumentationHash('#dokumentacja/sekcja-start')).toEqual({
      sectionId: 'sekcja-start',
      targetId: 'sekcja-start',
    });

    expect(parseDocumentationHash('#dokumentacja/sekcja-start/sekcja-start-konfiguracja')).toEqual({
      sectionId: 'sekcja-start',
      targetId: 'sekcja-start-konfiguracja',
    });
  });

  test('returns null for invalid hashes', () => {
    expect(parseDocumentationHash('')).toBeNull();
    expect(parseDocumentationHash('#analiza-danych')).toBeNull();
    expect(parseDocumentationHash(DOCUMENTATION_HASH_PREFIX)).toBeNull();
  });
});
