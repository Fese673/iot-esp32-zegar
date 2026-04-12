import { useEffect, useMemo, useState } from 'react';
import 'highlight.js/styles/github-dark.css';
import { sensorsCatalog } from '../data/sensorsCatalog';
import { documentationSections } from '../lib/markdownLoader';
import DocumentationHero from './DocumentationHero';
import DocumentationSectionCard from './DocumentationSectionCard';
import DocumentationSensorHub from './DocumentationSensorHub';
import DocumentationToc from './DocumentationToc';
import DocumentationTopNav from './DocumentationTopNav';
import '../styles/dokumentacja.css';

interface DocumentationPageProps {
  onBack: () => void;
}

const DOCUMENTATION_HASH_PREFIX = '#dokumentacja';

function extractSectionIdFromHash(hash: string): string | null {
  if (!hash.startsWith(`${DOCUMENTATION_HASH_PREFIX}/`)) {
    return null;
  }

  const sectionId = decodeURIComponent(hash.slice(`${DOCUMENTATION_HASH_PREFIX}/`.length));
  return sectionId || null;
}

function DocumentationPage({ onBack }: DocumentationPageProps) {
  const [activeSectionId, setActiveSectionId] = useState<string | null>(
    documentationSections[0]?.id ?? null,
  );

  const allSections = useMemo(() => documentationSections, []);

  useEffect(() => {
    const scrollToHashTarget = (scrollBehavior: ScrollBehavior) => {
      const sectionId = extractSectionIdFromHash(window.location.hash);
      if (!sectionId) {
        return;
      }

      const sectionElement = document.getElementById(sectionId);
      if (!sectionElement) {
        return;
      }

      sectionElement.scrollIntoView({ behavior: scrollBehavior, block: 'start' });
      setActiveSectionId(sectionId);
    };

    const handleHashChange = () => {
      scrollToHashTarget('smooth');
    };

    window.requestAnimationFrame(() => {
      scrollToHashTarget('auto');
    });

    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

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

        setActiveSectionId(visibleEntries[0].target.id);
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
    <main className="app-shell docs-shell">
      <DocumentationTopNav onBack={onBack} totalSections={allSections.length} />
      <DocumentationHero totalSections={allSections.length} />
      <DocumentationSensorHub sensors={sensorsCatalog} />

      <div className="docs-layout">
        <DocumentationToc sections={allSections} activeSectionId={activeSectionId} />

        <div className="docs-sections" aria-label="Sekcje dokumentacji">
          {allSections.map((section, index) => (
            <DocumentationSectionCard key={section.id} section={section} index={index} />
          ))}
        </div>
      </div>
    </main>
  );
}

export default DocumentationPage;
