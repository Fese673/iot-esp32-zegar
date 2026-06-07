// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import DocumentationPage from '../DocumentationPage';

vi.mock('../../lib/markdownLoader', () => {
  const sections = [
    {
      id: 'sekcja-start',
      title: 'Sekcja start',
      markdown: '### Podrozdzial\nOpis',
      subheadings: [{ id: 'sekcja-start-podrozdzial', title: 'Podrozdzial', anchor: 'podrozdzial' }],
      order: 0,
    },
    {
      id: 'druga-sekcja',
      title: 'Druga sekcja',
      markdown: '### Drugi podrozdzial\nOpis',
      subheadings: [{ id: 'druga-sekcja-drugi-podrozdzial', title: 'Drugi podrozdzial', anchor: 'drugi-podrozdzial' }],
      order: 1,
    },
  ];

  return {
    documentationSections: sections,
    documentationAnchorLookup: {},
  };
});

vi.mock('../DocumentationTopNav', () => ({
  default: () => <header data-testid="top-nav">Top nav</header>,
}));

vi.mock('../DocumentationHero', () => ({
  default: () => <section data-testid="hero">Hero</section>,
}));

vi.mock('../DocumentationSensorHub', () => ({
  default: () => <section data-testid="sensor-hub">Sensor hub</section>,
}));

vi.mock('../DocumentationToc', () => ({
  default: () => <aside data-testid="toc">ToC</aside>,
}));

vi.mock('../DocumentationSectionCard', () => ({
  default: ({ section }: { section: { id: string; subheadings: Array<{ id: string }> } }) => (
    <section id={section.id} data-section-id={section.id}>
      <h3 id={section.subheadings[0]?.id}>Podrozdzial</h3>
    </section>
  ),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalMatchMedia = window.matchMedia;

describe('DocumentationPage', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: query.includes('min-width: 961px'),
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });

    window.requestAnimationFrame = (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    };
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.matchMedia = originalMatchMedia;
    window.location.hash = '';
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test('normalizes bare documentation hash and scrolls to first section', async () => {
    window.location.hash = '#dokumentacja';
    const scrolledTargetIds: string[] = [];

    const scrollMock = vi.fn(function (this: HTMLElement) {
      scrolledTargetIds.push(this.id);
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollMock,
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DocumentationPage onBack={() => undefined} />);
    });

    expect(window.location.hash).toBe('#dokumentacja/sekcja-start');
    expect(scrolledTargetIds).toContain('sekcja-start');
    expect(scrollMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });

  test('scrolls to subsection target from hash path', async () => {
    window.location.hash = '#dokumentacja/sekcja-start/sekcja-start-podrozdzial';
    const scrolledTargetIds: string[] = [];

    const scrollMock = vi.fn(function (this: HTMLElement) {
      scrolledTargetIds.push(this.id);
    });

    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollMock,
    });

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<DocumentationPage onBack={() => undefined} />);
    });

    expect(scrolledTargetIds).toContain('sekcja-start-podrozdzial');
    expect(scrollMock).toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
