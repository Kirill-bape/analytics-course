// «Живой» пример в уроке: можно поменять запрос и запустить.

import { useState, useSyncExternalStore } from 'react';
import { CodeEditor } from './CodeEditor';
import { ResultTable } from './ResultTable';
import { Chart, chartFromComment } from './Chart';
import { ErrorBox } from './ErrorBox';
import { getDbStatus, runQuery, subscribeDb, type QueryResult } from '../sql/engine';
import { explainError, type ExplainedError } from '../sql/errors';

export function SqlExample({ code }: { code: string }) {
  const [value, setValue] = useState(code);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [busy, setBusy] = useState(false);
  const db = useSyncExternalStore(subscribeDb, getDbStatus);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await runQuery(value));
    } catch (e) {
      setResult(null);
      setError(explainError(e, value));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="example">
      <CodeEditor value={value} onChange={setValue} onRun={run} compact />
      <div className="example-actions">
        <button className="btn btn-small btn-primary" onClick={run} disabled={busy || db.state !== 'ready'}>
          {db.state === 'loading' ? 'База загружается…' : busy ? 'Выполняется…' : '▶ Запустить пример'}
        </button>
        {value !== code && (
          <button className="btn btn-small btn-ghost" onClick={() => setValue(code)}>
            ↺ Вернуть как было
          </button>
        )}
        {(result || error) && (
          <button
            className="btn btn-small btn-ghost"
            onClick={() => {
              setResult(null);
              setError(null);
            }}
          >
            Скрыть результат
          </button>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {result && chartFromComment(value) && <Chart spec={chartFromComment(value)!} columns={result.columns} rows={result.rows} />}
      {result && <ResultTable result={result} maxRows={20} />}
    </div>
  );
}
