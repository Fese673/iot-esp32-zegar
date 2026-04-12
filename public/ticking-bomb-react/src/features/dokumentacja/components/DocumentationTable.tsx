import { useEffect, useId, useRef, useState, type TableHTMLAttributes } from 'react';

function DocumentationTable({ children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  const [filterQuery, setFilterQuery] = useState('');
  const tableRef = useRef<HTMLTableElement | null>(null);
  const filterId = useId();

  useEffect(() => {
    const tableElement = tableRef.current;
    if (!tableElement) {
      return;
    }

    const query = filterQuery.trim().toLowerCase();
    const rows = Array.from(tableElement.querySelectorAll<HTMLTableRowElement>('tbody tr'));

    rows.forEach((row) => {
      const rowText = row.textContent?.toLowerCase() ?? '';
      const visible = query.length === 0 || rowText.includes(query);
      row.style.display = visible ? '' : 'none';
    });
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
      </div>

      <div className="docs-table-scroll">
        <table ref={tableRef} className="docs-table" {...props}>
          {children}
        </table>
      </div>
    </div>
  );
}

export default DocumentationTable;
