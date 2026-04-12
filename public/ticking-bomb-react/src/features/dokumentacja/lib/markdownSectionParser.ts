export interface DocumentationSubheading {
  id: string;
  title: string;
}

export interface DocumentationSection {
  id: string;
  title: string;
  markdown: string;
  subheadings: DocumentationSubheading[];
  order: number;
}

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

function extractSubheadings(sectionId: string, markdown: string): DocumentationSubheading[] {
  const usedIds = new Set<string>();

  return markdown
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('### '))
    .map((line) => cleanHeading(line.slice(4)))
    .map((title) => {
      const baseId = `${sectionId}-${toSlug(title)}`;
      let uniqueId = baseId;
      let counter = 2;

      while (usedIds.has(uniqueId)) {
        uniqueId = `${baseId}-${counter}`;
        counter += 1;
      }

      usedIds.add(uniqueId);
      return { id: uniqueId, title };
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
