// Панель «Схема данных»: какие таблицы и столбцы есть в базе.

import { useState } from 'react';
import { tableGroups, tables } from '../content';

const LINKS: Record<string, [string, string][]> = {
  shop: [
    ['orders.customer_id', 'customers.customer_id'],
    ['order_items.order_id', 'orders.order_id'],
    ['order_items.product_id', 'products.product_id'],
  ],
  factory: [
    ['production.line_id', 'production_lines.line_id'],
    ['production.operator_id', 'operators.operator_id'],
    ['operators.line_id', 'production_lines.line_id'],
  ],
  ab: [],
};

export function SchemaPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(tables[0]?.name ?? null);
  return (
    <>
      <div className={`drawer-backdrop${open ? ' open' : ''}`} onClick={onClose} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h2>🗂 Схема данных</h2>
          <button className="btn btn-ghost btn-small" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>
        <p className="muted small">
          Нажми на таблицу, чтобы увидеть её столбцы. В SQL таблицы доступны по имени, в Python — как готовые DataFrame с теми же именами (например, <code>orders</code>).
        </p>
        {tableGroups.map((g) => (
          <div key={g.id} className="schema-group">
            <h3>{g.title}</h3>
            {tables
              .filter((t) => t.group === g.id)
              .map((t) => (
                <div className="schema-table" key={t.name}>
                  <button className="schema-table-head" onClick={() => setExpanded(expanded === t.name ? null : t.name)}>
                    <span className="schema-name">{t.name}</span>
                    <span className="muted">{t.title}</span>
                    <span className="chev">{expanded === t.name ? '▾' : '▸'}</span>
                  </button>
                  {expanded === t.name && (
                    <div className="schema-body">
                      <p className="small">{t.description}</p>
                      <table className="schema-cols">
                        <tbody>
                          {t.columns.map((c) => (
                            <tr key={c.name}>
                              <td>
                                <code>{c.name}</code>
                                <div className="col-type">{c.type}</div>
                              </td>
                              <td className="small">{c.description}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            {LINKS[g.id]?.length > 0 && (
              <div className="schema-links small">
                <b>Связи:</b>
                {LINKS[g.id].map(([a, b]) => (
                  <div key={a}>
                    <code>{a}</code> → <code>{b}</code>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>
    </>
  );
}
