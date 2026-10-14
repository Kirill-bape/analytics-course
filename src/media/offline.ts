// Скачивание видео курсов на телефон (как в Netflix): дома по Wi-Fi скачиваешь
// темы, а потом смотришь их где угодно — в школе, в дороге — без интернета
// и без включённого компьютера. Работает в приложении для Android (APK).

import { useSyncExternalStore } from 'react';
import { Capacitor } from '@capacitor/core';
import { NATIVE } from '../platform';
import { fileUrl, type MediaVideo } from './client';

export interface SavedVideo {
  id: string;
  title: string;
  course: string;
  topic: string;
  size: number;
  ext: string;
  uri: string;
  savedAt: string;
}

const LS = 'media-offline';
const DIR = 'videos';

type State = { saved: Record<string, SavedVideo>; progress: Record<string, number>; queue: string[]; error?: string };

let state: State = { saved: read(), progress: {}, queue: [] };
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
function read(): Record<string, SavedVideo> {
  try {
    return JSON.parse(localStorage.getItem(LS) ?? '{}') as Record<string, SavedVideo>;
  } catch {
    return {};
  }
}
function persist() {
  try {
    localStorage.setItem(LS, JSON.stringify(state.saved));
  } catch {
    // список скачанного маленький — если не сохранился, видео всё равно лежат в памяти
  }
}

export const canDownload = NATIVE;

export function useOffline(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

/** Адрес скачанного видео для встроенного плеера (null — видео не скачано) */
export function offlineSrc(id: string): string | null {
  const s = state.saved[id];
  return s ? Capacitor.convertFileSrc(s.uri) : null;
}

const MIME: Record<string, string> = { mp4: 'video/mp4', mkv: 'video/x-matroska', ts: 'video/mp2t', webm: 'video/webm', mov: 'video/quicktime' };

/** Открыть скачанное видео во встроенном плеере телефона (там надёжнее перемотка) */
export async function openInPhonePlayer(id: string) {
  const s = state.saved[id];
  if (!s) return;
  const { FileOpener } = await import('@capawesome-team/capacitor-file-opener');
  await FileOpener.openFile({ path: s.uri, mimeType: MIME[s.ext] ?? 'video/*' });
}

async function downloadOne(video: MediaVideo, topic: string) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const url = fileUrl(video.id);
  const ext = video.fmt ?? 'mp4';
  const path = `${DIR}/${video.id}.${ext}`;
  set({ progress: { ...state.progress, [video.id]: 0 } });
  const handle = await Filesystem.addListener('progress', (p) => {
    if (p.url !== url || !p.contentLength) return;
    set({ progress: { ...state.progress, [video.id]: p.bytes / p.contentLength } });
  });
  try {
    await Filesystem.downloadFile({ url, path, directory: Directory.External, progress: true, recursive: true });
    const { uri } = await Filesystem.getUri({ path, directory: Directory.External });
    const saved: SavedVideo = { id: video.id, title: video.title, course: video.course, topic, size: video.size, ext, uri, savedAt: new Date().toISOString() };
    set({ saved: { ...state.saved, [video.id]: saved } });
    persist();
  } finally {
    await handle.remove();
    const progress = { ...state.progress };
    delete progress[video.id];
    set({ progress });
  }
}

let running = false;
const pending: { video: MediaVideo; topic: string }[] = [];

/** Поставить видео в очередь на скачивание (по одному, чтобы не забить сеть) */
export function download(videos: MediaVideo[], topic: string) {
  for (const v of videos) {
    if (state.saved[v.id] || pending.some((p) => p.video.id === v.id) || state.progress[v.id] !== undefined) continue;
    pending.push({ video: v, topic });
  }
  set({ queue: pending.map((p) => p.video.id), error: undefined });
  if (running) return;
  running = true;
  (async () => {
    while (pending.length) {
      const job = pending.shift()!;
      set({ queue: pending.map((p) => p.video.id) });
      try {
        await downloadOne(job.video, job.topic);
      } catch (e) {
        set({ error: `Не удалось скачать «${job.video.title}»: ${String((e as Error)?.message ?? e)}. Проверь подключение к компьютеру.` });
      }
    }
    running = false;
    set({ queue: [] });
  })();
}

export function cancelQueue() {
  pending.length = 0;
  set({ queue: [] });
}

export async function removeVideo(id: string) {
  const s = state.saved[id];
  if (!s) return;
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  await Filesystem.deleteFile({ path: `${DIR}/${id}.${s.ext}`, directory: Directory.External }).catch(() => undefined);
  const saved = { ...state.saved };
  delete saved[id];
  set({ saved });
  persist();
}

export async function removeAll() {
  for (const id of Object.keys(state.saved)) await removeVideo(id);
}

export const savedBytes = (s: State) => Object.values(s.saved).reduce((sum, v) => sum + v.size, 0);
