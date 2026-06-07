export interface DocumentationSubheading {
  id: string;
  title: string;
  anchor: string;
}

export interface DocumentationSection {
  id: string;
  title: string;
  markdown: string;
  subheadings: DocumentationSubheading[];
  order: number;
}

export interface DocumentationAnchorTarget {
  sectionId: string;
  targetId: string;
}

export type DocumentationAnchorLookup = Record<string, DocumentationAnchorTarget>;

function cleanHeading(text: string): string {
  return text.replace(/\s+#+\s*$/, '').trim();
}

export function toSlug(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  return normalized || 'sekcja';
}

export function normalizeAnchorKey(anchorValue: string): string {
  return toSlug(decodeURIComponent(anchorValue).replace(/^#/, '').trim());
}

function extractSubheadings(sectionId: string, markdown: string): DocumentationSubheading[] {
  const usedIds = new Set<string>();
  const usedAnchors = new Set<string>();

  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('### '))
    .map((line) => cleanHeading(line.slice(4)))
    .map((title) => {
      const baseAnchor = toSlug(title);
      const baseId = `${sectionId}-${baseAnchor}`;
      let uniqueId = baseId;
      let uniqueAnchor = baseAnchor;
      let counter = 2;

      while (usedIds.has(uniqueId)) {
        uniqueId = `${baseId}-${counter}`;
        counter += 1;
      }

      counter = 2;
      while (usedAnchors.has(uniqueAnchor)) {
        uniqueAnchor = `${baseAnchor}-${counter}`;
        counter += 1;
      }

      usedIds.add(uniqueId);
      usedAnchors.add(uniqueAnchor);

      return {
        id: uniqueId,
        title,
        anchor: uniqueAnchor,
      };
    });
}

function buildUniqueSectionId(title: string, usedIds: Set<string>): string {
  const baseId = toSlug(title);
  let uniqueId = baseId;
  let counter = 2;

  while (usedIds.has(uniqueId)) {
    uniqueId = `${baseId}-${counter}`;
    counter += 1;
  }

  usedIds.add(uniqueId);
  return uniqueId;
}

export function parseMarkdownSections(markdown: string): DocumentationSection[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections: DocumentationSection[] = [];
  const usedSectionIds = new Set<string>();

  let introTitle = 'Wstep projektu';
  let prefaceLines: string[] = [];

  let currentTitle: string | null = null;
  let currentLines: string[] = [];
  let sectionOrder = 0;

  const flushSection = (title: string, sectionLines: string[]) => {
    const markdownBody = sectionLines.join('\n').trim();

    if (!markdownBody) {
      return;
    }

    const id = buildUniqueSectionId(title, usedSectionIds);
    const subheadings = extractSubheadings(id, markdownBody);

    sections.push({
      id,
      title,
      markdown: markdownBody,
      subheadings,
      order: sectionOrder,
    });

    sectionOrder += 1;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const h1Match = /^#\s+(.+)$/.exec(line);
    const h2Match = /^##\s+(.+)$/.exec(line);

    if (h2Match) {
      if (currentTitle == null) {
        flushSection(introTitle, prefaceLines);
      } else {
        flushSection(currentTitle, currentLines);
      }

      currentTitle = cleanHeading(h2Match[1]);
      currentLines = [];
      continue;
    }

    if (h1Match && currentTitle == null && prefaceLines.length === 0) {
      introTitle = cleanHeading(h1Match[1]);
      continue;
    }

    if (currentTitle == null) {
      prefaceLines.push(rawLine);
    } else {
      currentLines.push(rawLine);
    }
  }

  if (currentTitle == null) {
    flushSection(introTitle, prefaceLines);
  } else {
    flushSection(currentTitle, currentLines);
  }

  return sections;
}

function registerAnchor(
  lookup: DocumentationAnchorLookup,
  key: string,
  target: DocumentationAnchorTarget,
): void {
  if (!key) {
    return;
  }

  if (!(key in lookup)) {
    lookup[key] = target;
  }
}

export function buildDocumentationAnchorLookup(sections: DocumentationSection[]): DocumentationAnchorLookup {
  const lookup: DocumentationAnchorLookup = {};

  sections.forEach((section) => {
    const sectionTarget: DocumentationAnchorTarget = {
      sectionId: section.id,
      targetId: section.id,
    };

    registerAnchor(lookup, normalizeAnchorKey(section.id), sectionTarget);
    registerAnchor(lookup, normalizeAnchorKey(section.title), sectionTarget);

    section.subheadings.forEach((subheading) => {
      const target: DocumentationAnchorTarget = {
        sectionId: section.id,
        targetId: subheading.id,
      };

      registerAnchor(lookup, normalizeAnchorKey(subheading.id), target);
      registerAnchor(lookup, normalizeAnchorKey(subheading.anchor), target);
      registerAnchor(lookup, normalizeAnchorKey(subheading.title), target);
    });
  });

  return lookup;
}
