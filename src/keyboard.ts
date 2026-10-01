// Какое поле ввода сейчас активно (редактор SQL, Python или строка формул таблицы).
// Панель быстрых символов над экранной клавиатурой вставляет текст именно туда.

import { useSyncExternalStore } from 'react';

export type InputKind = 'sql' | 'python' | 'sheet';

export interface InputTarget {
  kind: InputKind;
  /** Вставить текст на место курсора. word — отделить пробелом от предыдущего слова */
  insert: (text: string, opts?: { word?: boolean }) => void;
  /** Сдвинуть курсор на delta символов */
  move: (delta: number) => void;
  run?: () => void;
  check?: () => void;
  /** Подтвердить ввод (для строки формул) */
  enter?: () => void;
  /** Убрать фокус — экранная клавиатура спрячется */
  blur: () => void;
}

let active: InputTarget | null = null;
const listeners = new Set<() => void>();

export function setActiveInput(t: InputTarget) {
  if (active === t) return;
  active = t;
  listeners.forEach((l) => l());
}

export function clearActiveInput(t: InputTarget) {
  if (active !== t) return;
  active = null;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useActiveInput(): InputTarget | null {
  return useSyncExternalStore(subscribe, () => active);
}

/** Нужно ли перед словом поставить пробел (предыдущий символ — буква, цифра или закрывающая скобка) */
export const needsSpaceBefore = (prev: string) => prev !== '' && !/[\s(\[{.,=]/.test(prev);

// ---------------------------------------------------------------------------
// Сенсорный экран: панель символов нужна только там, где есть экранная клавиатура
// ---------------------------------------------------------------------------
const coarse = typeof window !== 'undefined' ? window.matchMedia('(pointer: coarse)') : null;

export function useTouchDevice(): boolean {
  return useSyncExternalStore(
    (l) => {
      coarse?.addEventListener('change', l);
      return () => coarse?.removeEventListener('change', l);
    },
    () => coarse?.matches ?? false,
  );
}
