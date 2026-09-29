// Простейшая навигация по адресу после «#»: #/course, #/topic/sql-basics/01-select и т. д.

import { useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export const href = (...parts: string[]) => `#/${parts.join('/')}`;
