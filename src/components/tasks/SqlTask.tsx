import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CodeEditor, type EditorApi } from '../CodeEditor';
import { ResultTable } from '../ResultTable';
import { Chart } from '../Chart';
import { Feedback, type FeedbackState } from './Feedback';
import type { TaskBodyProps } from './types';
import { joinText } from '../../content';
import { getDbStatus, runQuery, subscribeDb, type QueryResult } from '../../sql/engine';
import { explainError } from '../../sql/errors';
import { expectedResult } from '../../sql/expected';
import { compareResults, customMistakes, styleNotes } from '../../sql/compare';

const DEFAULT_STARTER = '-- Напиши запрос ниже и нажми «Проверить»\n';

export function SqlTask({ task, taskKey, tp, fail, succeed, saveDraft }: TaskBodyProps) {
  const starter = joinText(task.starter) || DEFAULT_STARTER;
  const solution = joinText(task.solution);
  const [code, setCode] = useState<string>(tp.code ?? starter);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [busy, setBusy] = useState(false);
  const editor = useRef<EditorApi | null>(null);
  const db = useSyncExternalStore(subscribeDb, getDbStatus);

  useEffect(() => {
    if (code === (tp.code ?? starter)) return;
    const t = setTimeout(() => saveDraft(code), 800);
    return () => clearTimeout(t);
  }, [code, starter, tp.code, saveDraft]);

  const ready = db.state === 'ready' && !busy;

  const run = async () => {
    if (!ready) return;
    const sql = editor.current?.getSelection().trim() || code;
    setBusy(true);
    setFeedback(null);
    try {
      setResult(await runQuery(sql));
    } catch (e) {
      setResult(null);
      setFeedback({ kind: 'error', error: explainError(e, sql) });
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    if (!ready) return;
    setBusy(true);
    setFeedback(null);
    try {
      let user: QueryResult;
      try {
        user = await runQuery(code);
        setResult(user);
      } catch (e) {
        setResult(null);
        setFeedback({ kind: 'error', error: explainError(e, code) });
        fail(code);
        return;
      }
      const expected = await expectedResult(taskKey, solution);
      const outcome = compareResults(user, expected, task, code, solution, 'sql');
      if (outcome.ok) {
        succeed(code);
        setFeedback({ kind: 'ok', notes: styleNotes(code) });
      } else {
        fail(code);
        setFeedback({ kind: 'wrong', title: outcome.title, details: [...customMistakes(code, task.mistakes), ...outcome.details] });
      }
    } catch (e) {
      setFeedback({ kind: 'error', error: { title: 'Не удалось выполнить эталонное решение', text: 'Это ошибка в самом задании, а не у тебя.', raw: String(e) } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <CodeEditor value={code} onChange={setCode} onRun={run} onCheck={check} apiRef={editor} />
      <div className="task-actions">
        <button className="btn btn-secondary" onClick={run} disabled={!ready} title="Ctrl+Enter">
          ▶ Запустить
        </button>
        <button className="btn btn-primary" onClick={check} disabled={!ready} title="Ctrl+Shift+Enter">
          {busy ? 'Выполняется…' : db.state === 'loading' ? 'База загружается…' : '✓ Проверить'}
        </button>
        {code !== starter && (
          <button className="btn btn-ghost" onClick={() => setCode(starter)} title="Вернуть начальный код">
            ↺ Сначала
          </button>
        )}
      </div>
      <div className="shortcut-hint">Ctrl+Enter — запустить · Ctrl+Shift+Enter — проверить · выдели часть кода, чтобы запустить только её</div>
      <Feedback state={feedback} usedSolution={tp.usedSolution} />
      {result && task.chart && <Chart spec={task.chart} columns={result.columns} rows={result.rows} />}
      {result && <ResultTable result={result} />}
    </>
  );
}
