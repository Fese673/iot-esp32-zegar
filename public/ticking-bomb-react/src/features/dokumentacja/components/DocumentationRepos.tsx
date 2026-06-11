import { reposCatalog } from '../data/reposCatalog';

function DocumentationRepos() {
  return (
    <section className="panel docs-repos">
      <header className="docs-repos-head">
        <p className="eyebrow mono">Kody źródłowe</p>
        <h2>Repozytoria projektu</h2>
        <p className="muted">
          Projekt ZEGAR-ESP32 powstawał od podstaw jako kompletny system IoT
          — od firmware'u po panel webowy. Wszystkie repozytoria są otwarte i dostępne na GitHubie.
        </p>
      </header>

      <div className="docs-repos-grid">
        {reposCatalog.map((repo) => {
          const isPrimary = repo.primary;

          return (
            <article
              key={repo.id}
              className={`docs-repo-card${isPrimary ? ' primary' : ''}`}
            >
              <div className={`docs-repo-accent${isPrimary ? ' primary' : ''}`} />

              <div className="docs-repo-body">
                <p className="docs-repo-tag mono">{repo.tag}</p>
                <h3 className="docs-repo-name">{repo.name}</h3>
                <p className="docs-repo-desc">{repo.description}</p>

                <a
                  href={repo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ghost-btn"
                >
                  Otwórz na GitHubie →
                </a>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default DocumentationRepos;
