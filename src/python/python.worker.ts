/// <reference lib="webworker" />
// Фоновый поток с Python (Pyodide). Так страница не зависает во время расчётов,
// а зациклившийся код можно остановить, просто перезапустив поток.

import { loadPyodide, type PyodideInterface } from 'pyodide';
import bootstrap from './bootstrap.py?raw';

export interface DataFile {
  table: string;
  url: string;
  fileName: string;
  dateCols: string[];
}

export type WorkerIn =
  | { type: 'init'; indexURL: string; files: DataFile[] }
  | { type: 'run'; id: number; code: string; resultVar?: string };

export type WorkerOut =
  | { type: 'status'; message: string }
  | { type: 'ready' }
  | { type: 'init-error'; message: string }
  | { type: 'started'; id: number }
  | { type: 'done'; id: number; ok: true; stdout: string; payload: string; ms: number }
  | { type: 'done'; id: number; ok: false; stdout: string; error: string; ms: number };

const post = (m: WorkerOut) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

let py: PyodideInterface | null = null;
let stdout: string[] = [];

async function init(indexURL: string, files: DataFile[]) {
  post({ type: 'status', message: 'Запускаю Python…' });
  py = await loadPyodide({ indexURL });
  py.setStdout({ batched: (s) => stdout.push(s) });
  py.setStderr({ batched: (s) => stdout.push(s) });
  post({ type: 'status', message: 'Загружаю pandas…' });
  await py.loadPackage(['numpy', 'pandas'], { messageCallback: () => undefined });
  post({ type: 'status', message: 'Загружаю учебные данные…' });
  for (const f of files) {
    const res = await fetch(f.url);
    py.FS.writeFile(f.fileName, new Uint8Array(await res.arrayBuffer()));
  }
  py.runPython(bootstrap);
  const load = py.globals.get('_load_table');
  for (const f of files) load(f.table, f.fileName, py.toPy(f.dateCols));
  load.destroy();
}

async function run(id: number, code: string, resultVar?: string) {
  if (!py) throw new Error('Python не запущен');
  stdout = [];
  const t0 = performance.now();
  try {
    await py.loadPackagesFromImports(code, { messageCallback: () => undefined });
    post({ type: 'started', id });
    const runUser = py.globals.get('_run_user');
    const payload = (await runUser(code, resultVar ?? null)) as string;
    runUser.destroy();
    post({ type: 'done', id, ok: true, stdout: stdout.join('\n'), payload, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    post({ type: 'done', id, ok: false, stdout: stdout.join('\n'), error: String((err as Error)?.message ?? err), ms: Math.round(performance.now() - t0) });
  }
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await init(msg.indexURL, msg.files);
      post({ type: 'ready' });
    } catch (err) {
      post({ type: 'init-error', message: String((err as Error)?.message ?? err) });
    }
  } else if (msg.type === 'run') {
    await run(msg.id, msg.code, msg.resultVar);
  }
};
