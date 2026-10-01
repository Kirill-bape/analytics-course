// Движок SQL: база данных DuckDB, которая работает прямо в браузере.
// Все файлы DuckDB лежат в проекте (node_modules), интернет не нужен.
// Используется вариант «eh» — его поддерживают все браузеры с 2022 года
// (Chrome, Safari на iPad и Mac, Samsung Internet, Firefox, Edge).

import * as duckdb from '@duckdb/duckdb-wasm';
import ehWasm from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import ehWorker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { Type, type DataType, type Table } from 'apache-arrow';
import { tables } from '../content';
import { firstKeyword, splitStatements } from './split';

export type Cell = string | number | boolean | null;

export interface QueryResult {
  columns: string[];
  rows: Cell[][];
  ms: number;
}

/** Ошибка, которую мы сами формулируем для ученика (не от базы данных) */
export class FriendlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FriendlyError';
  }
}

const BUNDLE: duckdb.DuckDBBundle = { mainModule: ehWasm, mainWorker: ehWorker, pthreadWorker: null };

// ---------------------------------------------------------------------------
// Состояние базы (для индикатора «База загружается / готова»)
// ---------------------------------------------------------------------------
export type DbStatus = { state: 'loading' | 'ready' | 'error'; message?: string };
let status: DbStatus = { state: 'loading' };
const listeners = new Set<() => void>();

function setStatus(s: DbStatus) {
  status = s;
  listeners.forEach((l) => l());
}
export const getDbStatus = () => status;
export function subscribeDb(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// ---------------------------------------------------------------------------
// Запуск базы и загрузка учебных данных
// ---------------------------------------------------------------------------
interface Db {
  db: duckdb.AsyncDuckDB;
  conn: duckdb.AsyncDuckDBConnection;
}
let dbPromise: Promise<Db> | null = null;

async function createDb(): Promise<Db> {
  setStatus({ state: 'loading' });
  if (!(await duckdb.getPlatformFeatures()).wasmExceptions) {
    throw new FriendlyError('Этот браузер слишком старый для встроенной базы данных. Обнови браузер (Chrome, Safari, Samsung Internet) до последней версии.');
  }
  const bundle = BUNDLE;
  const worker = new Worker(bundle.mainWorker!);
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } });
  const conn = await db.connect();
  for (const t of tables) {
    const res = await fetch(new URL(`${import.meta.env.BASE_URL}data/${t.file}`, document.baseURI));
    if (!res.ok) throw new Error(`Не удалось загрузить файл данных ${t.file}`);
    const fileName = `${t.name}.csv`;
    await db.registerFileBuffer(fileName, new Uint8Array(await res.arrayBuffer()));
    const cols = t.columns.map((c) => `'${c.name}': '${c.type}'`).join(', ');
    await conn.query(
      `CREATE TABLE ${t.name} AS SELECT * FROM read_csv('${fileName}', header = true, columns = {${cols}})`,
    );
  }
  return { db, conn };
}

export function ensureDb(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = createDb().then(
      (d) => {
        setStatus({ state: 'ready' });
        return d;
      },
      (err) => {
        dbPromise = null;
        setStatus({ state: 'error', message: String(err?.message ?? err) });
        throw err;
      },
    );
  }
  return dbPromise;
}

/** Полный перезапуск базы (если запрос завис или что-то сломалось) */
export async function restartDb() {
  const old = dbPromise;
  dbPromise = null;
  try {
    const d = await old;
    await d?.db.terminate();
  } catch {
    // старая база уже не работает — это не страшно
  }
  await ensureDb();
}

// База начинает загружаться сразу при открытии приложения
// (и заново, если модуль перезагрузился во время разработки)
if (typeof window !== 'undefined') ensureDb().catch(() => undefined);

// ---------------------------------------------------------------------------
// Выполнение запросов (по одному за раз, с ограничением по времени)
// ---------------------------------------------------------------------------
const READ_ONLY = new Set(['SELECT', 'WITH', 'FROM', 'VALUES', 'TABLE', 'DESCRIBE', 'SHOW', 'SUMMARIZE', 'EXPLAIN']);
let queue: Promise<unknown> = Promise.resolve();

export function runQuery(sql: string, timeoutMs = 20000): Promise<QueryResult> {
  const job = queue.then(() => execute(sql, timeoutMs));
  queue = job.catch(() => undefined);
  return job;
}

async function execute(sql: string, timeoutMs: number): Promise<QueryResult> {
  const statements = splitStatements(sql);
  if (statements.length === 0) {
    throw new FriendlyError('Редактор пуст — напиши запрос, например `SELECT * FROM products LIMIT 5;`');
  }
  if (statements.length > 1) {
    throw new FriendlyError(
      `В редакторе ${statements.length} запроса(ов), а выполнить можно только один. ` +
        'Оставь один запрос (лишние можно закомментировать с помощью `--`) или выдели нужный мышкой и нажми «Запустить».',
    );
  }
  const kw = firstKeyword(statements[0]);
  if (!READ_ONLY.has(kw)) {
    throw new FriendlyError(
      `Команда \`${kw || '?'}\` изменяет базу данных. В заданиях мы только читаем данные, поэтому запрос должен начинаться с \`SELECT\` (или \`WITH\`).`,
    );
  }

  const { conn } = await ensureDb();
  const t0 = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FriendlyError('timeout')), timeoutMs);
  });
  try {
    const table = (await Promise.race([conn.query(statements[0]), timeout])) as Table;
    const { columns, rows } = tableToRows(table);
    return { columns, rows, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    if (err instanceof FriendlyError && err.message === 'timeout') {
      await restartDb();
      throw new FriendlyError(
        `Запрос выполнялся дольше ${timeoutMs / 1000} секунд и был остановлен. ` +
          'Обычно так бывает, когда таблицы случайно перемножаются друг на друга (например, `FROM orders, order_items` без условия) и строк получается миллиарды.',
      );
    }
    if (/out of memory/i.test(String((err as Error)?.message))) await restartDb();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Перевод результата из формата Arrow в простые значения
// ---------------------------------------------------------------------------
function tableToRows(table: Table): { columns: string[]; rows: Cell[][] } {
  const fields = table.schema.fields;
  const n = table.numRows;
  const rows: Cell[][] = Array.from({ length: n }, () => new Array<Cell>(fields.length));
  fields.forEach((f, ci) => {
    const vec = table.getChildAt(ci);
    for (let r = 0; r < n; r++) rows[r][ci] = toCell(vec?.get(r), f.type);
  });
  return { columns: fields.map((f) => f.name), rows };
}

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatTimestamp(ms: number): string {
  const d = new Date(ms);
  return `${formatDate(ms)} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function toMs(v: unknown, unit?: number): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'bigint') {
    // TimeUnit: 0 = секунды, 1 = мс, 2 = мкс, 3 = нс
    if (unit === 0) return Number(v) * 1000;
    if (unit === 2) return Number(v / 1000n);
    if (unit === 3) return Number(v / 1000000n);
    return Number(v);
  }
  return Number(v);
}

function decimalWordsToNumber(words: Uint32Array, scale: number): number {
  let big = 0n;
  for (let i = words.length - 1; i >= 0; i--) big = (big << 32n) | BigInt(words[i] >>> 0);
  const bits = BigInt(words.length * 32);
  if (words[words.length - 1] & 0x80000000) big -= 1n << bits;
  const neg = big < 0n;
  let s = (neg ? -big : big).toString();
  if (scale > 0) {
    s = s.padStart(scale + 1, '0');
    s = `${s.slice(0, -scale)}.${s.slice(-scale)}`;
  }
  return Number((neg ? '-' : '') + s);
}

function toNumber(v: unknown, type: DataType): number {
  if (typeof v === 'number') return v;
  const scale = (type as unknown as { scale?: number }).scale ?? 0;
  if (typeof v === 'bigint') return scale ? Number(v) / 10 ** scale : Number(v);
  if (v instanceof Uint32Array) return decimalWordsToNumber(v, scale);
  return Number(v);
}

function stringify(v: unknown): string {
  if (v && typeof v === 'object' && 'toJSON' in v && typeof (v as { toJSON: unknown }).toJSON === 'function') {
    v = (v as { toJSON: () => unknown }).toJSON();
  }
  if (ArrayBuffer.isView(v)) return Array.from(v as unknown as ArrayLike<number>).join(', ');
  if (typeof v === 'object') {
    return JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x));
  }
  return String(v);
}

function toCell(v: unknown, type: DataType): Cell {
  if (v === null || v === undefined) return null;
  switch (type.typeId) {
    case Type.Bool:
      return Boolean(v);
    case Type.Int:
    case Type.Float:
    case Type.Decimal:
      return toNumber(v, type);
    case Type.Date:
      return formatDate(toMs(v));
    case Type.Timestamp:
      return formatTimestamp(toMs(v, (type as unknown as { unit?: number }).unit));
    case Type.Utf8:
    case Type.LargeUtf8:
      return String(v);
    default:
      if (typeof v === 'bigint') return Number(v);
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
      return stringify(v);
  }
}

// ---------------------------------------------------------------------------
// Показ значений в таблице результата
// ---------------------------------------------------------------------------
export function formatCell(v: Cell): string {
  if (v === null) return 'NULL';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return String(v);
    return String(Number(v.toFixed(6)));
  }
  return String(v);
}
