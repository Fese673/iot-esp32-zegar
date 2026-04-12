import type { DocumentationSection } from '../lib/markdownSectionParser';

interface DocumentationTocProps {
  sections: DocumentationSection[];
  activeSectionId: string | null;
}

function DocumentationToc({ sections, activeSectionId }: DocumentationTocProps) {
  return (
    <aside className="panel docs-toc" aria-label="Spis tresci dokumentacji">
      <p className="eyebrow mono">Nawigacja</p>
      <h2>Spis tresci</h2>
      <nav>
        <ul className="docs-toc-list">
          {sections.map((section) => {
            const isActive = activeSectionId === section.id;

            return (
              <li key={section.id}>
                <a
                  className={`docs-toc-link ${isActive ? 'active' : ''}`}
                  href={`#dokumentacja/${section.id}`}
                >
                  {section.title}
                </a>
                {section.subheadings.length > 0 ? (
                  <p className="docs-toc-subheads" aria-hidden="true">
                    {section.subheadings.map((subheading) => subheading.title).join(' • ')}
                  </p>
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
