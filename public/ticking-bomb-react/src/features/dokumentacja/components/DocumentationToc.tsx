import { useEffect, useId, useState } from 'react';
import { buildDocumentationHash } from '../lib/documentationHash';
import type { DocumentationSection } from '../lib/markdownSectionParser';

interface DocumentationTocProps {
  sections: DocumentationSection[];
  activeSectionId: string | null;
  activeTargetId: string | null;
}

function DocumentationToc({ sections, activeSectionId, activeTargetId }: DocumentationTocProps) {
  const navId = useId();
  const isInitialCompact =
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(max-width: 1100px)').matches;

  const [isCompact, setIsCompact] = useState(isInitialCompact);
  const [isOpen, setIsOpen] = useState(!isInitialCompact);

  const handleLinkClick = () => {
    if (isCompact) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const compactMedia = window.matchMedia('(max-width: 1100px)');

    const applyMode = () => {
      const compact = compactMedia.matches;
      setIsCompact(compact);
      setIsOpen(!compact);
    };

    applyMode();
    compactMedia.addEventListener('change', applyMode);

    return () => {
      compactMedia.removeEventListener('change', applyMode);
    };
  }, []);

  return (
    <aside className="panel docs-toc" aria-label="Spis tresci dokumentacji">
      <p className="eyebrow mono">Nawigacja</p>
      <h2>Spis tresci</h2>

      <button
        type="button"
        className="ghost-btn docs-toc-toggle"
        aria-expanded={isOpen}
        aria-controls={navId}
        onClick={() => setIsOpen((previous) => !previous)}
      >
        {isOpen ? 'Ukryj spis tresci' : 'Pokaz spis tresci'}
      </button>

      <nav id={navId} hidden={isCompact && !isOpen}>
        <ul className="docs-toc-list">
          {sections.map((section) => {
            const isActive = activeSectionId === section.id;

            return (
              <li key={section.id}>
                <a
                  className={`docs-toc-link ${isActive ? 'active' : ''}`}
                  href={buildDocumentationHash(section.id)}
                  onClick={handleLinkClick}
                >
                  {section.title}
                </a>
                {section.subheadings.length > 0 ? (
                  <ul className="docs-toc-subhead-list">
                    {section.subheadings.map((subheading) => {
                      const isSubheadingActive = activeTargetId === subheading.id;

                      return (
                        <li key={subheading.id}>
                          <a
                            className={`docs-toc-sublink ${isSubheadingActive ? 'active' : ''}`}
                            href={buildDocumentationHash(section.id, subheading.id)}
                            onClick={handleLinkClick}
                          >
                            {subheading.title}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default DocumentationToc;
