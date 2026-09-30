// Показ результата Python-кода: вывод print, значение последней строки, графики.

import type { PyRunResult } from '../python/engine';
import { ResultTable } from './ResultTable';

export function PyOutput({ run, maxRows = 200 }: { run: PyRunResult; maxRows?: number }) {
  const hasAnything = run.stdout || run.display || run.figures.length;
  return (
    <div className="py-output">
      {run.stdout && (
        <div className="py-stdout">
          <div className="result-meta">Вывод</div>
          <pre>{run.stdout}</pre>
        </div>
      )}
      {run.display?.kind === 'table' && (
        <ResultTable result={{ columns: run.display.columns, rows: run.display.rows, ms: run.ms }} maxRows={maxRows} total={run.display.total} />
      )}
      {run.display?.kind === 'text' && (
        <div className="py-stdout">
          <div className="result-meta">Значение</div>
          <pre>{run.display.text}</pre>
        </div>
      )}
      {run.figures.map((src, i) => (
        <img key={i} className="py-figure" src={`data:image/png;base64,${src}`} alt={`График ${i + 1}`} />
      ))}
      {!hasAnything && <div className="result-empty">Код выполнен ({run.ms} мс), но ничего не вывел. Чтобы увидеть результат, используй `print(...)` или напиши переменную последней строкой.</div>}
    </div>
  );
}
