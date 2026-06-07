import { useEffect, useMemo, useState } from 'react';
import 'highlight.js/styles/github-dark.css';
import { sensorsCatalog } from '../data/sensorsCatalog';
import { buildDocumentationHash, parseDocumentationHash } from '../lib/documentationHash';
import { documentationAnchorLookup, documentationSections } from '../lib/markdownLoader';
import DocumentationHero from './DocumentationHero';
import DocumentationSectionCard from './DocumentationSectionCard';
import DocumentationSensorHub from './DocumentationSensorHub';
import DocumentationToc from './DocumentationToc';
import DocumentationTopNav from './DocumentationTopNav';
import '../styles/dokumentacja.css';

interface DocumentationPageProps {
  onBack: () => void;
}

function DocumentationPage({ onBack }: DocumentationPageProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    documentationSections[0]?.id ?? null,
  );
  const [activeTargetId, setActiveTargetId] = useState<string | null>(
    documentationSections[0]?.id ?? null,
  );
  const [introAnimationEnabled, setIntroAnimationEnabled] = useState(false);

  const allSections = useMemo(() => documentationSections, []);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    if (document.documentElement.classList.contains('motion-off')) {
      return;
    }

    if (!window.matchMedia('(min-width: 961px)').matches) {
      return;
    }

    setIntroAnimationEnabled(true);
  }, []);

  useEffect(() => {
    const scrollToHashTarget = (scrollBehavior: ScrollBehavior) => {
      const hashTarget = parseDocumentationHash(window.location.hash);
      if (!hashTarget) {
        if (!window.location.hash && allSections[0]) {
          setActiveSectionId(allSections[0].id);
          setActiveTargetId(allSections[0].id);
        }

        return;
      }

      const targetElement = document.getElementById(hashTarget.targetId)
        ?? document.getElementById(hashTarget.sectionId);

      if (!targetElement) {
        return;
      }

      targetElement.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      setActiveSectionId(hashTarget.sectionId);
      setActiveTargetId(hashTarget.targetId);
    };

    const handleHashChange = () => {
      scrollToHashTarget('smooth');
    };

    const hasBareDocumentationHash = window.location.hash === '#dokumentacja' || window.location.hash === '#dokumentacja/';

    if ((!window.location.hash || hasBareDocumentationHash) && allSections[0]) {
      window.location.hash = buildDocumentationHash(allSections[0].id);
    }

    window.requestAnimationFrame(() => {
      scrollToHashTarget('auto');
    });

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [allSections]);

  useEffect(() => {
    const sectionElements = allSections
      .map((section) => document.getElementById(section.id))
      .filter((element): element is HTMLElement => Boolean(element));

    if (sectionElements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);

        if (visibleEntries.length === 0) {
          return;
        }

        const nextActiveSection = visibleEntries[0].target.id;
        setActiveSectionId(nextActiveSection);
        setActiveTargetId((currentTargetId) => {
          if (!currentTargetId || currentTargetId === nextActiveSection) {
            return nextActiveSection;
          }

          const currentTargetElement = document.getElementById(currentTargetId);
          const ownerSection = currentTargetElement?.closest<HTMLElement>('[data-section-id]')?.dataset.sectionId;

          if (ownerSection === nextActiveSection) {
            return currentTargetId;
          }

          return nextActiveSection;
        });
      },
      {
        rootMargin: '-32% 0px -55% 0px',
        threshold: [0.1, 0.25, 0.5],
      },
    );

    sectionElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [allSections]);

  return (
    <main className={`app-shell docs-shell ${introAnimationEnabled ? 'docs-intro-run' : ''}`}>
      <DocumentationTopNav onBack={onBack} />
      <DocumentationHero totalSections={allSections.length} />
      <DocumentationSensorHub sensors={sensorsCatalog} />

      <div className="docs-layout">
        <DocumentationToc
          sections={allSections}
          activeSectionId={activeSectionId}
          activeTargetId={activeTargetId}
        />

        <div className="docs-sections" aria-label="Sekcje dokumentacji">
          {allSections.map((section, index) => (
            <DocumentationSectionCard
              key={section.id}
              section={section}
              index={index}
              anchorLookup={documentationAnchorLookup}
            />
          ))}
        </div>
      </div>
    </main>
  );
}

export default DocumentationPage;
