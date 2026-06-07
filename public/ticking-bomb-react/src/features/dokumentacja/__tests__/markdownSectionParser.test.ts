import { describe, expect, test } from 'vitest';
import documentationSource from '../content/master-documentation.md?raw';
import {
  buildDocumentationAnchorLookup,
  normalizeAnchorKey,
  parseMarkdownSections,
} from '../lib/markdownSectionParser';

describe('markdownSectionParser', () => {
  test('parses H2 sections in source order and generates stable IDs', () => {
    const markdown = [
      '## 1. Jak to uruchomic',
      'Tekst bazowy.',
      '### Build i flash',
      '### Build i flash',
      '## 2. Kolejna sekcja',
      '### Mapowanie pinow GPIO',
    ].join('\n');

    const sections = parseMarkdownSections(markdown);

    expect(sections).toHaveLength(2);
    expect(sections.map((section) => section.id)).toEqual([
      '1-jak-to-uruchomic',
      '2-kolejna-sekcja',
    ]);
    expect(sections.map((section) => section.order)).toEqual([0, 1]);

    expect(sections[0].subheadings.map((subheading) => subheading.id)).toEqual([
      '1-jak-to-uruchomic-build-i-flash',
      '1-jak-to-uruchomic-build-i-flash-2',
    ]);
    expect(sections[0].subheadings.map((subheading) => subheading.anchor)).toEqual([
      'build-i-flash',
      'build-i-flash-2',
    ]);
  });

  test('builds anchor lookup for section and subheading anchors', () => {
    const markdown = [
      '## 1. Jak to uruchomic',
      '### Build i flash',
      '### Monitorowanie systemu',
      '## 2. Kolejna sekcja',
      '### Mapowanie pinow GPIO',
    ].join('\n');

    const sections = parseMarkdownSections(markdown);
    const lookup = buildDocumentationAnchorLookup(sections);

    expect(lookup[normalizeAnchorKey('#1-jak-to-uruchomic')]).toEqual({
      sectionId: '1-jak-to-uruchomic',
      targetId: '1-jak-to-uruchomic',
    });

    expect(lookup[normalizeAnchorKey('#build-i-flash')]).toEqual({
      sectionId: '1-jak-to-uruchomic',
      targetId: '1-jak-to-uruchomic-build-i-flash',
    });

    expect(lookup[normalizeAnchorKey('#mapowanie-pinow-gpio')]).toEqual({
      sectionId: '2-kolejna-sekcja',
      targetId: '2-kolejna-sekcja-mapowanie-pinow-gpio',
    });
  });

  test('resolves all internal anchors from source markdown', () => {
    const sections = parseMarkdownSections(documentationSource);
    const lookup = buildDocumentationAnchorLookup(sections);

    const linkMatches = Array.from(documentationSource.matchAll(/\]\((#[^)]+)\)/g));
    const internalAnchors = linkMatches.map((match) => match[1]);

    const unresolvedAnchors = internalAnchors.filter(
      (anchor) => !(normalizeAnchorKey(anchor) in lookup),
    );

    expect(unresolvedAnchors).toEqual([]);
  });
});
