import { applyDocumentationSectionConfig } from '../data/docsSections.config';
import sourceMarkdown from '../content/master-documentation.md?raw';
import { buildDocumentationAnchorLookup, parseMarkdownSections } from './markdownSectionParser';

export const documentationSourceMarkdown = sourceMarkdown;

const parsedDocumentationSections = applyDocumentationSectionConfig(
  parseMarkdownSections(documentationSourceMarkdown),
);

export const documentationSections = parsedDocumentationSections;

export const documentationAnchorLookup = buildDocumentationAnchorLookup(parsedDocumentationSections);
