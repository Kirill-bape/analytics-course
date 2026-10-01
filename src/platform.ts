// На каком устройстве открыто приложение и как на нём сохранять файлы.

import { Capacitor } from '@capacitor/core';

/** Приложение установлено как APK (Android) */
export const NATIVE = Capacitor.isNativePlatform();

const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
/** iPhone или iPad (iPad с iPadOS 13+ представляется как Mac, но с сенсорным экраном) */
export const IOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
export const ANDROID = /Android/.test(ua);
export const MAC = /Macintosh/.test(ua) && !IOS;
export const SAFARI = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS|Android/.test(ua);

/** Открыто как установленное приложение (с главного экрана / из Dock), а не во вкладке браузера */
export function isStandalone(): boolean {
  return NATIVE || window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export type SaveResult = { kind: 'saved'; where: string } | { kind: 'downloaded' } | { kind: 'shared' } | { kind: 'cancelled' };

/** Сохраняет текстовый файл: на компьютере и iPad — скачиванием, в APK — в папку «Документы» */
export async function saveTextFile(name: string, text: string): Promise<SaveResult> {
  if (NATIVE) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    try {
      await Filesystem.writeFile({ path: `Путь аналитика/${name}`, data: text, directory: Directory.Documents, encoding: Encoding.UTF8, recursive: true });
      return { kind: 'saved', where: `Документы › Путь аналитика › ${name}` };
    } catch {
      // Нет доступа к «Документам» — предложим отправить файл
      return shareTextFile(name, text);
    }
  }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { kind: 'downloaded' };
}

/** Можно ли отправить файл через системное меню «Поделиться» (Telegram, почта, AirDrop, Google Диск…) */
export function canShareFiles(): boolean {
  if (NATIVE) return true;
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File(['{}'], 'test.json', { type: 'application/json' })] });
  } catch {
    return false;
  }
}

export async function shareTextFile(name: string, text: string): Promise<SaveResult> {
  try {
    if (NATIVE) {
      const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
      const { Share } = await import('@capacitor/share');
      const res = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
      await Share.share({ title: 'Прогресс «Путь аналитика»', files: [res.uri], dialogTitle: 'Куда отправить файл с прогрессом?' });
    } else {
      await navigator.share({ title: 'Прогресс «Путь аналитика»', files: [new File([text], name, { type: 'application/json' })] });
    }
    return { kind: 'shared' };
  } catch {
    return { kind: 'cancelled' };
  }
}
