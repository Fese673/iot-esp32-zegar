interface DocumentationHeroProps {
  totalSections: number;
}

function DocumentationHero({ totalSections }: DocumentationHeroProps) {
  return (
    <section className="panel docs-hero">
      <div className="docs-hero-main">
        <p className="docs-hero-kicker mono">Wersja dla poczatkujacych i developerow</p>
        <h2>Dokumentacja techniczna podana warstwowo</h2>
        <p>
          Ten widok laczy kompletna tresc techniczna z czytelnym podzialem na sekcje.
          Kazdy blok mozesz rozwijac niezaleznie, bez przebudowy calej podstrony.
        </p>
      </div>

      <div className="docs-hero-chips" aria-label="Cechy dokumentacji">
        <span className="chip">Pelna tresc markdown 1:1</span>
        <span className="chip">Czytelny spis tresci</span>
        <span className="chip">Styl zgodny z dashboardem</span>
        <span className="chip">Sekcje: {totalSections}</span>
      </div>
    </section>
  );
}

export default DocumentationHero;
