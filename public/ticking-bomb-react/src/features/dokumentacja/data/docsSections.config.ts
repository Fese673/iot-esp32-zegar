import type { DocumentationSection } from '../lib/markdownSectionParser';

export interface DocumentationSectionConfig {
  hiddenSectionIds: string[];
  pinnedOrder: string[];
  titleOverrides: Record<string, string>;
}

export const documentationSectionConfig: DocumentationSectionConfig = {
  hiddenSectionIds: [],
  pinnedOrder: [],
  titleOverrides: {},
};

export function applyDocumentationSectionConfig(sections: DocumentationSection[]): DocumentationSection[] {
  const hidden = new Set(documentationSectionConfig.hiddenSectionIds);
  const pinned = documentationSectionConfig.pinnedOrder;
  const titleOverrides = documentationSectionConfig.titleOverrides;

  const filtered = sections
    .filter((section) => !hidden.has(section.id))
    .map((section) => ({
      ...section,
      title: titleOverrides[section.id] ?? section.title,
    }));

  if (pinned.length === 0) {
    return filtered;
  }

  const pinOrder = new Map<string, number>();
  pinned.forEach((id, index) => pinOrder.set(id, index));

  return [...filtered].sort((left, right) => {
    const leftPinned = pinOrder.has(left.id);
    const rightPinned = pinOrder.has(right.id);

    if (leftPinned && rightPinned) {
      return (pinOrder.get(left.id) ?? 0) - (pinOrder.get(right.id) ?? 0);
    }

    if (leftPinned) {
      return -1;
    }

    if (rightPinned) {
      return 1;
    }

    return left.order - right.order;
  });
}
