import { useMemo, useState } from 'react';
import type { SensorCatalogItem } from '../data/sensorsCatalog';

interface DocumentationSensorHubProps {
  sensors: SensorCatalogItem[];
}

function DocumentationSensorHub({ sensors }: DocumentationSensorHubProps) {
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const imageFallback = useMemo(
    () => ({
      title: 'Dodaj zdjecie sensora',
      hint: 'Podmien imagePath w sensorsCatalog.ts na docelowa grafike.',
    }),
    [],
  );

  return (
    <section className="panel docs-sensor-hub">
      <header className="docs-sensor-hub-head">
        <p className="eyebrow mono">Sekcja startowa</p>
        <h2>Sensory i dokumentacje producentow</h2>
        <p className="muted">
          To miejsce jest celowo wydzielone na zdjecia, linki zrodlowe i szybkie wyjasnienie,
          co mierzy kazdy modul w Twoim projekcie.
        </p>
      </header>

      <div className="docs-sensor-grid">
        {sensors.map((sensor) => {
          const shouldShowImage = !brokenImages[sensor.id];

          return (
            <article key={sensor.id} className="docs-sensor-card">
              <div className="docs-sensor-media">
                {shouldShowImage ? (
                  <img
                    src={sensor.imagePath}
                    alt={`${sensor.name} - miejsce na zdjecie`}
                    loading="lazy"
                    onError={() => {
                      setBrokenImages((previous) => ({ ...previous, [sensor.id]: true }));
                    }}
                  />
                ) : (
                  <div className="docs-sensor-placeholder" role="img" aria-label={imageFallback.title}>
                    <p>{imageFallback.title}</p>
                    <p>{imageFallback.hint}</p>
                  </div>
                )}
              </div>

              <div className="docs-sensor-body">
                <p className="docs-sensor-role mono">{sensor.role}</p>
                <h3>{sensor.name}</h3>
                <p>{sensor.shortDescription}</p>
                <p className="docs-sensor-highlights">{sensor.highlights.join(' • ')}</p>
                <a href={sensor.docsUrl} target="_blank" rel="noreferrer" className="ghost-btn">
                  Otworz oficjalna dokumentacje
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default DocumentationSensorHub;
