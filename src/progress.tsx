// Прогресс ученика: хранится в файле progress.json (через локальный сервер)
// и дублируется в браузере на случай, если сервер недоступен.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export interface TaskProgress {
  attempts: number; // сколько раз нажата «Проверить» с неверным ответом
  solved: boolean;
  solvedAt?: string; // день решения, ГГГГ-ММ-ДД
  hintsShown: number;
  solutionShown: boolean;
  usedSolution?: boolean; // решено после просмотра решения
  code?: string; // последний вариант кода
}

export interface ProgressData {
  version: 1;
  tasks: Record<string, TaskProgress>;
  activeDays: string[]; // дни, когда решено хотя бы одно задание
}

const EMPTY: ProgressData = { version: 1, tasks: {}, activeDays: [] };
const LS_KEY = 'analytics-course-progress';

export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const emptyTask = (): TaskProgress => ({ attempts: 0, solved: false, hintsShown: 0, solutionShown: false });

interface Ctx {
  data: ProgressData;
  loaded: boolean;
  saveError: boolean;
  task: (key: string) => TaskProgress;
  updateTask: (key: string, fn: (t: TaskProgress) => TaskProgress) => void;
  markSolved: (key: string) => void;
  reset: () => void;
}

const ProgressContext = createContext<Ctx | null>(null);

function normalize(raw: unknown): ProgressData {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const r = raw as Partial<ProgressData>;
  return { version: 1, tasks: r.tasks ?? {}, activeDays: r.activeDays ?? [] };
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<ProgressData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const dirty = useRef(false);
  const latest = useRef(data);
  latest.current = data;

  // Загрузка
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result: ProgressData = EMPTY;
      try {
        const res = await fetch('/api/progress');
        if (!res.ok) throw new Error(String(res.status));
        result = normalize(await res.json());
      } catch {
        try {
          result = normalize(JSON.parse(localStorage.getItem(LS_KEY) ?? '{}'));
        } catch {
          // нет сохранённого прогресса
        }
      }
      if (!cancelled) {
        setData(result);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Сохранение (с небольшой задержкой, чтобы не писать файл на каждое нажатие)
  useEffect(() => {
    if (!loaded || !dirty.current) return;
    const body = JSON.stringify(data, null, 2);
    try {
      localStorage.setItem(LS_KEY, body);
    } catch {
      // браузерное хранилище недоступно — не страшно
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/progress', { method: 'PUT', body, headers: { 'Content-Type': 'application/json' } });
        setSaveError(!res.ok);
        if (res.ok) dirty.current = false;
      } catch {
        setSaveError(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  // Сохранить при закрытии вкладки
  useEffect(() => {
    const flush = () => {
      if (dirty.current) navigator.sendBeacon('/api/progress', new Blob([JSON.stringify(latest.current)], { type: 'application/json' }));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);

  const update = useCallback((fn: (d: ProgressData) => ProgressData) => {
    dirty.current = true;
    setData((d) => fn(d));
  }, []);

  const task = useCallback((key: string) => data.tasks[key] ?? emptyTask(), [data]);

  const updateTask = useCallback(
    (key: string, fn: (t: TaskProgress) => TaskProgress) =>
      update((d) => ({ ...d, tasks: { ...d.tasks, [key]: fn(d.tasks[key] ?? emptyTask()) } })),
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
          tasks: { ...d.tasks, [key]: { ...t, solved: true, solvedAt: today, usedSolution: t.solutionShown } },
        };
      }),
    [update],
  );

  const reset = useCallback(() => update(() => ({ ...EMPTY })), [update]);

  const value = useMemo(
    () => ({ data, loaded, saveError, task, updateTask, markSolved, reset }),
    [data, loaded, saveError, task, updateTask, markSolved, reset],
  );
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): Ctx {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress вне ProgressProvider');
  return ctx;
}
