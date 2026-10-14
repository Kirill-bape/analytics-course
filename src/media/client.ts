// Видеотека: видео и материалы купленных курсов хранятся только на компьютере.
// Компьютер работает как домашний видеосервер (scripts/media-server.mjs),
// а приложение — на телефоне, планшете или том же компьютере — показывает их прямо в уроках,
// ничего не скачивая целиком (как YouTube). Сами материалы никогда не попадают на GitHub.

import { useSyncExternalStore } from 'react';

export interface MediaChapter {
  /** Секунда от начала видео */
  t: number;
  title: string;
}

export interface MediaVideo {
  id: string;
  title: string;
  course: string;
  /** Раздел курса, из которого видео */
  section: string;
  /** Длительность в секундах (0 — неизвестна) */
  duration: number;
  size: number;
  description?: string;
  chapters?: MediaChapter[];
  /** main — один из трёх основных курсов, extra — дополнительный */
  tier?: 'main' | 'extra';
  /** Формат, в котором видео отдаёт компьютер (mp4 — играет везде) */
  fmt?: string;
}

export type MediaDocKind = 'pdf' | 'doc' | 'slides' | 'notebook' | 'data' | 'code' | 'page' | 'text' | 'archive' | 'book' | 'other';

export interface MediaDoc {
  id: string;
  title: string;
  course: string;
  section: string;
  kind: MediaDocKind;
  ext: string;
  size: number;
  /** Для заданий из курсов: техническое задание, данные, критерии, формат ответа */
  brief?: string;
  tier?: 'main' | 'extra';
}

export interface LessonMedia {
  videos: MediaVideo[];
  theory: MediaDoc[];
  practice: MediaDoc[];
}

export interface MediaCatalog {
  version: number;
  generatedAt: string;
  lessons: Record<string, LessonMedia>;
  courses: { id: string; title: string; tier?: 'main' | 'extra'; videos: number; hours: number }[];
}

// ---------------------------------------------------------------------------
// Подключение к компьютеру
// ---------------------------------------------------------------------------
export interface MediaServer {
  url: string; // например http://192.168.1.20:3700 или https://pc.tailnet.ts.net
  key: string; // код доступа (на самом компьютере не нужен)
}

const LS_SERVER = 'media-server';
const LS_CATALOG = 'media-catalog';
const LOCAL_URL = 'http://127.0.0.1:3700';

function readServer(): MediaServer | null {
  try {
    const s = JSON.parse(localStorage.getItem(LS_SERVER) ?? 'null') as MediaServer | null;
    if (s?.url) return s;
  } catch {
    // нет сохранённого подключения
  }
  // Приложение открыто на том же компьютере, где лежат курсы
  if (['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol === 'http:') return { url: LOCAL_URL, key: '' };
  return null;
}

type State = { server: MediaServer | null; catalog: MediaCatalog | null; status: 'off' | 'loading' | 'ok' | 'error'; message?: string };

let state: State = { server: readServer(), catalog: readCachedCatalog(), status: 'off' };
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getMedia = () => state;
export function subscribeMedia(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function useMedia() {
  return useSyncExternalStore(subscribeMedia, getMedia);
}

function readCachedCatalog(): MediaCatalog | null {
  try {
    return JSON.parse(localStorage.getItem(LS_CATALOG) ?? 'null') as MediaCatalog | null;
  } catch {
    return null;
  }
}

const withKey = (url: string, key: string) => (key ? `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(key)}` : url);

export function fileUrl(id: string, download = false): string {
  const s = state.server;
  if (!s) return '';
  return withKey(`${s.url}/api/file/${encodeURIComponent(id)}${download ? '?download=1' : ''}`, s.key);
}

/** Загружает список материалов с компьютера */
export async function refreshCatalog(): Promise<void> {
  const s = state.server;
  if (!s) {
    set({ status: 'off' });
    return;
  }
  set({ status: 'loading', message: undefined });
  try {
    const res = await fetch(withKey(`${s.url}/api/catalog`, s.key), { cache: 'no-store' });
    if (res.status === 401) throw new Error('Неверный код доступа. Посмотри код в окне видеосервера на компьютере.');
    if (!res.ok) throw new Error(`Компьютер ответил ошибкой ${res.status}`);
    const catalog = (await res.json()) as MediaCatalog;
    set({ catalog, status: 'ok' });
    try {
      localStorage.setItem(LS_CATALOG, JSON.stringify(catalog));
    } catch {
      // список большой — если не поместился, просто загрузим его снова в следующий раз
    }
  } catch (e) {
    const msg = e instanceof TypeError ? 'Компьютер не отвечает. Проверь, что он включён и видеосервер запущен, а телефон в той же сети.' : String((e as Error).message ?? e);
    set({ status: 'error', message: msg });
  }
}

export function connectServer(server: MediaServer | null) {
  try {
    if (server) localStorage.setItem(LS_SERVER, JSON.stringify(server));
    else localStorage.removeItem(LS_SERVER);
  } catch {
    // нет доступа к памяти устройства
  }
  set({ server: server ?? readServer(), catalog: server ? state.catalog : null });
  refreshCatalog();
}

if (typeof window !== 'undefined') {
  if (state.server) refreshCatalog();
  // Если компьютер был выключен или видеосервер ещё не запустился — пробуем снова
  const retry = () => {
    if (state.server && (state.status === 'error' || state.status === 'off')) refreshCatalog();
  };
  setInterval(retry, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retry();
  });
}

/** Материалы курсов для урока (null — видеотека не подключена) */
export function useLessonMedia(topicKey: string | undefined): LessonMedia | null {
  const m = useMedia();
  if (!topicKey || !m.catalog || !m.server) return null;
  return m.catalog.lessons[topicKey] ?? null;
}

// ---------------------------------------------------------------------------
// Просмотренные видео (хранятся на устройстве)
// ---------------------------------------------------------------------------
const LS_WATCHED = 'media-watched';
let watched: Record<string, number> = (() => {
  try {
    return JSON.parse(localStorage.getItem(LS_WATCHED) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
})();
const watchListeners = new Set<() => void>();

/** Сохраняет, до какой секунды досмотрено видео (100% — просмотрено) */
export function saveWatched(id: string, fraction: number) {
  const prev = watched[id] ?? 0;
  if (fraction <= prev && fraction < 1) return;
  watched = { ...watched, [id]: Math.min(1, Math.max(prev, fraction)) };
  try {
    localStorage.setItem(LS_WATCHED, JSON.stringify(watched));
  } catch {
    // не страшно
  }
  watchListeners.forEach((l) => l());
}

export function useWatched(): Record<string, number> {
  return useSyncExternalStore(
    (l) => {
      watchListeners.add(l);
      return () => watchListeners.delete(l);
    },
    () => watched,
  );
}

export function formatDuration(sec: number): string {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}
