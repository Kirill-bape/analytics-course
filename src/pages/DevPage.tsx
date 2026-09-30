// Служебная страница #/dev: проверяет все задания и примеры курса.
// Для каждого задания: эталон работает, правильные варианты принимаются,
// типичные ошибки отклоняются. Полезно после добавления новых тем.

import { useState } from 'react';
import { allTopics, joinText, modules, taskKey, type TaskDef } from '../content';
import { formatCell, runQuery } from '../sql/engine';
import { compareResults } from '../sql/compare';
import { expectedResult } from '../sql/expected';
import { runPython } from '../python/engine';
import { checkPython, pythonExpected } from '../python/check';
import { judgeNumber, numberAnswer } from '../components/tasks/NumberTask';
import { checkSheet, expectedSheet, sheetBase } from '../components/tasks/SheetTask';
import { cell, fillDown, parseAddr, parseRange, toEngine } from '../sheet/formulas';

interface Row {
  task: string;
  size: string;
  status: 'ok' | 'fail';
  notes: string[];
}

async function checkTask(key: string, task: TaskDef): Promise<Row> {
  const type = task.type ?? 'sql';
  const row: Row = { task: `${key} [${type}]`, size: '', status: 'ok', notes: [] };
  const bad = (n: string) => {
    row.status = 'fail';
    row.notes.push(n);
  };
  const variants = (arr?: (string | string[])[]) => (arr ?? []).map(joinText);

  if (type === 'sql') {
    const solution = joinText(task.solution);
    const exp = await expectedResult(key, solution);
    row.size = `${exp.rows.length}×${exp.columns.length}`;
    if (!exp.rows.length) bad('эталон вернул 0 строк');
    for (const code of variants(task.selfTest?.correct)) {
      try {
        const c = compareResults(await runQuery(code), exp, task, code, solution, 'sql');
        if (!c.ok) bad(`правильный вариант НЕ принят: ${code} → ${c.title}`);
      } catch (e) {
        bad(`правильный вариант упал: ${code} → ${String(e)}`);
      }
    }
    for (const code of variants(task.selfTest?.wrong)) {
      try {
        const c = compareResults(await runQuery(code), exp, task, code, solution, 'sql');
        if (c.ok) bad(`ошибочный вариант ПРИНЯТ: ${code}`);
        else row.notes.push(`✗ ${code} → ${c.title} ${c.details.join(' | ')}`);
      } catch (e) {
        row.notes.push(`✗ ${code} → ошибка: ${String((e as Error).message ?? e).slice(0, 120)}`);
      }
    }
  } else if (type === 'python') {
    const exp = await pythonExpected(key, task);
    row.size = exp.result ? `${exp.result.total}×${exp.result.columns.length}` : exp.figures.length ? `${exp.figures.length} граф.` : `${exp.stdout.split('\n').length} стр. вывода`;
    if ((task.check ?? 'result') === 'result' && !exp.hasResult) bad('в эталоне нет переменной result');
    if (task.check === 'plot' && !exp.figures.length) bad('эталон не построил график');
    const selfCheck = await checkPython(task, key, joinText(task.solution));
    if (!selfCheck.outcome.ok) bad(`эталон не проходит свою же проверку: ${selfCheck.outcome.title}`);
    for (const code of variants(task.selfTest?.correct)) {
      try {
        const { outcome } = await checkPython(task, key, code);
        if (!outcome.ok) bad(`правильный вариант НЕ принят: ${code} → ${outcome.title} ${outcome.details.join(' | ')}`);
      } catch (e) {
        bad(`правильный вариант упал: ${code} → ${String((e as Error).message).slice(-160)}`);
      }
    }
    for (const code of variants(task.selfTest?.wrong)) {
      try {
        const { outcome } = await checkPython(task, key, code);
        if (outcome.ok) bad(`ошибочный вариант ПРИНЯТ: ${code}`);
        else row.notes.push(`✗ ${code} → ${outcome.title} ${outcome.details.join(' | ')}`);
      } catch (e) {
        row.notes.push(`✗ ${code} → ошибка: ${String((e as Error).message).slice(-120)}`);
      }
    }
  } else if (type === 'number') {
    const a = await numberAnswer(key, task);
    row.size = `ответ ${a}`;
    if (typeof a === 'number' && !Number.isFinite(a)) bad('ответ не число');
    for (const v of variants(task.selfTest?.correct)) if (!judgeNumber(task, a, v).ok) bad(`правильный ответ НЕ принят: ${v}`);
    for (const v of variants(task.selfTest?.wrong)) {
      const j = judgeNumber(task, a, v);
      if (j.ok) bad(`ошибочный ответ ПРИНЯТ: ${v}`);
      else row.notes.push(`✗ ${v} → ${j.title} ${(j.details ?? []).join(' | ')}`);
    }
  } else if (type === 'quiz') {
    const opts = task.options ?? [];
    row.size = `${opts.length} вариантов`;
    if (!opts.some((o) => o.correct)) bad('нет правильного варианта');
    if (opts.length < 2) bad('меньше двух вариантов');
  } else if (type === 'sheet') {
    const spec = task.sheet!;
    const base = await sheetBase(spec);
    row.size = `${base.length}×${base[0]?.length}`;
    // Эталонный лист проходит проверку; варианты задают формулу первой ячейки диапазона
    const r = checkSheet(base, spec, expectedSheet(base, spec));
    if (!r.ok) bad(`эталонные формулы не проходят проверку: ${r.title} ${r.details.join(' ')}`);
    const withVariant = (v: string) => {
      const hf = expectedSheet(base, spec);
      const cells = JSON.parse(v) as Record<string, string>;
      for (const [addr, formula] of Object.entries(cells)) {
        const { row, col } = parseAddr(addr);
        hf.setCellContents(cell(row, col), toEngine(formula));
        const chk = spec.checks.find((c) => c.range.split(':')[0] === addr);
        if (chk) fillDown(hf, row, col, parseRange(chk.range).end.row);
      }
      return hf;
    };
    for (const v of variants(task.selfTest?.correct)) {
      const res = checkSheet(base, spec, withVariant(v));
      if (!res.ok) bad(`правильный вариант НЕ принят: ${v} → ${res.title} ${res.details.join(' ')}`);
    }
    for (const v of variants(task.selfTest?.wrong)) {
      const res = checkSheet(base, spec, withVariant(v));
      if (res.ok) bad(`ошибочный вариант ПРИНЯТ: ${v}`);
      else row.notes.push(`✗ ${v} → ${res.title} ${res.details.join(' | ')}`);
    }
  } else if (type === 'checklist') {
    row.size = `${task.items?.length ?? 0} пунктов`;
    if (!task.items?.length) bad('пустой чек-лист');
  }
  return row;
}

export function DevPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('');

  const topics = () => allTopics.filter((t) => t.ready && (!moduleFilter || t.moduleId === moduleFilter));

  const runAll = async () => {
    setRunning(true);
    const out: Row[] = [];
    for (const topic of topics()) {
      for (const task of topic.tasks) {
        const key = taskKey(topic, task);
        let row: Row;
        try {
          row = await checkTask(key, task);
        } catch (e) {
          row = { task: key, size: '', status: 'fail', notes: [`ошибка проверки: ${String((e as Error).message ?? e).slice(-300)}`] };
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
    for (const topic of topics()) {
      const blocks = [...topic.lesson.matchAll(/```(sql|python)\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1], code: m[2] }));
      for (const [i, b] of blocks.entries()) {
        const row: Row = { task: `${topic.key} пример ${i + 1} (${b.lang})`, size: '', status: 'ok', notes: [] };
        try {
          if (b.lang === 'sql') {
            const r = await runQuery(b.code);
            row.size = `${r.rows.length}×${r.columns.length}`;
            row.notes.push(`${r.columns.join(' | ')}  →  ${(r.rows[0] ?? []).map(formatCell).join(' | ')}`);
          } else {
            const r = await runPython(b.code);
            row.size = r.display?.kind === 'table' ? `${r.display.total}×${r.display.columns.length}` : r.figures.length ? `${r.figures.length} граф.` : '';
            row.notes.push((r.stdout + ' ' + (r.display?.kind === 'text' ? r.display.text : '')).slice(0, 300));
          }
        } catch (e) {
          row.status = 'fail';
          row.notes.push(String((e as Error).message ?? e).slice(-300));
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
      <div className="task-actions">
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="dev-select">
          <option value="">Все модули</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={runAll} disabled={running}>
          {running ? 'Проверяю…' : 'Проверить все задания'}
        </button>
        <button className="btn btn-secondary" onClick={runExamples} disabled={running}>
          Проверить примеры из уроков
        </button>
      </div>
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
              <td>{r.size}</td>
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
