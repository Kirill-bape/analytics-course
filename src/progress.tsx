// Прогресс ученика хранится на самом устройстве (в памяти браузера или приложения).
// Перенос между устройствами — через файл: «Сохранить прогресс в файл» / «Загрузить из файла»
// на странице «Настройки». При загрузке прогресс объединяется, а не заменяется.
// На компьютере (запуск через start.bat) прогресс дополнительно копируется в файл progress.json.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface TaskProgress {
  attempts: number; // сколько раз нажата «Проверить» с неверным ответом
  solved: boolean;
  solvedAt?: string; // день решения, ГГГГ-ММ-ДД
  hintsShown: number;
  solutionShown: boolean;
  usedSolution?: boolean; // решено после просмотра решения
  code?: string; // последний вариант кода
  updatedAt?: string; // когда запись менялась в последний раз (для объединения прогресса)
}

export interface ProgressData {
  version: 1;
  tasks: Record<string, TaskProgress>;
  activeDays: string[]; // дни, когда решено хотя бы одно задание
  lastBackup?: string; // когда прогресс последний раз сохранялся в файл
}

const EMPTY: ProgressData = { version: 1, tasks: {}, activeDays: [] };
const LS_KEY = 'analytics-course-progress';
/** Тестовый режим (адрес с ?sandbox): прогресс не загружается и не сохраняется */
export const SANDBOX = typeof location !== 'undefined' && new URLSearchParams(location.search).has('sandbox');
/** Копия в progress.json есть только при запуске на компьютере через сервер разработки */
const FILE_MIRROR = import.meta.env.DEV && !SANDBOX;

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const emptyTask = (): TaskProgress => ({ attempts: 0, solved: false, hintsShown: 0, solutionShown: false });

// ---------------------------------------------------------------------------
// Проверка и объединение
// ---------------------------------------------------------------------------
function normalizeTask(raw: unknown): TaskProgress | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<TaskProgress>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const out: TaskProgress = {
    attempts: num(t.attempts),
    solved: t.solved === true,
    hintsShown: num(t.hintsShown),
    solutionShown: t.solutionShown === true,
  };
  if (str(t.solvedAt)) out.solvedAt = t.solvedAt;
  if (typeof t.usedSolution === 'boolean') out.usedSolution = t.usedSolution;
  if (str(t.code) !== undefined) out.code = t.code;
  if (str(t.updatedAt)) out.updatedAt = t.updatedAt;
  return out;
}

export function normalize(raw: unknown): ProgressData {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Partial<ProgressData>;
  const tasks: Record<string, TaskProgress> = {};
  if (r.tasks && typeof r.tasks === 'object') {
    for (const [k, v] of Object.entries(r.tasks)) {
      const t = normalizeTask(v);
      if (t) tasks[k] = t;
    }
  }
  const activeDays = Array.isArray(r.activeDays) ? r.activeDays.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : [];
  const out: ProgressData = { version: 1, tasks, activeDays: [...new Set(activeDays)].sort() };
  if (typeof r.lastBackup === 'string') out.lastBackup = r.lastBackup;
  return out;
}

const later = (a?: string, b?: string) => (!a ? b : !b ? a : a >= b ? a : b);
const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a <= b ? a : b);

function mergeTask(a: TaskProgress, b: TaskProgress, preferB: boolean): TaskProgress {
  // Чей вариант кода новее; если время неизвестно — решённый, иначе по умолчанию
  let newer: TaskProgress;
  if (a.updatedAt && b.updatedAt) newer = b.updatedAt > a.updatedAt ? b : a;
  else if (a.solved !== b.solved) newer = a.solved ? a : b;
  else newer = preferB ? b : a;

  const out: TaskProgress = {
    attempts: Math.max(a.attempts, b.attempts),
    solved: a.solved || b.solved,
    hintsShown: Math.max(a.hintsShown, b.hintsShown),
    solutionShown: a.solutionShown || b.solutionShown,
  };
  if (out.solved) {
    // «Решено без решения» засчитываем, если так было хотя бы на одном устройстве
    if (a.solved && b.solved) out.usedSolution = Boolean(a.usedSolution) && Boolean(b.usedSolution);
    else out.usedSolution = (a.solved ? a : b).usedSolution;
    const solvedAt = earlier(a.solved ? a.solvedAt : undefined, b.solved ? b.solvedAt : undefined);
    if (solvedAt) out.solvedAt = solvedAt;
  }
  const code = newer.code ?? (newer === a ? b.code : a.code);
  if (code !== undefined) out.code = code;
  const updatedAt = later(a.updatedAt, b.updatedAt);
  if (updatedAt) out.updatedAt = updatedAt;
  return out;
}

/**
 * Объединяет два прогресса так, чтобы ничего не потерялось:
 * задание решено, если оно решено хоть где-то; дни занятий складываются.
 */
export function mergeProgress(base: ProgressData, incoming: ProgressData, preferIncoming = false): ProgressData {
  const tasks: Record<string, TaskProgress> = { ...base.tasks };
  for (const [k, t] of Object.entries(incoming.tasks)) {
    tasks[k] = tasks[k] ? mergeTask(tasks[k], t, preferIncoming) : t;
  }
  const out: ProgressData = {
    version: 1,
    tasks,
    activeDays: [...new Set([...base.activeDays, ...incoming.activeDays])].sort(),
  };
  const lastBackup = later(base.lastBackup, incoming.lastBackup);
  if (lastBackup) out.lastBackup = lastBackup;
  return out;
}

/** Одинаковы ли два прогресса по содержанию (порядок заданий и полей не важен) */
function canonical(d: ProgressData): string {
  const tasks = Object.keys(d.tasks)
    .sort()
    .map((k) => [k, normalizeTask(d.tasks[k])]);
  return JSON.stringify([tasks, [...d.activeDays].sort(), d.lastBackup ?? null]);
}
const same = (a: ProgressData, b: ProgressData) => canonical(a) === canonical(b);

// ---------------------------------------------------------------------------
// Хранилище на устройстве
// ---------------------------------------------------------------------------
function readLocal(): ProgressData {
  try {
    return normalize(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'));
  } catch {
    return EMPTY;
  }
}

function writeLocal(data: ProgressData): boolean {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Файл с прогрессом (для переноса между устройствами)
// ---------------------------------------------------------------------------
export const BACKUP_APP = 'put-analitika';

export interface BackupFile {
  app: typeof BACKUP_APP;
  kind: 'progress';
  exportedAt: string;
  progress: ProgressData;
}

export function makeBackup(data: ProgressData): BackupFile {
  return { app: BACKUP_APP, kind: 'progress', exportedAt: new Date().toISOString(), progress: data };
}

/** Читает файл с прогрессом. Понимает и наш формат, и старый progress.json. */
export function parseBackup(text: string): ProgressData {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    throw new Error('Это не файл с прогрессом: не удалось его прочитать.');
  }
  const r = raw as Partial<BackupFile> & Partial<ProgressData>;
  const body = r?.app === BACKUP_APP ? r.progress : r;
  if (!body || typeof body !== 'object' || !('tasks' in body) || typeof body.tasks !== 'object') {
    throw new Error('В этом файле нет прогресса «Пути аналитика». Выбери файл, который сохранила кнопка «Сохранить прогресс в файл».');
  }
  return normalize(body);
}

export interface ImportSummary {
  newSolved: number;
  newDays: number;
  totalSolved: number;
}

// ---------------------------------------------------------------------------
// Контекст React
// ---------------------------------------------------------------------------
interface Ctx {
  data: ProgressData;
  loaded: boolean;
  /** Не получилось сохранить: 'device' — память устройства, 'file' — копия в progress.json */
  saveError: 'device' | 'file' | null;
  task: (key: string) => TaskProgress;
  updateTask: (key: string, fn: (t: TaskProgress) => TaskProgress) => void;
  markSolved: (key: string) => void;
  importProgress: (incoming: ProgressData) => ImportSummary;
  markBackedUp: () => void;
}

const ProgressContext = createContext<Ctx | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProgressData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<Ctx['saveError']>(null);
  const dirty = useRef(false);
  const fileDirty = useRef(false);
  const latest = useRef(data);
  latest.current = data;

  // Загрузка: сначала память устройства, на компьютере — плюс файл progress.json
  useEffect(() => {
    if (SANDBOX) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const local = readLocal();
    setData(local);
    if (!FILE_MIRROR) {
      setLoaded(true);
    } else {
      (async () => {
        let merged = local;
        try {
          const res = await fetch('/api/progress');
          if (res.ok) merged = mergeProgress(local, normalize(await res.json()), true);
        } catch {
          // сервер недоступен — работаем с памятью устройства
        }
        if (cancelled) return;
        if (!same(merged, local)) {
          dirty.current = true;
          fileDirty.current = true;
        }
        setData(merged);
        setLoaded(true);
      })();
    }
    // Просим браузер не удалять данные приложения при нехватке места
    navigator.storage?.persist?.().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  // Если приложение открыто в нескольких вкладках — подхватываем изменения из соседней
  useEffect(() => {
    if (SANDBOX) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== LS_KEY || !e.newValue) return;
      let incoming: ProgressData;
      try {
        incoming = normalize(JSON.parse(e.newValue));
      } catch {
        return;
      }
      setData((d) => {
        const merged = mergeProgress(d, incoming, true);
        if (same(merged, d)) return d;
        if (!same(merged, incoming)) dirty.current = true;
        return merged;
      });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Сохранение: в память устройства — сразу, в progress.json — с небольшой задержкой
  useEffect(() => {
    if (!loaded || !dirty.current || SANDBOX) return;
    dirty.current = false;
    if (!writeLocal(data)) {
      setSaveError('device');
      return;
    }
    if (!FILE_MIRROR) {
      setSaveError(null);
      return;
    }
    fileDirty.current = true;
    const body = JSON.stringify(data, null, 2);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/progress', { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } });
        setSaveError(res.ok ? null : 'file');
        if (res.ok) fileDirty.current = false;
      } catch {
        setSaveError('file');
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  // Сохранить копию в файл при закрытии вкладки
  useEffect(() => {
    if (!FILE_MIRROR) return;
    const flush = () => {
      if (fileDirty.current) navigator.sendBeacon('/api/progress', new Blob([JSON.stringify(latest.current)], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const update = useCallback((fn: (d: ProgressData) => ProgressData) => {
    setData((d) => {
      const next = fn(d);
      if (next !== d) dirty.current = true;
      return next;
    });
  }, []);

  const task = useCallback((key: string) => data.tasks[key] ?? emptyTask(), [data]);

  const updateTask = useCallback(
    (key: string, fn: (t: TaskProgress) => TaskProgress) =>
      update((d) => ({ ...d, tasks: { ...d.tasks, [key]: { ...fn(d.tasks[key] ?? emptyTask()), updatedAt: new Date().toISOString() } } })),
    [update],
  );

  const markSolved = useCallback(
    (key: string) =>
      update((d) => {
        const t = d.tasks[key] ?? emptyTask();
        const today = todayKey();
        if (t.solved) return d;
        const activeDays = d.activeDays.includes(today) ? d.activeDays : [...d.activeDays, today].sort();
        return {
          ...d,
          activeDays,
          tasks: { ...d.tasks, [key]: { ...t, solved: true, solvedAt: today, usedSolution: t.solutionShown, updatedAt: new Date().toISOString() } },
        };
      }),
    [update],
  );

  const importProgress = useCallback(
    (incoming: ProgressData): ImportSummary => {
      const before = latest.current;
      const merged = mergeProgress(before, incoming);
      const solvedCount = (d: ProgressData) => Object.values(d.tasks).filter((t) => t.solved).length;
      const summary = {
        newSolved: solvedCount(merged) - solvedCount(before),
        newDays: merged.activeDays.length - before.activeDays.length,
        totalSolved: solvedCount(merged),
      };
      update(() => merged);
      return summary;
    },
    [update],
  );

  const markBackedUp = useCallback(() => update((d) => ({ ...d, lastBackup: new Date().toISOString() })), [update]);

  const value = useMemo(
    () => ({ data, loaded, saveError, task, updateTask, markSolved, importProgress, markBackedUp }),
    [data, loaded, saveError, task, updateTask, markSolved, importProgress, markBackedUp],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
