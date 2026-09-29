// Служебная страница #/dev: проверяет, что у всех заданий эталонное решение
// работает, альтернативные решения принимаются, а типичные ошибки — нет.
// Полезно после добавления новых тем.

import { useState } from 'react';
import { allTopics, joinText, taskKey } from '../content';
import { formatCell, runQuery } from '../sql/engine';
import { compareResults } from '../sql/compare';
import { expectedResult } from '../sql/expected';

interface Row {
  task: string;
  rows: number;
  cols: number;
  status: 'ok' | 'fail';
  notes: string[];
}

export function DevPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const runAll = async () => {
    setRunning(true);
    const out: Row[] = [];
    for (const topic of allTopics.filter((t) => t.ready)) {
      for (const task of topic.tasks) {
        const key = taskKey(topic, task);
        const solution = joinText(task.solution);
        const row: Row = { task: key, rows: 0, cols: 0, status: 'ok', notes: [] };
        try {
          const exp = await expectedResult(key, solution);
          row.rows = exp.rows.length;
          row.cols = exp.columns.length;
          if (exp.rows.length === 0) {
            row.status = 'fail';
            row.notes.push('эталон вернул 0 строк');
          }
          for (const alt of task.selfTest?.correct ?? []) {
            const code = joinText(alt);
            try {
              const r = await runQuery(code);
              const c = compareResults(r, exp, task, code, solution);
              if (!c.ok) {
                row.status = 'fail';
                row.notes.push(`правильный вариант НЕ принят: ${code} → ${c.title}`);
              }
            } catch (e) {
              row.status = 'fail';
              row.notes.push(`правильный вариант упал: ${code} → ${String(e)}`);
            }
          }
          for (const bad of task.selfTest?.wrong ?? []) {
            const code = joinText(bad);
            try {
              const r = await runQuery(code);
              const c = compareResults(r, exp, task, code, solution);
              if (c.ok) {
                row.status = 'fail';
                row.notes.push(`ошибочный вариант ПРИНЯТ: ${code}`);
              } else {
                row.notes.push(`✗ ${code} → ${c.title} ${c.details.join(' | ')}`);
              }
            } catch (e) {
              row.notes.push(`✗ ${code} → ошибка: ${String((e as Error).message ?? e).slice(0, 120)}`);
            }
          }
        } catch (e) {
          row.status = 'fail';
          row.notes.push(`эталон упал: ${String(e)}`);
        }
        out.push(row);
        setRows([...out]);
      }
    }
    setRunning(false);
  };

  const runExamples = async () => {
    setRunning(true);
    const out: Row[] = [];
    for (const topic of allTopics.filter((t) => t.ready)) {
      const blocks = [...topic.lesson.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1]);
      for (const [i, code] of blocks.entries()) {
        const row: Row = { task: `${topic.key} пример ${i + 1}`, rows: 0, cols: 0, status: 'ok', notes: [] };
        try {
          const r = await runQuery(code);
          row.rows = r.rows.length;
          row.cols = r.columns.length;
          row.notes.push(`${r.columns.join(' | ')}  →  ${(r.rows[0] ?? []).map(formatCell).join(' | ')}`);
        } catch (e) {
          row.status = 'fail';
          row.notes.push(String((e as Error).message ?? e).slice(0, 200));
        }
        out.push(row);
        setRows([...out]);
      }
    }
    setRunning(false);
  };

  const failed = rows.filter((r) => r.status === 'fail').length;
  return (
    <div className="page">
      <h1>Проверка заданий</h1>
      <p className="muted">Служебная страница для автора курса.</p>
      <button className="btn btn-primary" onClick={runAll} disabled={running}>
        {running ? 'Проверяю…' : 'Проверить все задания'}
      </button>{' '}
      <button className="btn btn-secondary" onClick={runExamples} disabled={running}>
        Проверить примеры из уроков
      </button>
      {rows.length > 0 && (
        <p id="dev-summary">
          Проверено: {rows.length}, с ошибками: {failed}
        </p>
      )}
      <table className="dev-table">
        <tbody>
          {rows.map((r) => (
            <tr key={r.task} className={r.status}>
              <td>{r.status === 'ok' ? '✅' : '❌'}</td>
              <td>
                <code>{r.task}</code>
              </td>
              <td>
                {r.rows}×{r.cols}
              </td>
              <td className="small">
                {r.notes.map((n, i) => (
                  <div key={i}>{n}</div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
