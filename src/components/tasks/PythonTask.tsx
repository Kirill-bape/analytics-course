import { useEffect, useState, useSyncExternalStore } from 'react';
import { CodeEditor } from '../CodeEditor';
import { PyOutput } from '../PyOutput';
import { Feedback, type FeedbackState } from './Feedback';
import type { TaskBodyProps } from './types';
import { joinText } from '../../content';
import { ensurePython, getPyStatus, runPython, subscribePy, type PyRunResult } from '../../python/engine';
import { explainPythonError } from '../../python/errors';
import { checkPython } from '../../python/check';

export function PythonTask({ task, taskKey, tp, fail, succeed, saveDraft }: TaskBodyProps) {
  const starter = joinText(task.starter) || '# Напиши код ниже и нажми «Проверить»\n';
  const [code, setCode] = useState<string>(tp.code ?? starter);
  const [run, setRun] = useState<PyRunResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [busy, setBusy] = useState(false);
  const py = useSyncExternalStore(subscribePy, getPyStatus);

  useEffect(() => {
    ensurePython().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (code === (tp.code ?? starter)) return;
    const t = setTimeout(() => saveDraft(code), 800);
    return () => clearTimeout(t);
  }, [code, starter, tp.code, saveDraft]);

  const doRun = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      setRun(await runPython(code, { resultVar: task.resultVar ?? 'result' }));
    } catch (e) {
      setRun(null);
      setFeedback({ kind: 'error', error: explainPythonError(e) });
    } finally {
      setBusy(false);
    }
  };

  const doCheck = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { run: r, outcome } = await checkPython(task, taskKey, code);
      setRun(r);
      if (outcome.ok) {
        succeed(code);
        setFeedback({ kind: 'ok' });
      } else {
        fail(code);
        setFeedback({ kind: 'wrong', title: outcome.title, details: outcome.details });
      }
    } catch (e) {
      setRun(null);
      fail(code);
      setFeedback({ kind: 'error', error: explainPythonError(e) });
    } finally {
      setBusy(false);
    }
  };

  const loading = py.state === 'loading' || py.state === 'idle';
  const label = busy ? (loading ? py.message ?? 'Запускаю Python…' : 'Выполняется…') : '✓ Проверить';

  return (
    <>
      <CodeEditor value={code} onChange={setCode} onRun={doRun} onCheck={doCheck} language="python" />
      <div className="task-actions">
        <button className="btn btn-secondary" onClick={doRun} disabled={busy} title="Ctrl+Enter">
          ▶ Запустить
        </button>
        <button className="btn btn-primary" onClick={doCheck} disabled={busy} title="Ctrl+Shift+Enter">
          {label}
        </button>
        {code !== starter && (
          <button className="btn btn-ghost" onClick={() => setCode(starter)} title="Вернуть начальный код">
            ↺ Сначала
          </button>
        )}
      </div>
      <div className="shortcut-hint">
        {py.state === 'error'
          ? `Python не запустился: ${py.message}`
          : loading
            ? `${py.message ?? 'Python загружается'}… Первый запуск занимает 10–30 секунд.`
            : 'Ctrl+Enter — запустить · Ctrl+Shift+Enter — проверить · последняя строка кода показывается как результат'}
      </div>
      <Feedback state={feedback} usedSolution={tp.usedSolution} />
      {run && <PyOutput run={run} />}
    </>
  );
}
