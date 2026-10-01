// Офлайн-режим (PWA). Помощник (service worker, файл sw.js) один раз скачивает
// всё приложение — уроки, данные, базу DuckDB и Python — и дальше отдаёт файлы
// из памяти устройства, поэтому интернет больше не нужен.
// Помощник есть только в опубликованной версии сайта: в режиме разработки
// и в APK он не нужен (в APK все файлы и так внутри приложения).

import { NATIVE } from './platform';

export type OfflineState =
  | { kind: 'dev' } // запуск на компьютере через сервер разработки
  | { kind: 'native' } // APK — всё уже внутри приложения
  | { kind: 'unsupported' }
  | { kind: 'preparing'; done: number; total: number } // в байтах
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

interface PwaState {
  offline: OfflineState;
  /** Скачана новая версия приложения, нужно перезапустить */
  updateReady: boolean;
  /** Браузер разрешает установить приложение кнопкой (Chrome, Edge, Samsung Internet) */
  canInstall: boolean;
}

let state: PwaState = {
  offline: NATIVE ? { kind: 'native' } : import.meta.env.DEV ? { kind: 'dev' } : 'serviceWorker' in navigator ? { kind: 'preparing', done: 0, total: 0 } : { kind: 'unsupported' },
  updateReady: false,
  canInstall: false,
};
const listeners = new Set<() => void>();
function set(patch: Partial<PwaState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export const getPwa = () => state;
export function subscribePwa(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ---------------------------------------------------------------------------
// Установка приложения кнопкой (Android Chrome, Samsung Internet, Chrome/Edge на компьютере)
// ---------------------------------------------------------------------------
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installEvent: InstallPromptEvent | null = null;

if (typeof window !== 'undefined' && !NATIVE) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as InstallPromptEvent;
    set({ canInstall: true });
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    set({ canInstall: false });
  });
}

export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false;
  await installEvent.prompt();
  const { outcome } = await installEvent.userChoice;
  installEvent = null;
  set({ canInstall: false });
  return outcome === 'accepted';
}

// ---------------------------------------------------------------------------
// Помощник офлайн-режима
// ---------------------------------------------------------------------------
let registration: ServiceWorkerRegistration | null = null;
/** Ученик нажал «Обновить» — после смены версии перезагрузим страницу */
let updateRequested = false;

export function applyUpdate() {
  const waiting = registration?.waiting;
  if (!waiting) {
    location.reload();
    return;
  }
  updateRequested = true;
  waiting.postMessage({ type: 'skip-waiting' });
}

function watch(reg: ServiceWorkerRegistration) {
  // Активный помощник означает, что все файлы его версии уже скачаны
  const refresh = () => {
    if (reg.active && state.offline.kind !== 'ready') set({ offline: { kind: 'ready' } });
    if (reg.waiting && navigator.serviceWorker.controller) set({ updateReady: true });
  };
  reg.addEventListener('updatefound', () => {
    const sw = reg.installing;
    sw?.addEventListener('statechange', () => {
      if (sw.state === 'redundant' && !reg.active) set({ offline: { kind: 'error', message: 'Не удалось скачать файлы для офлайн-режима. Попробую ещё раз при следующем открытии.' } });
      refresh();
    });
  });
  refresh();
}

export function registerServiceWorker() {
  if (import.meta.env.DEV || NATIVE || !('serviceWorker' in navigator)) return;

  navigator.serviceWorker.addEventListener('message', (e: MessageEvent) => {
    const m = e.data as { type?: string; done?: number; total?: number; message?: string };
    if (m?.type === 'precache-progress' && typeof m.done === 'number' && typeof m.total === 'number') {
      // Прогресс показываем только для первой установки; обновления качаются незаметно
      if (state.offline.kind !== 'ready') set({ offline: { kind: 'preparing', done: m.done, total: m.total } });
    } else if (m?.type === 'precache-done') {
      set({ offline: { kind: 'ready' } });
    } else if (m?.type === 'precache-error' && state.offline.kind !== 'ready') {
      set({ offline: { kind: 'error', message: m.message ?? 'Не удалось скачать файлы для офлайн-режима.' } });
    }
  });

  // Сменилась версия помощника. Если это было обновление по кнопке — перезагружаем страницу,
  // чтобы все файлы были одной версии. Если обновление нажали в другой вкладке — показываем
  // здесь кнопку «Обновить». Первая установка (страница ещё без помощника) перезагрузки не требует.
  let reloading = false;
  let controlled = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const wasControlled = controlled;
    controlled = true;
    if (reloading || !wasControlled) return;
    if (updateRequested) {
      reloading = true;
      location.reload();
    } else {
      set({ updateReady: true });
    }
  });

  const start = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((reg) => {
        registration = reg;
        watch(reg);
        // Проверяем обновления, когда приложение снова открывают
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => undefined);
        });
      })
      .catch((err) => set({ offline: { kind: 'error', message: String(err?.message ?? err) } }));
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

/** Сколько места занимает приложение на устройстве и защищено ли оно от автоочистки */
export async function storageInfo(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  try {
    const [est, persisted] = await Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()]);
    return { usage: est?.usage, quota: est?.quota, persisted };
  } catch {
    return {};
  }
}
