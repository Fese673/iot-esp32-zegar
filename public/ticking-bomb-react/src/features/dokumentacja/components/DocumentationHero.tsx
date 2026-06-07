interface DocumentationHeroProps {
  totalSections: number;
}

function DocumentationHero({ totalSections }: DocumentationHeroProps) {
  return (
    <section className="panel docs-hero">
      <div className="docs-hero-main">
        <p className="docs-hero-kicker mono">Dokumentacja techniczna</p>
        <h2>Architektura systemu ZEGAR-ESP32</h2>
        <p>
          Modułowy projekt embedded — sensory, wyświetlacze i komunikację można odłączać i podłączać
          bez przebudowy reszty systemu. Główny HMI: Guition ESP32-S3 JC8048W550 (5" IPS 800×480).
        </p>
      </div>

      <div className="docs-hero-chips" aria-label="Cechy dokumentacji">
        <span className="chip">Modularna architektura</span>
        <span className="chip">Hot-plug sensory</span>
        <span className="chip">Główny HMI: JC8048W550</span>
        <span className="chip">Sekcje: {totalSections}</span>
      </div>
    </section>
  );
}

export default DocumentationHero;
