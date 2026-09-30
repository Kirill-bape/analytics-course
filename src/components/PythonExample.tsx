// «Живой» пример на Python в уроке.

import { useState, useSyncExternalStore } from 'react';
import { CodeEditor } from './CodeEditor';
import { ErrorBox } from './ErrorBox';
import { PyOutput } from './PyOutput';
import { getPyStatus, runPython, subscribePy, type PyRunResult } from '../python/engine';
import { explainPythonError } from '../python/errors';
import type { ExplainedError } from '../sql/errors';

export function PythonExample({ code }: { code: string }) {
  const [value, setValue] = useState(code);
  const [run, setRun] = useState<PyRunResult | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [busy, setBusy] = useState(false);
  const py = useSyncExternalStore(subscribePy, getPyStatus);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      setRun(await runPython(value));
    } catch (e) {
      setRun(null);
      setError(explainPythonError(e));
    } finally {
      setBusy(false);
    }
  };

  const loading = py.state === 'loading';
  return (
    <div className="example">
      <CodeEditor value={value} onChange={setValue} onRun={go} compact language="python" />
      <div className="example-actions">
        <button className="btn btn-small btn-primary" onClick={go} disabled={busy}>
          {busy ? (loading ? (py.message ?? 'Запускаю Python…') : 'Выполняется…') : '▶ Запустить пример'}
        </button>
        {value !== code && (
          <button className="btn btn-small btn-ghost" onClick={() => setValue(code)}>
            ↺ Вернуть как было
          </button>
        )}
        {(run || error) && (
          <button
            className="btn btn-small btn-ghost"
            onClick={() => {
              setRun(null);
              setError(null);
            }}
          >
            Скрыть результат
          </button>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {run && <PyOutput run={run} maxRows={20} />}
    </div>
  );
}
