import { isValidElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeHighlight from 'rehype-highlight';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import DocumentationCodeBlock from './DocumentationCodeBlock';
import DocumentationTable from './DocumentationTable';
import { buildDocumentationHash } from '../lib/documentationHash';
import {
  normalizeAnchorKey,
  toSlug,
  type DocumentationAnchorLookup,
  type DocumentationSection,
} from '../lib/markdownSectionParser';

interface DocumentationSectionCardProps {
  section: DocumentationSection;
  index: number;
  anchorLookup: DocumentationAnchorLookup;
}

function childrenToPlainText(children: ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map((child) => childrenToPlainText(child)).join('');
  }

  if (isValidElement(children)) {
    return childrenToPlainText((children.props as { children?: ReactNode }).children);
  }

  return '';
}

function DocumentationSectionCard({ section, index, anchorLookup }: DocumentationSectionCardProps) {
  const headingCounters = new Map<string, number>();

  const getSubheadingId = (headingText: string): string => {
    const baseId = `${section.id}-${toSlug(headingText)}`;
    const currentCount = headingCounters.get(baseId) ?? 0;
    const nextCount = currentCount + 1;

    headingCounters.set(baseId, nextCount);

    if (nextCount === 1) {
      return baseId;
    }

    return `${baseId}-${nextCount}`;
  };

  const markdownComponents: Components = {
    table: ({ children, ...props }) => <DocumentationTable {...props}>{children}</DocumentationTable>,
    code: ({ className, children }) => {
      const codeValue = String(children ?? '').replace(/\n$/, '');
      const isInlineCode = !className && !codeValue.includes('\n');

      if (isInlineCode) {
        return <code className="docs-inline-code">{children}</code>;
      }

      return <DocumentationCodeBlock className={className}>{codeValue}</DocumentationCodeBlock>;
    },
    a: ({ href, children, ...props }) => {
      const rawHref = href ?? '';
      const isDocumentationHash = rawHref.startsWith('#dokumentacja');
      const isInternalAnchor = rawHref.startsWith('#') && !isDocumentationHash;

      let safeHref = rawHref;
      if (isInternalAnchor) {
        const normalizedAnchor = normalizeAnchorKey(rawHref);
        const mappedTarget = anchorLookup[normalizedAnchor];

        if (mappedTarget) {
          safeHref = buildDocumentationHash(mappedTarget.sectionId, mappedTarget.targetId);
        } else {
          safeHref = buildDocumentationHash(section.id);
        }
      }

      const isExternal = /^https?:\/\//i.test(rawHref);

      return (
        <a
          href={safeHref}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },
    h3: ({ children, ...props }) => {
      const headingText = childrenToPlainText(children).trim();
      const headingId = getSubheadingId(headingText || 'podsekcja');

      return (
        <h3 id={headingId} {...props}>
          {children}
        </h3>
      );
    },
  };

  return (
    <section id={section.id} className="panel docs-section-card" data-section-id={section.id}>
      <header className="docs-section-head">
        <p className="docs-section-index mono">Sekcja {index + 1}</p>
        <h2>{section.title}</h2>
      </header>

      <div className="docs-markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[
            rehypeHighlight,
            rehypeSlug,
            [rehypeAutolinkHeadings, { behavior: 'append' }],
          ]}
          components={markdownComponents}
        >
          {section.markdown}
        </ReactMarkdown>
      </div>
    </section>
  );
}

export default DocumentationSectionCard;
