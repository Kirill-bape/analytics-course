// Панель «Схема данных»: какие таблицы и столбцы есть в базе.

import { useState } from 'react';
import { tables } from '../content';

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
        <p className="muted small">База интернет-магазина. Нажми на таблицу, чтобы увидеть её столбцы.</p>
        {tables.map((t) => (
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
        <div className="schema-links small">
          <b>Как связаны таблицы:</b>
          <br />
          <code>orders.customer_id</code> → <code>customers.customer_id</code>
          <br />
          <code>order_items.order_id</code> → <code>orders.order_id</code>
          <br />
          <code>order_items.product_id</code> → <code>products.product_id</code>
        </div>
      </aside>
    </>
  );
}
