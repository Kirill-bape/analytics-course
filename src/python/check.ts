// Проверка Python-заданий.

import { joinText, type TaskDef } from '../content';
import { compareResults, customMistakes, type CheckOutcome } from '../sql/compare';
import type { QueryResult } from '../sql/engine';
import { runPython, type PyRunResult, type PyTable } from './engine';

const cache = new Map<string, PyRunResult>();

const resultVarOf = (task: TaskDef) => (task.check === 'stdout' ? undefined : (task.resultVar ?? 'result'));

export async function pythonExpected(key: string, task: TaskDef): Promise<PyRunResult> {
  const cached = cache.get(key);
  if (cached) return cached;
  const res = await runPython(joinText(task.solution), { resultVar: resultVarOf(task) });
  cache.set(key, res);
  return res;
}

const asQuery = (t: PyTable): QueryResult => ({ columns: t.columns, rows: t.rows, ms: 0 });

function normLines(s: string): string[] {
  const lines = s.replace(/\r/g, '').split('\n').map((l) => l.trimEnd());
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

const PLOT_KIND: Record<string, string> = { bar: 'столбчатая диаграмма', line: 'линейный график', scatter: 'точечная диаграмма', pie: 'круговая диаграмма' };

export async function checkPython(task: TaskDef, key: string, code: string): Promise<{ run: PyRunResult; outcome: CheckOutcome }> {
  const mode = task.check ?? 'result';
  const resultVar = resultVarOf(task);
  const run = await runPython(code, { resultVar });
  const expected = await pythonExpected(key, task);
  const solution = joinText(task.solution);
  const extra = customMistakes(code, task.mistakes);

  const fail = (title: string, details: string[]): { run: PyRunResult; outcome: CheckOutcome } => ({
    run,
    outcome: { ok: false, title, details: [...extra, ...details] },
  });

  if (mode === 'stdout') {
    const u = normLines(run.stdout);
    const e = normLines(expected.stdout);
    if (!u.length) return fail('Код ничего не вывел.', ['Чтобы показать результат, используй `print(...)`.']);
    if (u.length !== e.length) {
      return fail(`Должно быть выведено строк: ${e.length}, а у тебя ${u.length}.`, ['Каждый `print(...)` выводит отдельную строку. Проверь, сколько раз он вызывается (например, внутри цикла).']);
    }
    const i = u.findIndex((l, k) => l !== e[k]);
    if (i >= 0) {
      const sameIgnoringSpaces = u[i].replace(/\s+/g, '') === e[i].replace(/\s+/g, '');
      return fail(`Строка ${i + 1} вывода отличается от нужной.`, [
        `У тебя: \`${u[i] || '(пустая строка)'}\`.`,
        sameIgnoringSpaces
          ? 'Отличие только в пробелах. Обрати внимание: `print(a, b)` ставит пробел между значениями сам.'
          : 'Проверь формат: текст, знаки препинания, округление чисел.',
      ]);
    }
    return { run, outcome: { ok: true, title: 'Верно!', details: [] } };
  }

  if (mode === 'plot') {
    const spec = task.plot ?? {};
    if (!run.figures.length) {
      return fail('График не построен.', ['Построй график, например `df.plot(kind="bar")` или `plt.bar(...)`. Если всё сделано — проверь, что код не падает раньше.']);
    }
    const ax = run.plotInfo[0];
    if (spec.kind && ax && !ax.kinds.includes(spec.kind)) {
      return fail(`Нужна ${PLOT_KIND[spec.kind]}.`, [
        spec.kind === 'bar'
          ? 'Столбчатая диаграмма: `plt.bar(x, y)`, `plt.barh(...)` или `df.plot(kind="bar")`.'
          : spec.kind === 'line'
            ? 'Линейный график: `plt.plot(x, y)` или `df.plot()`.'
            : spec.kind === 'scatter'
              ? 'Точечная диаграмма: `plt.scatter(x, y)`.'
              : 'Круговая диаграмма: `plt.pie(values, labels=...)`.',
      ]);
    }
    if (spec.title && ax && !ax.title.trim()) return fail('У графика нет заголовка.', ['Добавь заголовок: `plt.title("…")`. Хороший заголовок говорит, что показано и за какой период.']);
    if (spec.xlabel && ax && !ax.xlabel.trim()) return fail('Не подписана ось X.', ['Добавь подпись: `plt.xlabel("…")`.']);
    if (spec.ylabel && ax && !ax.ylabel.trim()) return fail('Не подписана ось Y.', ['Добавь подпись: `plt.ylabel("…")` — с единицами измерения, например «Выручка, ₽».']);
    if (!task.resultVar) return { run, outcome: { ok: true, title: 'Верно!', details: [] } };
  }

  // Проверка переменной result
  if (!run.hasResult || !run.result) {
    return fail(`Не найдена переменная \`${resultVar}\`.`, [`Сохрани ответ в переменную \`${resultVar}\`, например: \`${resultVar} = df[df["city"] == "Москва"]\`. Проверяется именно она.`]);
  }
  if (!expected.result) throw new Error('В эталонном решении нет переменной с ответом');
  const outcome = compareResults(asQuery(run.result), asQuery(expected.result), task, code, solution, 'python');
  if (!outcome.ok) outcome.details = [...extra, ...outcome.details];
  return { run, outcome };
}
