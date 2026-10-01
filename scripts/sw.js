// Помощник офлайн-режима (service worker) «Пути аналитика».
// Это шаблон: при сборке (npm run build) в него подставляется
// список всех файлов приложения с их «отпечатками». Помощник один раз скачивает
// эти файлы в память устройства и дальше отдаёт их оттуда — интернет не нужен.
// При обновлении сайта скачиваются только изменившиеся файлы.

/** @type {{ version: string, files: [string, string, number][] }} */
const MANIFEST = __MANIFEST__;
const CACHE = 'put-analitika-files';
const PARALLEL = 4;

const scope = new URL(self.registration.scope);
const keyFor = (path, rev) => `${new URL(path, scope).href}?__rev=${rev}`;
/** адрес файла → ключ в кэше */
const KEYS = new Map(MANIFEST.files.map(([path, rev]) => [new URL(path, scope).href, keyFor(path, rev)]));
const INDEX = new URL('index.html', scope).href;
const TOTAL = MANIFEST.files.reduce((s, f) => s + f[2], 0);

async function broadcast(message) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of clients) c.postMessage(message);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const have = new Set((await cache.keys()).map((r) => r.url));
      let done = 0;
      const todo = [];
      for (const [path, rev, size] of MANIFEST.files) {
        if (have.has(keyFor(path, rev))) done += size;
        else todo.push([path, rev, size]);
      }

      let lastReport = 0;
      const report = (force) => {
        const now = Date.now();
        if (!force && now - lastReport < 300) return;
        lastReport = now;
        broadcast({ type: 'precache-progress', done, total: TOTAL });
      };
      report(true);

      let next = 0;
      let failure = null;
      const worker = async () => {
        while (next < todo.length && !failure) {
          const [path, rev, size] = todo[next++];
          try {
            // no-cache: браузер уточнит у сервера, не изменился ли файл, и возьмёт его из своего кэша, если нет
            const res = await fetch(new URL(path, scope), { cache: 'no-cache' });
            if (!res.ok) throw new Error(`${path}: ответ сервера ${res.status}`);
            await cache.put(keyFor(path, rev), res);
            done += size;
            report(false);
          } catch (err) {
            failure = err;
          }
        }
      };
      await Promise.all(Array.from({ length: PARALLEL }, worker));
      if (failure) {
        await broadcast({ type: 'precache-error', message: `Не удалось скачать файлы для офлайн-режима (${failure.message ?? failure}). Попробую ещё раз при следующем открытии.` });
        throw failure;
      }
      report(true);
      // Первая установка включается сразу; обновление ждёт, пока ученик нажмёт «Обновить»
      if (!self.registration.active) await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Удаляем файлы старых версий
      const keep = new Set(KEYS.values());
      const cache = await caches.open(CACHE);
      for (const req of await cache.keys()) if (!keep.has(req.url)) await cache.delete(req);
      for (const name of await caches.keys()) if (name !== CACHE && name.startsWith('put-analitika')) await caches.delete(name);
      await self.clients.claim();
      await broadcast({ type: 'precache-done', version: MANIFEST.version });
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' && req.method !== 'HEAD') return;
  const url = new URL(req.url);
  if (url.origin !== scope.origin) return;
  const path = url.origin + url.pathname;
  let key;
  if (req.mode === 'navigate') {
    // Любой адрес приложения (?sandbox, #/topic/…) открывает одну и ту же страницу
    if (path === scope.href || path === INDEX) key = KEYS.get(INDEX);
  } else {
    key = KEYS.get(path);
  }
  if (!key) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const hit = await cache.match(key, { ignoreMethod: true });
      if (!hit) return fetch(req);
      if (req.method === 'HEAD') return new Response(null, { status: hit.status, headers: hit.headers });
      return hit;
    })(),
  );
});
