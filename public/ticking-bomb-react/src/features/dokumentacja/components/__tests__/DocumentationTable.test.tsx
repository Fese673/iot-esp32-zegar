// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';
import DocumentationTable from '../DocumentationTable';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DocumentationTable', () => {
  test('filters table rows with input and quick chips', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <DocumentationTable>
          <thead>
            <tr>
              <th>Nazwa</th>
              <th>Interfejs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PMS5003</td>
              <td>UART</td>
            </tr>
            <tr>
              <td>ENS160</td>
              <td>I2C</td>
            </tr>
            <tr>
              <td>Przycisk</td>
              <td>GPIO</td>
            </tr>
          </tbody>
        </DocumentationTable>,
      );
    });

    const rows = Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody tr'));
    const filterInput = container.querySelector<HTMLInputElement>('.docs-table-input');
    const clearButton = container.querySelector<HTMLButtonElement>('.docs-table-clear');

    expect(filterInput).not.toBeNull();
    expect(clearButton).not.toBeNull();
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => !row.hidden)).toBe(true);

    await act(async () => {
      if (!filterInput) {
        return;
      }

      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;

      valueSetter?.call(filterInput, 'UART');
      filterInput.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'UART' }));
    });

    expect(filterInput?.value).toBe('UART');

    expect(rows[0].hidden).toBe(false);
    expect(rows[1].hidden).toBe(true);
    expect(rows[2].hidden).toBe(true);
    expect(container.querySelector('.docs-table-meta')?.textContent).toContain('1 / 3');

    const gpioChip = Array.from(container.querySelectorAll<HTMLButtonElement>('.docs-filter-chip'))
      .find((button) => button.textContent?.trim() === 'GPIO');

    expect(gpioChip).not.toBeUndefined();

    await act(async () => {
      gpioChip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(filterInput?.value).toBe('GPIO');
    expect(rows[0].hidden).toBe(true);
    expect(rows[1].hidden).toBe(true);
    expect(rows[2].hidden).toBe(false);

    await act(async () => {
      clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(rows.every((row) => !row.hidden)).toBe(true);
    expect(filterInput?.value).toBe('');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
