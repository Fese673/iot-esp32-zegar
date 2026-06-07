export const DOCUMENTATION_HASH_PREFIX = '#dokumentacja';

export interface DocumentationHashTarget {
  sectionId: string;
  targetId: string;
}

export function buildDocumentationHash(sectionId: string, targetId?: string): string {
  const safeSection = encodeURIComponent(sectionId);

  if (!targetId || targetId === sectionId) {
    return `${DOCUMENTATION_HASH_PREFIX}/${safeSection}`;
  }

  return `${DOCUMENTATION_HASH_PREFIX}/${safeSection}/${encodeURIComponent(targetId)}`;
}

export function parseDocumentationHash(hash: string): DocumentationHashTarget | null {
  if (!hash.startsWith(DOCUMENTATION_HASH_PREFIX)) {
    return null;
  }

  const rawPath = hash.slice(DOCUMENTATION_HASH_PREFIX.length).replace(/^\//, '');
  if (!rawPath) {
    return null;
  }

  const segments = rawPath
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => decodeURIComponent(segment));

  if (segments.length === 0 || !segments[0]) {
    return null;
  }

  const sectionId = segments[0];
  const targetId = segments.length > 1 ? segments.slice(1).join('/') : sectionId;

  return { sectionId, targetId };
}
