// Запуск Python-кода из приложения. Python загружается только когда он впервые нужен.

import { tables } from '../content';
import type { Cell } from '../sql/engine';
import type { DataFile, WorkerIn, WorkerOut } from './python.worker';

export interface PyTable {
  kind: 'table';
  columns: string[];
  rows: Cell[][];
  total: number;
}
export type PyDisplay = PyTable | { kind: 'text'; text: string };

export interface PlotInfo {
  kinds: string[];
  title: string;
  xlabel: string;
  ylabel: string;
  n_bars: number;
  n_lines: number;
}

export interface PyRunResult {
  stdout: string;
  display: PyDisplay | null;
  result: PyTable | null;
  hasResult: boolean;
  figures: string[];
  plotInfo: PlotInfo[];
  ms: number;
}

export class PythonRunError extends Error {
  constructor(
    message: string,
    public stdout: string,
  ) {
    super(message);
    this.name = 'PythonRunError';
  }
}

export class PythonTimeoutError extends Error {}

// ---------------------------------------------------------------------------
// Состояние Python (для индикатора загрузки)
// ---------------------------------------------------------------------------
export type PyStatus = { state: 'idle' | 'loading' | 'ready' | 'error'; message?: string };
let status: PyStatus = { state: 'idle' };
const listeners = new Set<() => void>();
function setStatus(s: PyStatus) {
  status = s;
  listeners.forEach((l) => l());
}
export const getPyStatus = () => status;
export function subscribePy(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------------------
// Поток с Python
// ---------------------------------------------------------------------------
let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (m: WorkerOut) => void; onStart: () => void }>();

/** Полный адрес файла приложения (работает и на GitHub Pages в подпапке, и в APK) */
const appUrl = (path: string) => new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href;

async function indexURL(): Promise<string> {
  const local = appUrl('pyodide/');
  // В собранном приложении Python всегда лежит рядом (и доступен без интернета)
  if (import.meta.env.PROD) return local;
  try {
    const res = await fetch(`${local}pyodide-lock.json`, { method: 'HEAD' });
    if (res.ok) return local;
  } catch {
    // нет локальной копии — возьмём из интернета
  }
  const { version } = await import('pyodide');
  return `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
}

function dataFiles(): DataFile[] {
  return tables.map((t) => ({
    table: t.name,
    url: appUrl(`data/${t.file}`),
    fileName: `${t.name}.csv`,
    dateCols: t.columns.filter((c) => c.type === 'DATE').map((c) => c.name),
  }));
}

export function ensurePython(): Promise<void> {
  if (readyPromise) return readyPromise;
  setStatus({ state: 'loading', message: 'Запускаю Python…' });
  readyPromise = new Promise<void>((resolve, reject) => {
    const w = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' });
    worker = w;
    w.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data;
      if (m.type === 'status') setStatus({ state: 'loading', message: m.message });
      else if (m.type === 'ready') {
        setStatus({ state: 'ready' });
        resolve();
      } else if (m.type === 'init-error') {
        setStatus({ state: 'error', message: m.message });
        readyPromise = null;
        reject(new Error(m.message));
      } else if (m.type === 'started') pending.get(m.id)?.onStart();
      else if (m.type === 'done') {
        pending.get(m.id)?.resolve(m);
        pending.delete(m.id);
      }
    };
    w.onerror = (e) => {
      setStatus({ state: 'error', message: e.message });
      readyPromise = null;
      reject(new Error(e.message));
    };
    indexURL().then((url) => w.postMessage({ type: 'init', indexURL: url, files: dataFiles() } satisfies WorkerIn));
  });
  return readyPromise;
}

function restart() {
  worker?.terminate();
  worker = null;
  readyPromise = null;
  for (const p of pending.values()) p.resolve({ type: 'done', id: -1, ok: false, stdout: '', error: '__restarted__', ms: 0 });
  pending.clear();
  setStatus({ state: 'idle' });
}

// Запросы выполняются по одному
let queue: Promise<unknown> = Promise.resolve();

export function runPython(code: string, opts: { resultVar?: string; timeoutMs?: number } = {}): Promise<PyRunResult> {
  const job = queue.then(() => execute(code, opts.resultVar, opts.timeoutMs ?? 30000));
  queue = job.catch(() => undefined);
  return job;
}

async function execute(code: string, resultVar: string | undefined, timeoutMs: number): Promise<PyRunResult> {
  await ensurePython();
  const id = nextId++;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const msg = await new Promise<WorkerOut>((resolve) => {
    pending.set(id, {
      resolve,
      // Время считаем с момента начала выполнения кода (без загрузки библиотек)
      onStart: () => {
        timer = setTimeout(() => {
          pending.delete(id);
          restart();
          resolve({ type: 'done', id, ok: false, stdout: '', error: '__timeout__', ms: timeoutMs });
        }, timeoutMs);
      },
    });
    worker!.postMessage({ type: 'run', id, code, resultVar } satisfies WorkerIn);
  });
  clearTimeout(timer);
  if (msg.type !== 'done') throw new Error('Неожиданный ответ Python');
  if (!msg.ok) {
    if (msg.error === '__timeout__') throw new PythonTimeoutError(String(timeoutMs));
    throw new PythonRunError(msg.error, msg.stdout);
  }
  const p = JSON.parse(msg.payload) as {
    display: PyDisplay | null;
    result: PyTable | null;
    has_result: boolean;
    figures?: string[];
    plot_info?: PlotInfo[];
  };
  return {
    stdout: msg.stdout,
    display: p.display,
    result: p.result,
    hasResult: p.has_result,
    figures: p.figures ?? [],
    plotInfo: p.plot_info ?? [],
    ms: msg.ms,
  };
}
