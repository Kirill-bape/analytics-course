// Электронная таблица для Excel-заданий на движке HyperFormula.
// HyperFormula не понимает кириллицу в названиях функций, поэтому
// мы сами переводим СУММ → SUM перед расчётом и обратно для показа.

import { HyperFormula, type CellValue, type SimpleCellAddress } from 'hyperformula';
import { ruRU } from 'hyperformula/i18n/languages';

const RU_BY_EN = ruRU.functions as Record<string, string>;
const EN_BY_RU = new Map(Object.entries(RU_BY_EN).map(([en, ru]) => [ru.toUpperCase(), en]));
// В Excel функция пишется с латинской X, в словаре HyperFormula — с русской Х
EN_BY_RU.set('ПРОСМОТРX', 'XLOOKUP');

const CONFIG = {
  licenseKey: 'gpl-v3',
  functionArgSeparator: ';',
  decimalSeparator: ',' as const,
  thousandSeparator: ' ' as const,
  arrayColumnSeparator: ';' as const,
  arrayRowSeparator: '|' as const,
  dateFormats: ['YYYY-MM-DD', 'DD.MM.YYYY'],
  useColumnIndex: true,
};

/** Меняет названия функций вне кавычек */
function mapFunctionNames(formula: string, fn: (name: string) => string): string {
  const parts = formula.split(/("(?:[^"]|"")*")/);
  return parts
    .map((part, i) =>
      i % 2 === 1 ? part : part.replace(/([A-Za-zА-ЯЁа-яё_][A-Za-zА-ЯЁа-яё0-9._]*)\s*\(/g, (_, name: string) => `${fn(name)}(`),
    )
    .join('');
}

export function toEngine(raw: string): string {
  if (!raw.startsWith('=')) return raw;
  return mapFunctionNames(raw, (name) => EN_BY_RU.get(name.toUpperCase()) ?? name.toUpperCase());
}

export function toRussian(formula: string): string {
  return mapFunctionNames(formula, (name) => RU_BY_EN[name.toUpperCase()] ?? name);
}

export type Raw = string | number | null;

export function buildSheet(data: Raw[][]): HyperFormula {
  const prepared = data.map((row) => row.map((v) => (typeof v === 'string' ? toEngine(v) : v)));
  return HyperFormula.buildFromArray(prepared, CONFIG);
}

// ---------------------------------------------------------------------------
// Адреса ячеек
// ---------------------------------------------------------------------------
export function colName(col: number): string {
  let s = '';
  let n = col + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const addrName = (row: number, col: number) => `${colName(col)}${row + 1}`;

export function parseAddr(a: string): { row: number; col: number } {
  const m = a.trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`Неверный адрес ячейки: ${a}`);
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]) - 1, col: col - 1 };
}

export function parseRange(r: string): { start: { row: number; col: number }; end: { row: number; col: number } } {
  const [a, b] = r.split(':');
  const start = parseAddr(a);
  return { start, end: b ? parseAddr(b) : start };
}

export const cell = (row: number, col: number): SimpleCellAddress => ({ sheet: 0, row, col });

// ---------------------------------------------------------------------------
// Значения
// ---------------------------------------------------------------------------
const ERROR_NAMES = (ruRU.errors ?? {}) as Record<string, string>;

export interface ShownValue {
  text: string;
  kind: 'number' | 'text' | 'error' | 'empty' | 'bool';
  error?: string;
}

function isError(v: CellValue): v is { type: string; message: string; value: string } & CellValue {
  return typeof v === 'object' && v !== null && 'type' in v;
}

export function shown(hf: HyperFormula, row: number, col: number): ShownValue {
  const addr = cell(row, col);
  const v = hf.getCellValue(addr);
  if (v === null || v === undefined || v === '') return { text: '', kind: 'empty' };
  if (isError(v)) {
    const type = (v as unknown as { type: string }).type;
    return { text: ERROR_NAMES[type] ?? (v as unknown as { value: string }).value, kind: 'error', error: type };
  }
  if (typeof v === 'boolean') return { text: v ? 'ИСТИНА' : 'ЛОЖЬ', kind: 'bool' };
  if (typeof v === 'number') {
    const t = hf.getCellValueDetailedType(addr);
    if (t === 'NUMBER_DATE' || t === 'NUMBER_DATETIME') {
      const d = hf.numberToDate(v) as { day: number; month: number; year: number };
      return { text: `${String(d.day).padStart(2, '0')}.${String(d.month).padStart(2, '0')}.${d.year}`, kind: 'number' };
    }
    return { text: v.toLocaleString('ru-RU', { maximumFractionDigits: 6 }), kind: 'number' };
  }
  return { text: String(v), kind: 'text' };
}

/** Что показывать в строке формул */
export function rawForEdit(hf: HyperFormula, row: number, col: number): string {
  const addr = cell(row, col);
  if (hf.doesCellHaveFormula(addr)) return toRussian(hf.getCellFormula(addr) ?? '');
  const v = hf.getCellSerialized(addr);
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') {
    const t = hf.getCellValueDetailedType(addr);
    if (t === 'NUMBER_DATE') return shown(hf, row, col).text;
    return String(v).replace('.', ',');
  }
  return String(v);
}

export function numericValue(hf: HyperFormula, row: number, col: number): number | string | null | { error: string } {
  const v = hf.getCellValue(cell(row, col));
  if (v === null || v === undefined || v === '') return null;
  if (isError(v)) return { error: (v as unknown as { type: string }).type };
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v as number | string;
}

/** Объяснение ошибок таблицы */
export const ERROR_HELP: Record<string, string> = {
  NAME: '#ИМЯ? — таблица не знает такой функции или имени. Проверь написание функции (например, `СУММ`, `ВПР`) и кавычки у текста.',
  VALUE: '#ЗНАЧ! — неподходящий тип данных: например, текст умножается на число.',
  REF: '#ССЫЛКА! — ссылка на ячейку, которой нет.',
  DIV_BY_ZERO: '#ДЕЛ/0! — деление на ноль (или на пустую ячейку).',
  NA: '#Н/Д — значение не найдено. Для `ВПР` это значит, что искомого значения нет в первом столбце диапазона. Проверь, что последний аргумент `0` (точное совпадение).',
  NUM: '#ЧИСЛО! — недопустимое число в расчёте.',
  ERROR: '#ERROR! — формулу не удалось прочитать. В русском Excel аргументы разделяются точкой с запятой `;`, а дробные числа пишутся через запятую: `=ОКРУГЛ(A2*1,2; 2)`.',
  CYCLE: '#CYCLE! — формула ссылается сама на себя.',
};

/** Протянуть формулу из ячейки вниз до строки toRow (включительно) */
export function fillDown(hf: HyperFormula, row: number, col: number, toRow: number) {
  if (toRow <= row) return;
  hf.copy({ start: cell(row, col), end: cell(row, col) });
  for (let r = row + 1; r <= toRow; r++) hf.paste(cell(r, col));
  hf.clearClipboard();
}
