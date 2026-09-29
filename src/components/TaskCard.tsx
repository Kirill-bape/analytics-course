// Карточка задания: условие, редактор, запуск, проверка, подсказки и решение.

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CodeEditor, type EditorApi } from './CodeEditor';
import { ResultTable } from './ResultTable';
import { ErrorBox } from './ErrorBox';
import { MarkdownText } from './Markdown';
import { joinText, taskKey, type TaskDef, type Topic } from '../content';
import { useProgress } from '../progress';
import { getDbStatus, runQuery, subscribeDb, type QueryResult } from '../sql/engine';
import { explainError, type ExplainedError } from '../sql/errors';
import { expectedResult } from '../sql/expected';
import { compareResults, customMistakes, plural, styleNotes, type CheckOutcome } from '../sql/compare';

const ATTEMPTS_FOR_SOLUTION = 3;

type Feedback =
  | { kind: 'check'; outcome: CheckOutcome; extra: string[] }
  | { kind: 'error'; error: ExplainedError };

const DEFAULT_STARTER = '-- Напиши запрос ниже и нажми «Проверить»\n';

export function TaskCard({ topic, task, index }: { topic: Topic; task: TaskDef; index: number }) {
  const key = taskKey(topic, task);
  const { task: getTask, updateTask, markSolved, loaded } = useProgress();
  const tp = getTask(key);
  const starter = joinText(task.starter) || DEFAULT_STARTER;
  const solution = joinText(task.solution);

  const [code, setCode] = useState<string>(tp.code ?? starter);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const editorApi = useRef<EditorApi | null>(null);
  const db = useSyncExternalStore(subscribeDb, getDbStatus);
  const initialized = useRef(false);

  // Когда прогресс загрузился — подставляем сохранённый код
  useEffect(() => {
    if (loaded && !initialized.current) {
      initialized.current = true;
      if (tp.code !== undefined) setCode(tp.code);
    }
  }, [loaded, tp.code]);

  // Сохраняем черновик кода (с задержкой)
  useEffect(() => {
    if (!initialized.current || code === (tp.code ?? starter)) return;
    const t = setTimeout(() => updateTask(key, (p) => ({ ...p, code })), 800);
    return () => clearTimeout(t);
  }, [code, key, starter, tp.code, updateTask]);

  const ready = db.state === 'ready' && !busy;

  const run = async () => {
    if (!ready) return;
    const selected = editorApi.current?.getSelection().trim();
    const sql = selected || code;
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
    let userRes: QueryResult;
    try {
      userRes = await runQuery(code);
      setResult(userRes);
    } catch (e) {
      setResult(null);
      setFeedback({ kind: 'error', error: explainError(e, code) });
      updateTask(key, (p) => ({ ...p, attempts: p.solved ? p.attempts : p.attempts + 1, code }));
      setBusy(false);
      return;
    }
    try {
      const expected = await expectedResult(key, solution);
      const outcome = compareResults(userRes, expected, task, code, solution);
      if (outcome.ok) {
        updateTask(key, (p) => ({ ...p, code }));
        markSolved(key);
        setFeedback({ kind: 'check', outcome, extra: styleNotes(code) });
      } else {
        updateTask(key, (p) => ({ ...p, attempts: p.solved ? p.attempts : p.attempts + 1, code }));
        setFeedback({ kind: 'check', outcome, extra: customMistakes(code, task.mistakes) });
      }
    } catch (e) {
      setFeedback({
        kind: 'error',
        error: { title: 'Не удалось выполнить эталонное решение', text: 'Это ошибка в самом задании, а не у тебя. Сообщи о ней.', raw: String(e) },
      });
    } finally {
      setBusy(false);
    }
  };

  const hintsLeft = task.hints.length - tp.hintsShown;
  const solutionUnlocked = tp.attempts >= ATTEMPTS_FOR_SOLUTION || tp.solved;
  const attemptsToSolution = Math.max(0, ATTEMPTS_FOR_SOLUTION - tp.attempts);

  return (
    <section className={`task-card${tp.solved ? ' solved' : ''}`} id={`task-${task.id}`}>
      <header className="task-head">
        <div className="task-number">{tp.solved ? '✓' : index + 1}</div>
        <div className="task-title">
          <h3>{task.title}</h3>
          <div className="task-sub">
            <span className="difficulty" title="Сложность">
              {'★'.repeat(task.difficulty)}
              <span className="dim">{'★'.repeat(3 - task.difficulty)}</span>
            </span>
            {tp.solved && <span className="badge badge-success">{tp.usedSolution ? 'Решено с решением' : 'Решено'}</span>}
            {!tp.solved && tp.attempts > 0 && (
              <span className="badge">
                {tp.attempts} {plural(tp.attempts, 'попытка', 'попытки', 'попыток')}
              </span>
            )}
          </div>
        </div>
      </header>

      <MarkdownText text={joinText(task.prompt)} className="task-prompt markdown" />

      <CodeEditor value={code} onChange={setCode} onRun={run} onCheck={check} apiRef={editorApi} />

      <div className="task-actions">
        <button className="btn btn-secondary" onClick={run} disabled={!ready} title="Ctrl+Enter">
          ▶ Запустить
        </button>
        <button className="btn btn-primary" onClick={check} disabled={!ready} title="Ctrl+Shift+Enter">
          {busy ? 'Выполняется…' : db.state === 'loading' ? 'База загружается…' : '✓ Проверить'}
        </button>
        <span className="spacer" />
        <button
          className="btn btn-ghost"
          onClick={() => updateTask(key, (p) => ({ ...p, hintsShown: p.hintsShown + 1 }))}
          disabled={hintsLeft <= 0}
        >
          💡 {hintsLeft > 0 ? `Подсказка (${tp.hintsShown + 1} из ${task.hints.length})` : 'Подсказок больше нет'}
        </button>
        {!tp.solutionShown && !tp.solved && (
          <button
            className="btn btn-ghost"
            disabled={!solutionUnlocked}
            title={solutionUnlocked ? '' : 'Решение открывается после нескольких попыток'}
            onClick={() => updateTask(key, (p) => ({ ...p, solutionShown: true }))}
          >
            🔑 {solutionUnlocked ? 'Показать решение' : `Решение — через ${attemptsToSolution} ${plural(attemptsToSolution, 'попытку', 'попытки', 'попыток')}`}
          </button>
        )}
        {code !== starter && (
          <button className="btn btn-ghost" onClick={() => setCode(starter)} title="Вернуть начальный код">
            ↺
          </button>
        )}
      </div>
      <div className="shortcut-hint">Ctrl+Enter — запустить · Ctrl+Shift+Enter — проверить · выдели часть кода, чтобы запустить только её</div>

      {feedback?.kind === 'error' && <ErrorBox error={feedback.error} />}
      {feedback?.kind === 'check' && feedback.outcome.ok && (
        <div className="feedback feedback-success">
          <div className="feedback-title">🎉 Верно! Задание засчитано.</div>
          {tp.usedSolution && <div className="feedback-body">Решение было открыто — попробуй через пару дней решить это задание снова самостоятельно.</div>}
          {feedback.extra.map((d, i) => (
            <MarkdownText key={i} text={`📝 ${d}`} className="feedback-body markdown" />
          ))}
        </div>
      )}
      {feedback?.kind === 'check' && !feedback.outcome.ok && (
        <div className="feedback feedback-wrong">
          <div className="feedback-title">✗ {feedback.outcome.title}</div>
          {[...feedback.extra, ...feedback.outcome.details].map((d, i) => (
            <MarkdownText key={i} text={d} className="feedback-body markdown" />
          ))}
          {hintsLeft > 0 && tp.attempts >= 1 && <div className="feedback-body muted">Не получается? Нажми «💡 Подсказка».</div>}
        </div>
      )}

      {tp.hintsShown > 0 && (
        <div className="hints">
          {task.hints.slice(0, tp.hintsShown).map((h, i) => (
            <div className="hint" key={i}>
              <span className="hint-label">Подсказка {i + 1}</span>
              <MarkdownText text={h} className="markdown" />
            </div>
          ))}
        </div>
      )}

      {tp.solutionShown && !tp.solved && (
        <div className="solution">
          <div className="solution-label">🔑 Решение. Не копируй — перепиши его сам и нажми «Проверить», так оно лучше запомнится.</div>
          <CodeEditor value={solution} readOnly compact />
        </div>
      )}
      {tp.solved && (
        <details className="solution-details">
          <summary>Посмотреть эталонное решение</summary>
          <CodeEditor value={solution} readOnly compact />
          <p className="muted">Если твоё решение выглядит иначе, но засчитано — это нормально: в SQL одну задачу часто можно решить разными способами.</p>
        </details>
      )}

      {result && <ResultTable result={result} />}
    </section>
  );
}
