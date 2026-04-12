import { applyDocumentationSectionConfig } from '../data/docsSections.config';
import sourceMarkdown from '../content/master-documentation.md?raw';
import { parseMarkdownSections } from './markdownSectionParser';

export const documentationSourceMarkdown = sourceMarkdown;

export const documentationSections = applyDocumentationSectionConfig(
  parseMarkdownSections(documentationSourceMarkdown),
);
