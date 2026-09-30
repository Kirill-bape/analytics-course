import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { HyperFormula } from 'hyperformula';
import { SheetGrid } from '../../sheet/SheetGrid';
import { addrName, buildSheet, cell, ERROR_HELP, fillDown, numericValue, parseAddr, parseRange, rawForEdit, toEngine, toRussian, type Raw } from '../../sheet/formulas';
import { Feedback, type FeedbackState } from './Feedback';
import type { TaskBodyProps } from './types';
import type { SheetSpec } from '../../content';
import { getDbStatus, runQuery, subscribeDb } from '../../sql/engine';

// ---------------------------------------------------------------------------
// Данные и проверка (используются и на служебной странице)
// ---------------------------------------------------------------------------
export async function sheetBase(spec: SheetSpec): Promise<Raw[][]> {
  let data: Raw[][];
  if (spec.dataSql) {
    const r = await runQuery(spec.dataSql);
    data = [r.columns, ...r.rows.map((row) => row.map((v) => (typeof v === 'boolean' ? String(v) : v)))];
  } else {
    data = (spec.data ?? []).map((r) => [...r]);
  }
  if (spec.extraHeaders?.length) data[0] = [...data[0], ...spec.extraHeaders];
  return data;
}

export function applyUserCells(hf: HyperFormula, cells: Record<string, string>) {
  for (const [a, raw] of Object.entries(cells)) {
    const { row, col } = parseAddr(a);
    hf.setCellContents(cell(row, col), raw === '' ? null : toEngine(raw));
  }
}

export function expectedSheet(base: Raw[][], spec: SheetSpec): HyperFormula {
  const hf = buildSheet(base);
  for (const c of spec.checks) {
    const { start, end } = parseRange(c.range, base.length - 1);
    hf.setCellContents(cell(start.row, start.col), toEngine(c.formula));
    fillDown(hf, start.row, start.col, end.row);
  }
  return hf;
}

const normFn = (s: string) => s.toUpperCase().replace(/X/g, 'Х');
const fmtVal = (v: unknown) => (typeof v === 'number' ? v.toLocaleString('ru-RU', { maximumFractionDigits: 4 }) : `«${String(v)}»`);

export function checkSheet(base: Raw[][], spec: SheetSpec, user: HyperFormula): { ok: boolean; title: string; details: string[] } {
  const exp = expectedSheet(base, spec);
  for (const c of spec.checks) {
    const { start, end } = parseRange(c.range, base.length - 1);
    const col = start.col;
    const cells = [];
    for (let r = start.row; r <= end.row; r++) cells.push(r);
    const isRange = cells.length > 1;
    const first = addrName(start.row, col);

    const empty = cells.filter((r) => numericValue(user, r, col) === null && !user.doesCellHaveFormula(cell(r, col)));
    if (empty.length === cells.length) {
      return {
        ok: false,
        title: isRange ? `Диапазон ${c.range} пока пустой.` : `Ячейка ${first} пока пустая.`,
        details: [isRange ? `Напиши формулу в ячейке ${first}, а потом нажми «⤓ Протянуть вниз».` : `Выбери ячейку ${first} и напиши в ней формулу, начиная со знака \`=\`.`],
      };
    }
    if (empty.length) {
      return { ok: false, title: 'Формула есть не во всех ячейках.', details: [`Ячейка ${addrName(empty[0], col)} пустая. Выбери ${first} и нажми «⤓ Протянуть вниз» — формула скопируется на весь столбец.`] };
    }
    const notFormula = cells.find((r) => !user.doesCellHaveFormula(cell(r, col)));
    if (notFormula !== undefined) {
      return {
        ok: false,
        title: `В ячейке ${addrName(notFormula, col)} число, а не формула.`,
        details: ['Здесь нужна именно **формула** — она начинается со знака `=`. Тогда при изменении данных результат пересчитается сам. Так и работают аналитики.'],
      };
    }
    if (c.requireFunction) {
      const f = normFn(toRussian(user.getCellFormula(cell(start.row, col)) ?? ''));
      if (!f.includes(normFn(c.requireFunction))) {
        return { ok: false, title: `Нужна функция ${c.requireFunction}.`, details: [`В этом задании тренируем функцию \`${c.requireFunction}\` — используй её в формуле.`] };
      }
    }
    // Есть ли в формуле незакреплённый диапазон (например, E2:E16 без $)
    const firstFormula = toRussian(user.getCellFormula(cell(start.row, col)) ?? '');
    const looseRange = /(^|[^$A-Z])[A-Z]+\d+:[A-Z]+\d+/.test(firstFormula) || /(^|[^$A-Z])[A-Z]+\d+:\$?[A-Z]+\$?\d+/.test(firstFormula);
    for (const r of cells) {
      const u = numericValue(user, r, col);
      const e = numericValue(exp, r, col);
      if (u && typeof u === 'object') {
        const details = [ERROR_HELP[u.error] ?? 'Формула вернула ошибку. Проверь её.'];
        if (r !== start.row && looseRange) details.push(`В первой ячейке ${first} ошибки нет — похоже, при протягивании «съехал» диапазон. Закрепи его знаками \`$\`.`);
        return { ok: false, title: `В ячейке ${addrName(r, col)} ошибка.`, details };
      }
      // Текст сравниваем точно: пробелы и регистр букв важны
      const same = typeof u === 'number' && typeof e === 'number' ? Math.abs(u - e) <= 1e-6 + Math.abs(e) * 1e-9 : String(u ?? '') === String(e ?? '');
      if (!same) {
        const details: string[] = [];
        if (r !== start.row && looseRange) {
          details.push(
            `Первая ячейка ${first} правильная, а ${addrName(r, col)} — нет. Похоже, при протягивании «съехала» ссылка, которая должна стоять на месте. Закрепи её знаком доллара: \`$H$2\` вместо \`H2\`.`,
          );
        } else if (typeof u === 'number' && typeof e === 'number') {
          details.push(`Получилось ${fmtVal(u)} — это ${u > e ? 'больше' : 'меньше'} правильного. Проверь формулу: те ли ячейки в ней участвуют?`);
        } else {
          details.push(
            `Получилось ${fmtVal(u)}, а должно быть другое.${r !== start.row ? ` В ${first} всё верно — значит, формула подходит не для всех строк.` : ''} Проверь формулу и текст в кавычках: регистр букв и пробелы важны.`,
          );
        }
        return { ok: false, title: `Значение в ячейке ${addrName(r, col)} не совпадает.`, details };
      }
    }
  }
  return { ok: true, title: 'Верно!', details: [] };
}

// ---------------------------------------------------------------------------
// Карточка задания
// ---------------------------------------------------------------------------
export function SheetTask({ task, tp, fail, succeed, saveDraft }: TaskBodyProps) {
  const spec = task.sheet!;
  const [base, setBase] = useState<Raw[][] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const db = useSyncExternalStore(subscribeDb, getDbStatus);
  const [userCells, setUserCells] = useState<Record<string, string>>(() => {
    try {
      return tp.code ? (JSON.parse(tp.code) as Record<string, string>) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (spec.dataSql && db.state !== 'ready') return;
    sheetBase(spec).then(setBase, (e) => setError(String(e)));
  }, [spec, db.state]);

  const [resetKey, setResetKey] = useState(0);
  const hf = useMemo(() => {
    if (!base) return null;
    const h = buildSheet(base);
    applyUserCells(h, userCells);
    return h;
    // пересобираем лист только при загрузке данных или сбросе
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, resetKey]);

  if (error) return <div className="feedback feedback-error">Не удалось загрузить данные для таблицы: {error}</div>;
  if (!base || !hf) return <div className="muted small">Загружаю таблицу…</div>;

  const dataWidth = base[0].length;
  const locked = (row: number, col: number) => row < base.length && col < dataWidth && (row === 0 || (base[row]?.[col] ?? null) !== null);
  const first = parseRange(spec.checks[0].range).start;

  const onChange = (changed: { row: number; col: number }[]) => {
    setFeedback(null);
    setUserCells((prev) => {
      const next = { ...prev };
      for (const { row, col } of changed) {
        const a = addrName(row, col);
        const raw = rawForEdit(hf, row, col);
        if (raw === '') delete next[a];
        else next[a] = raw;
      }
      saveDraft(JSON.stringify(next));
      return next;
    });
  };

  const check = () => {
    const r = checkSheet(base, spec, hf);
    const code = JSON.stringify(userCells);
    if (r.ok) {
      succeed(code);
      setFeedback({ kind: 'ok' });
    } else {
      fail(code);
      setFeedback({ kind: 'wrong', title: r.title, details: r.details });
    }
  };

  return (
    <>
      <SheetGrid
        key={resetKey}
        hf={hf}
        rows={base.length + 4}
        cols={dataWidth + 2}
        lastDataRow={base.length - 1}
        widths={spec.widths}
        locked={locked}
        onChange={onChange}
        initialSelection={first}
      />
      <div className="task-actions">
        <button className="btn btn-primary" onClick={check}>
          ✓ Проверить
        </button>
        {Object.keys(userCells).length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={() => {
              setUserCells({});
              saveDraft('{}');
              setFeedback(null);
              setResetKey((k) => k + 1);
            }}
          >
            ↺ Очистить мои формулы
          </button>
        )}
      </div>
      <div className="shortcut-hint">Формулы пишутся как в русском Excel: функции по-русски, аргументы через «;», дроби через запятую. Во время ввода формулы нажми на ячейку, чтобы вставить её адрес.</div>
      <Feedback state={feedback} usedSolution={tp.usedSolution} />
    </>
  );
}
