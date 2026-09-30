// Общая карточка задания: заголовок, условие, подсказки, решение.
// Само задание (редактор, тест, таблица…) рисует компонент нужного типа.

import { useCallback, type ComponentType } from 'react';
import { CodeEditor } from '../CodeEditor';
import { MarkdownText } from '../Markdown';
import { joinText, taskKey, type TaskDef, type TaskType, type Topic } from '../../content';
import { useProgress } from '../../progress';
import { plural } from '../../sql/compare';
import type { TaskBodyProps } from './types';
import { SqlTask } from './SqlTask';
import { PythonTask } from './PythonTask';
import { QuizTask } from './QuizTask';
import { NumberTask } from './NumberTask';
import { SheetTask } from './SheetTask';
import { ChecklistTask } from './ChecklistTask';

const BODIES: Record<TaskType, ComponentType<TaskBodyProps>> = {
  sql: SqlTask,
  python: PythonTask,
  quiz: QuizTask,
  number: NumberTask,
  sheet: SheetTask,
  checklist: ChecklistTask,
};

const TYPE_LABEL: Record<TaskType, string> = {
  sql: 'SQL',
  python: 'Python',
  quiz: 'Тест',
  number: 'Ответ-число',
  sheet: 'Таблица',
  checklist: 'Чек-лист',
};

function SolutionView({ task }: { task: TaskDef }) {
  const type = task.type ?? 'sql';
  if (type === 'sql' || type === 'python') {
    return <CodeEditor value={joinText(task.solution)} readOnly compact language={type} />;
  }
  if (type === 'sheet' && task.sheet) {
    return (
      <ul className="sheet-solution">
        {task.sheet.checks.map((c) => {
          const [a, b] = c.range.split(':');
          return (
            <li key={c.range}>
              <code>{a}</code>: <code>{c.formula}</code>
              {b && (
                <>
                  {' '}
                  → протянуть до <code>{b}</code>
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  }
  return null;
}

export function TaskCard({ topic, task, index }: { topic: Topic; task: TaskDef; index: number }) {
  const key = taskKey(topic, task);
  const { task: getTask, updateTask, markSolved, loaded } = useProgress();
  const tp = getTask(key);
  const type = task.type ?? 'sql';
  const Body = BODIES[type];

  const fail = useCallback(
    (code?: string) => updateTask(key, (p) => ({ ...p, attempts: p.solved ? p.attempts : p.attempts + 1, ...(code !== undefined ? { code } : {}) })),
    [key, updateTask],
  );
  const succeed = useCallback(
    (code?: string) => {
      if (code !== undefined) updateTask(key, (p) => ({ ...p, code }));
      markSolved(key);
    },
    [key, updateTask, markSolved],
  );
  const saveDraft = useCallback((code: string) => updateTask(key, (p) => ({ ...p, code })), [key, updateTask]);

  const hasSolution = type !== 'checklist';
  const attemptsNeeded = type === 'quiz' ? 2 : 3;
  const solutionUnlocked = tp.attempts >= attemptsNeeded || tp.solved;
  const left = Math.max(0, attemptsNeeded - tp.attempts);
  const hintsLeft = task.hints.length - tp.hintsShown;
  const showSolution = tp.solutionShown || tp.solved;
  const explanation = joinText(task.explanation);

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
            <span className="badge badge-type">{TYPE_LABEL[type]}</span>
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

      {loaded ? (
        <Body task={task} taskKey={key} tp={tp} showSolution={showSolution} fail={fail} succeed={succeed} saveDraft={saveDraft} />
      ) : (
        <div className="muted small">Загружаю прогресс…</div>
      )}

      {(task.hints.length > 0 || hasSolution) && !tp.solved && (
        <div className="task-help">
          {task.hints.length > 0 && (
            <button className="btn btn-ghost btn-small" onClick={() => updateTask(key, (p) => ({ ...p, hintsShown: p.hintsShown + 1 }))} disabled={hintsLeft <= 0}>
              💡 {hintsLeft > 0 ? `Подсказка (${tp.hintsShown + 1} из ${task.hints.length})` : 'Подсказок больше нет'}
            </button>
          )}
          {hasSolution && !tp.solutionShown && (
            <button
              className="btn btn-ghost btn-small"
              disabled={!solutionUnlocked}
              title={solutionUnlocked ? '' : 'Решение открывается после нескольких попыток'}
              onClick={() => updateTask(key, (p) => ({ ...p, solutionShown: true }))}
            >
              🔑 {solutionUnlocked ? 'Показать решение' : `Решение — через ${left} ${plural(left, 'попытку', 'попытки', 'попыток')}`}
            </button>
          )}
        </div>
      )}

      {tp.hintsShown > 0 && !tp.solved && (
        <div className="hints">
          {task.hints.slice(0, tp.hintsShown).map((h, i) => (
            <div className="hint" key={i}>
              <span className="hint-label">Подсказка {i + 1}</span>
              <MarkdownText text={h} className="markdown" />
            </div>
          ))}
        </div>
      )}

      {tp.solutionShown && !tp.solved && (type === 'sql' || type === 'python' || type === 'sheet') && (
        <div className="solution">
          <div className="solution-label">🔑 Решение. Не копируй — перепиши его сам и нажми «Проверить», так оно лучше запомнится.</div>
          <SolutionView task={task} />
        </div>
      )}

      {tp.solved && (type === 'sql' || type === 'python' || type === 'sheet') && (
        <details className="solution-details">
          <summary>Посмотреть эталонное решение</summary>
          <SolutionView task={task} />
          <p className="muted small">Если твоё решение выглядит иначе, но засчитано — это нормально: одну задачу часто можно решить разными способами.</p>
        </details>
      )}

      {explanation && showSolution && (
        <div className="explanation">
          <span className="hint-label">Разбор</span>
          <MarkdownText text={explanation} className="markdown" />
        </div>
      )}
    </section>
  );
}
