import { formatCell, type QueryResult } from '../sql/engine';
import { plural } from '../sql/compare';

export function ResultTable({ result, maxRows = 200 }: { result: QueryResult; maxRows?: number }) {
  const shown = result.rows.slice(0, maxRows);
  const n = result.rows.length;
  return (
    <div className="result">
      <div className="result-meta">
        {n} {plural(n, 'строка', 'строки', 'строк')} · {result.columns.length}{' '}
        {plural(result.columns.length, 'столбец', 'столбца', 'столбцов')} · {result.ms} мс
        {n > maxRows && <span className="muted"> — показаны первые {maxRows}</span>}
      </div>
      {n === 0 ? (
        <div className="result-empty">Запрос выполнен, но не вернул ни одной строки.</div>
      ) : (
        <div className="result-scroll">
          <table>
            <thead>
              <tr>
                <th className="rownum">#</th>
                {result.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, r) => (
                <tr key={r}>
                  <td className="rownum">{r + 1}</td>
                  {row.map((v, c) => (
                    <td key={c} className={v === null ? 'null' : typeof v === 'number' ? 'num' : undefined}>
                      {formatCell(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
