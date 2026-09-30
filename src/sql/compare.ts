// Проверка задания: сравниваем результат ученика с эталонным
// и объясняем разницу, не показывая правильный ответ.

import type { Cell, QueryResult } from './engine';
import { codeOnly } from './split';
import type { TaskMistake } from '../content';

export interface CheckOptions {
  orderMatters?: boolean;
  checkColumnNames?: boolean;
}

export interface CheckOutcome {
  ok: boolean;
  /** Главное сообщение */
  title: string;
  /** Пояснения (Markdown) */
  details: string[];
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
const rowsWord = (n: number) => `${n} ${plural(n, 'строка', 'строки', 'строк')}`;
const colsWord = (n: number) => `${n} ${plural(n, 'столбец', 'столбца', 'столбцов')}`;

// ---------------------------------------------------------------------------
// Сравнение значений
// ---------------------------------------------------------------------------
function norm(v: Cell): Cell {
  // Дата и «дата с временем 00:00:00» считаются одинаковыми
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2} 00:00:00$/.test(v)) return v.slice(0, 10);
  return v;
}

function cellEq(a: Cell, b: Cell): boolean {
  a = norm(a);
  b = norm(b);
  if (a === null || b === null) return a === b;
  if (typeof a === 'number' && typeof b === 'number') {
    const diff = Math.abs(a - b);
    return diff <= 1e-6 || diff <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));
  }
  return String(a) === String(b);
}

function cellKey(v: Cell): string {
  v = norm(v);
  if (v === null) return '\u0000';
  if (typeof v === 'number') return `n${Math.round(v * 1e5) / 1e5}`;
  return `${typeof v}:${v}`;
}
const rowKey = (row: Cell[]) => row.map(cellKey).join('\u0001');

function rowsEq(a: Cell[][], b: Cell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[i].length; j++) if (!cellEq(a[i][j], b[i][j])) return false;
  }
  return true;
}

const sortRows = (rows: Cell[][]) =>
  rows
    .map((r) => [rowKey(r), r] as const)
    .sort((x, y) => (x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0))
    .map((x) => x[1]);

const column = (rows: Cell[][], i: number) => rows.map((r) => r[i]);
function sameMultiset(a: Cell[], b: Cell[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(cellKey).sort();
  const sb = b.map(cellKey).sort();
  return sa.every((x, i) => x === sb[i]);
}

function roundTo(x: number, k: number) {
  const f = 10 ** k;
  return Math.round(x * f) / f;
}
function decimals(x: number): number {
  const s = String(Number(x.toFixed(8)));
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

// ---------------------------------------------------------------------------
// Подсказки по «какой части запроса не хватает»
// ---------------------------------------------------------------------------
interface Feature {
  name: string;
  re: RegExp;
  alt?: RegExp;
  text: string;
  onlyIfOrder?: boolean;
}
const FEATURES: Feature[] = [
  { name: 'WHERE', re: /\bwhere\b/i, text: 'нужно отобрать строки по условию — для этого есть `WHERE`' },
  { name: 'DISTINCT', re: /\bdistinct\b/i, alt: /\bgroup\s+by\b/i, text: 'нужны значения без повторов — вспомни про `DISTINCT`' },
  { name: 'LIMIT', re: /\blimit\b/i, alt: /\bfetch\s+first\b/i, text: 'нужно ограничить количество строк — `LIMIT`' },
  { name: 'ORDER BY', re: /\border\s+by\b/i, text: 'важен порядок строк — нужна сортировка `ORDER BY`', onlyIfOrder: true },
  { name: 'DESC', re: /\bdesc\b/i, text: 'нужна сортировка по убыванию (от большего к меньшему) — `DESC`', onlyIfOrder: true },
  { name: 'aggregate', re: /\b(count|sum|avg|min|max)\s*\(/i, text: 'нужно посчитать итог — пригодится агрегатная функция (`COUNT`, `SUM`, `AVG`…)' },
  { name: 'CASE', re: /\bcase\b/i, alt: /\bif\s*\(|\biif\s*\(|\bfilter\s*\(/i, text: 'значение зависит от условия — пригодится `CASE WHEN … THEN … END`' },
  { name: 'COALESCE', re: /\bcoalesce\s*\(/i, alt: /\bifnull\s*\(|\bcase\b/i, text: 'пустые значения нужно чем-то заменить — `COALESCE`' },
  { name: 'NULL', re: /\bis\s+(not\s+)?null\b/i, alt: /\bcoalesce\b|\bis\s+(not\s+)?distinct\b|\bnotnull\b|\bisnull\b/i, text: 'важны пустые значения — проверить их можно через `IS NULL` / `IS NOT NULL`' },
  { name: 'ROUND', re: /\bround\s*\(/i, text: 'значения нужно округлить — `ROUND(значение, знаков)`' },
];

/** Замечания, которые не делают ответ неверным, но полезны на будущее */
export function styleNotes(userCode: string): string[] {
  const c = codeOnly(userCode);
  const notes: string[] = [];
  if (/,\s*from\b/i.test(c)) {
    notes.push('Перед `FROM` стоит лишняя запятая. Наша база (DuckDB) такое прощает, а в PostgreSQL и других базах будет ошибка — лучше отвыкнуть сразу.');
  }
  if (/"[^"]*[а-яё][^"]*"/i.test(stripStrings(userCode))) {
    notes.push('В запросе есть текст в двойных кавычках. В SQL текст пишут в **одинарных** кавычках, а двойные — для названий столбцов.');
  }
  return notes;
}
const stripStrings = (sql: string) => sql.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");

function limitNumber(sql: string): number | null {
  const m = codeOnly(sql).match(/\blimit\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

export type Lang = 'sql' | 'python';

const PY_FEATURES: Feature[] = [
  { name: 'filter', re: /\[[^\]]*(==|!=|>=|<=|>|<|\.isin\(|\.str\.|\.isna\(|\.notna\()/, alt: /\.query\(|\.loc\[/, text: 'нужно отобрать строки по условию — `df[df["столбец"] == значение]`' },
  { name: 'groupby', re: /\.groupby\(/, alt: /\.pivot_table\(|\.value_counts\(/, text: 'нужно сгруппировать данные — `.groupby("столбец")`' },
  { name: 'merge', re: /\.merge\(/, alt: /\.join\(/, text: 'нужно объединить таблицы — `.merge(...)`' },
  { name: 'sort', re: /\.sort_values\(/, alt: /\.nlargest\(|\.nsmallest\(/, text: 'важен порядок строк — нужна сортировка `.sort_values(...)`', onlyIfOrder: true },
  { name: 'desc', re: /ascending\s*=\s*False/, alt: /\.nlargest\(/, text: 'нужна сортировка по убыванию — `ascending=False`', onlyIfOrder: true },
  { name: 'head', re: /\.head\(/, alt: /\.nlargest\(|\.nsmallest\(|\.iloc\[/, text: 'нужны только первые строки — `.head(N)`' },
  { name: 'unique', re: /\.drop_duplicates\(|\.unique\(|\.nunique\(/, text: 'нужны значения без повторов — `.drop_duplicates()` или `.nunique()`' },
  { name: 'fillna', re: /\.fillna\(/, text: 'пустые значения нужно чем-то заменить — `.fillna(...)`' },
  { name: 'dropna', re: /\.dropna\(|\.notna\(|\.isna\(/, text: 'важны пустые значения (NaN) — пригодятся `.isna()` / `.dropna()`' },
  { name: 'round', re: /\.round\(|\bround\(/, text: 'значения нужно округлить — `.round(знаков)`' },
];

interface Vocab {
  extraCols: string;
  fewerCols: string;
  aggHint: string;
  dupHint: string;
  tooMany: string;
  tooFew: string;
  rename: string;
  order: string;
  colOrder: string;
  round: (k: number) => string;
  roundLess: string;
  tooBig: string;
}
const VOCAB: Record<Lang, Vocab> = {
  sql: {
    extraCols: 'Выведи только те столбцы, которые перечислены в задании. `SELECT *` выводит все столбцы таблицы — здесь это лишнее.',
    fewerCols: 'Перечитай задание: какие данные просят показать? Каждый нужный столбец перечисли после `SELECT` через запятую.',
    aggHint: 'Должна получиться **одна строка** с итогом. Чтобы свернуть много строк в одно число, используют агрегатные функции: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.',
    dupHint: 'В твоём результате есть **повторяющиеся** строки. Убрать повторы помогает `DISTINCT`.',
    tooMany: 'Проверь условия отбора: все ли условия из задания учтены? Если в условии есть `OR`, не забыты ли скобки? Если нужны только первые N строк — есть ли `LIMIT`?',
    tooFew: 'Похоже, условие отбора слишком строгое. Проверь: `>` или `>=`? `AND` или `OR`? Совпадает ли написание значений с данными (регистр букв)? Не стоит ли лишний `LIMIT`?',
    rename: 'Задать имя столбцу можно через `AS`: `price - cost_price AS profit`.',
    order: 'Проверь `ORDER BY`: по какому столбцу сортировать и в какую сторону (`ASC` — по возрастанию, `DESC` — по убыванию). Если в задании сказано, как сортировать при равных значениях, добавь второй столбец через запятую.',
    colOrder: 'Столбцы выводятся в том порядке, в котором перечислены после `SELECT`.',
    round: (k) => `Используй \`ROUND(значение, ${k})\`.`,
    roundLess: 'Проверь второй аргумент в `ROUND` (сколько знаков после запятой оставить).',
    tooBig: 'Возможно, в расчёт попали лишние строки: все ли условия из задания учтены в `WHERE`?',
  },
  python: {
    extraCols: 'Оставь только те столбцы, которые нужны в задании: `df[["столбец1", "столбец2"]]`.',
    fewerCols: 'Перечитай задание: какие столбцы нужны в результате? Выбрать несколько столбцов можно так: `df[["столбец1", "столбец2"]]`.',
    aggHint: 'Должно получиться **одно значение** (итог). Посчитать его помогают `.sum()`, `.mean()`, `.count()`, `len(df)`.',
    dupHint: 'В твоём результате есть **повторяющиеся** строки. Убрать повторы помогает `.drop_duplicates()`.',
    tooMany: 'Проверь фильтр: все ли условия учтены? В pandas условия объединяют через `&` (и) и `|` (или), каждое условие — в скобках. Если нужны только первые N строк — есть ли `.head(N)`?',
    tooFew: 'Похоже, фильтр слишком строгий. Проверь: `>` или `>=`? `&` или `|`? Совпадает ли написание значений с данными (регистр букв)?',
    rename: 'Переименовать столбцы можно через `.rename(columns={"старое": "новое"})` или сразу в `.agg(новое=("столбец", "sum"))`.',
    order: 'Проверь `.sort_values(...)`: по какому столбцу сортировать и в какую сторону (`ascending=False` — по убыванию). Для сортировки по двум столбцам передай список: `.sort_values(["a", "b"])`.',
    colOrder: 'Порядок столбцов задаётся списком: `df[["a", "b", "c"]]`.',
    round: (k) => `Используй \`.round(${k})\`.`,
    roundLess: 'Проверь, до скольких знаков округлять (число в `.round(...)`).',
    tooBig: 'Возможно, в расчёт попали лишние строки: все ли условия фильтра учтены?',
  },
};

function missingFeatures(userCode: string, solution: string, orderMatters: boolean, lang: Lang): string[] {
  const u = lang === 'sql' ? codeOnly(userCode) : userCode;
  const s = lang === 'sql' ? codeOnly(solution) : solution;
  return (lang === 'sql' ? FEATURES : PY_FEATURES).filter(
    (f) => f.re.test(s) && !f.re.test(u) && !(f.alt && f.alt.test(u)) && (!f.onlyIfOrder || orderMatters),
  ).map((f) => f.text);
}

export function customMistakes(code: string, mistakes: TaskMistake[] | undefined): string[] {
  if (!mistakes) return [];
  const c = codeOnly(code);
  const raw = code;
  const out: string[] = [];
  for (const m of mistakes) {
    const re = new RegExp(m.pattern, m.flags ?? 'i');
    // Шаблоны с кавычками ищем в исходном тексте, остальные — в коде без комментариев
    const target = /['"]/.test(m.pattern) ? raw : c;
    if (!re.test(target)) continue;
    if (m.unless && new RegExp(m.unless, m.flags ?? 'i').test(target)) continue;
    out.push(m.message);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Главная функция сравнения
// ---------------------------------------------------------------------------
export function compareResults(
  user: QueryResult,
  expected: QueryResult,
  opts: CheckOptions,
  userCode: string,
  solution: string,
  lang: Lang = 'sql',
): CheckOutcome {
  const V = VOCAB[lang];
  const orderMatters = Boolean(opts.orderMatters);
  const hints = missingFeatures(userCode, solution, orderMatters, lang);
  const hintLine = hints.length ? [`💡 Подсказка: в этом задании ${hints[0]}.`] : [];

  const U = user.rows;
  const E = expected.rows;
  const uc = user.columns.length;
  const ec = expected.columns.length;

  // 1. Количество столбцов
  if (uc !== ec) {
    const details: string[] = [];
    if (U.length === E.length && E.length > 0) {
      const used = new Set<number>();
      const matched: number[] = [];
      for (let e = 0; e < ec; e++) {
        const col = column(E, e);
        const u = [...Array(uc).keys()].find((i) => !used.has(i) && sameMultiset(column(U, i), col));
        if (u !== undefined) {
          used.add(u);
          matched.push(e);
        }
      }
      const extra = user.columns.filter((_, i) => !used.has(i));
      if (uc > ec && matched.length === ec) {
        details.push(`Все нужные данные у тебя есть, но есть и лишние столбцы: ${extra.map((c) => `\`${c}\``).join(', ')}. Выведи только то, что просят в задании.`);
      }
    }
    if (!details.length) {
      details.push(
        uc > ec
          ? V.extraCols
          : V.fewerCols,
      );
    }
    return {
      ok: false,
      title: `Должно быть ${colsWord(ec)}, а у тебя ${uc}.`,
      details: [...details, ...hintLine],
    };
  }

  // 2. Количество строк
  if (U.length !== E.length) {
    const details: string[] = [];
    const eKeys = new Set(E.map(rowKey));
    const uKeys = new Set(U.map(rowKey));
    const userInsideExpected = U.length > 0 && U.every((r) => eKeys.has(rowKey(r)));
    const expectedInsideUser = E.every((r) => uKeys.has(rowKey(r)));

    const uLimit = lang === 'sql' ? limitNumber(userCode) : null;
    const sLimit = lang === 'sql' ? limitNumber(solution) : null;
    if (uLimit !== null && sLimit !== null && uLimit !== sLimit && U.length === uLimit) {
      details.push('Проверь число в `LIMIT` — сколько строк просят в задании?');
    } else if (U.length === 0) {
      details.push(
        'Запрос не вернул ни одной строки. Частая причина — значение написано не так, как в данных: регистр букв важен (`\'Москва\'` ≠ `\'москва\'`), лишний пробел, другая форма слова. Или условие невыполнимо, например `price > 100 AND price < 50`.',
      );
    } else if (E.length === 1 && U.length > 1) {
      details.push(V.aggHint);
    } else if (U.length > E.length) {
      if (expectedInsideUser) details.push('Все нужные строки у тебя есть, но есть и лишние.');
      const dedupe = lang === 'sql' ? /\bdistinct\b/i : /drop_duplicates|unique\(/;
      const sol = lang === 'sql' ? codeOnly(solution) : solution;
      const usr = lang === 'sql' ? codeOnly(userCode) : userCode;
      if (dedupe.test(sol) && !dedupe.test(usr) && new Set(U.map(rowKey)).size < U.length) {
        details.push(V.dupHint);
      } else {
        details.push(V.tooMany);
      }
    } else {
      if (userInsideExpected) details.push('Все строки, которые у тебя есть, правильные — но некоторых не хватает.');
      details.push(V.tooFew);
    }
    return {
      ok: false,
      title: `Должно получиться ${rowsWord(E.length)}, а у тебя ${U.length}.`,
      details: [...details, ...hintLine],
    };
  }

  // 3. Значения
  const valuesOk = orderMatters ? rowsEq(U, E) : rowsEq(sortRows(U), sortRows(E));
  if (valuesOk) {
    if (opts.checkColumnNames) {
      const want = expected.columns.map((c) => c.toLowerCase());
      const have = user.columns.map((c) => c.toLowerCase());
      if (want.some((c, i) => c !== have[i])) {
        return {
          ok: false,
          title: 'Данные верные! Осталось правильно назвать столбцы.',
          details: [
            `Столбцы должны называться: ${expected.columns.map((c) => `\`${c}\``).join(', ')}. Сейчас: ${user.columns.map((c) => `\`${c}\``).join(', ')}.`,
            V.rename,
          ],
        };
      }
    }
    return { ok: true, title: 'Верно!', details: [] };
  }

  // Порядок строк
  if (orderMatters && rowsEq(sortRows(U), sortRows(E))) {
    return {
      ok: false,
      title: 'Данные правильные, но порядок строк другой.',
      details: [
        V.order,
      ],
    };
  }

  // Столбцы в другом порядке
  if (ec > 1) {
    const perm: number[] = [];
    for (let e = 0; e < ec; e++) {
      const col = column(E, e);
      const u = [...Array(uc).keys()].find((i) => !perm.includes(i) && sameMultiset(column(U, i), col));
      if (u === undefined) break;
      perm.push(u);
    }
    if (perm.length === ec && perm.some((p, i) => p !== i)) {
      return {
        ok: false,
        title: 'Все данные есть, но столбцы идут в другом порядке.',
        details: [`Нужный порядок столбцов: ${expected.columns.map((c) => `\`${c}\``).join(', ')}. ${V.colOrder}`],
      };
    }
  }

  // Какие столбцы отличаются
  const details: string[] = [];
  const Us = orderMatters ? U : sortRows(U);
  const Es = orderMatters ? E : sortRows(E);
  const badCols: number[] = [];
  for (let i = 0; i < ec; i++) {
    const uCol = column(U, i);
    const eCol = column(E, i);
    if (!sameMultiset(uCol, eCol)) badCols.push(i);
  }

  // Проверка округления
  for (const i of badCols) {
    const uCol = column(Us, i);
    const eCol = column(Es, i);
    if (!uCol.every((v) => typeof v === 'number' || v === null) || !eCol.every((v) => typeof v === 'number' || v === null)) continue;
    const eDec = Math.max(0, ...eCol.map((v) => (typeof v === 'number' ? decimals(v) : 0)));
    const uDec = Math.max(0, ...uCol.map((v) => (typeof v === 'number' ? decimals(v) : 0)));
    const eqAfter = (a: Cell[], b: Cell[], k: number) =>
      a.every((v, j) => (v === null ? b[j] === null : typeof b[j] === 'number' && cellEq(roundTo(v as number, k), b[j])));
    if (uDec > eDec && eqAfter(uCol, eCol, eDec)) {
      details.push(`Почти! Значения в столбце \`${user.columns[i]}\` совпадают, если округлить их до ${eDec} ${plural(eDec, 'знака', 'знаков', 'знаков')} после запятой. ${V.round(eDec)}`);
    } else if (eDec > uDec && eqAfter(eCol, uCol, uDec)) {
      details.push(`Значения в столбце \`${user.columns[i]}\` округлены сильнее, чем нужно. ${V.roundLess}`);
    }
  }

  if (!details.length) {
    if (E.length === 1 && ec === 1) {
      const u = U[0][0];
      const e = E[0][0];
      if (typeof u === 'number' && typeof e === 'number') {
        details.push(`Твой ответ: **${u}**. Он ${u > e ? 'больше' : 'меньше'} правильного.`);
        details.push(
          u > e
            ? V.tooBig
            : 'Возможно, в расчёт попало меньше строк, чем нужно, или выбрана не та функция/столбец.',
        );
      } else {
        details.push(`Твой ответ: **${u === null ? 'NULL' : String(u)}** — не совпадает с правильным.`);
      }
    } else if (badCols.length && badCols.length < ec) {
      const good = expected.columns.map((_, i) => i).filter((i) => !badCols.includes(i));
      details.push(
        `Столбцы ${good.map((i) => `\`${user.columns[i]}\``).join(', ')} совпадают, а в ${badCols.map((i) => `\`${user.columns[i]}\``).join(', ')} значения другие. Проверь, как ${badCols.length > 1 ? 'они считаются' : 'он считается'}.`,
      );
    } else {
      details.push('Количество строк и столбцов совпадает, но сами строки — другие. Проверь условия отбора и какие столбцы ты выводишь.');
    }
  }

  return {
    ok: false,
    title: 'Результат не совпадает с правильным.',
    details: [...details, ...hintLine],
  };
}
