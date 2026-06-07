import { useEffect, useId, useRef, useState, type TableHTMLAttributes } from 'react';

const QUICK_FILTERS = ['GPIO', 'I2C', 'UART', 'WiFi', 'Bluetooth', 'MQTT'];

function DocumentationTable({ children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const [filterQuery, setFilterQuery] = useState('');
  const [visibleRows, setVisibleRows] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const tableRef = useRef<HTMLTableElement | null>(null);
  const filterId = useId();

  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) {
      return;
    }

    const query = filterQuery.trim().toLowerCase();
    const rows = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    let visibleCount = 0;

    rows.forEach((row) => {
      const rowText = row.textContent?.toLowerCase() ?? '';
      const visible = query.length === 0 || rowText.includes(query);

      row.hidden = !visible;
      row.classList.toggle('docs-row-hit', visible && query.length > 0);

      if (visible) {
        visibleCount += 1;
      }
    });

    setVisibleRows(visibleCount);
    setTotalRows(rows.length);
  }, [children, filterQuery]);

  return (
    <div className="docs-table-shell">
      <div className="docs-table-tools">
        <label htmlFor={filterId} className="docs-table-label">Filtr wierszy</label>
        <input
          id={filterId}
          className="docs-table-input"
          type="search"
          value={filterQuery}
          onChange={(event) => setFilterQuery(event.target.value)}
          placeholder="Wpisz GPIO, nazwe lub interfejs"
        />
        <button
          type="button"
          className="ghost-btn docs-table-clear"
          onClick={() => setFilterQuery('')}
          disabled={filterQuery.length === 0}
        >
          Wyczysc
        </button>
      </div>

      <div className="docs-table-chips" aria-label="Szybkie filtry tabeli">
        {QUICK_FILTERS.map((token) => {
          const active = filterQuery.toLowerCase() === token.toLowerCase();

          return (
            <button
              key={token}
              type="button"
              className={`docs-filter-chip ${active ? 'active' : ''}`}
              aria-pressed={active}
              onClick={() => setFilterQuery(active ? '' : token)}
            >
              {token}
            </button>
          );
        })}
      </div>

      <p className="docs-table-meta" role="status" aria-live="polite">
        Widoczne wiersze: {visibleRows} / {totalRows}
      </p>

      <div className="docs-table-scroll">
        <table ref={tableRef} className="docs-table" {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export default DocumentationTable;
