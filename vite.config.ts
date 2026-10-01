import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Маленький «сервер прогресса» для запуска на компьютере (start.bat):
// дублирует прогресс в файл progress.json в папке проекта — это запасная копия.
// Основное хранилище прогресса — память браузера на самом устройстве.
function progressApi(): Plugin {
  const handler = (root: string): Connect.NextHandleFunction => async (req, res, next) => {
    if (!req.url?.startsWith('/api/progress')) return next();
    const file = join(root, 'progress.json');
    try {
      if (req.method === 'GET') {
        const text = await readFile(file, 'utf8').catch(() => '{}');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(text);
        return;
      }
      if (req.method === 'PUT' || req.method === 'POST') {
        let body = '';
        for await (const chunk of req) body += chunk;
        JSON.parse(body); // не сохраняем повреждённые данные
        const tmp = `${file}.tmp`;
        await writeFile(tmp, body, 'utf8');
        await rename(tmp, file);
        res.statusCode = 204;
        res.end();
        return;
      }
      res.statusCode = 405;
      res.end();
    } catch (err) {
      res.statusCode = 500;
      res.end(String(err));
    }
  };
  return {
    name: 'progress-api',
    configureServer(server) {
      server.middlewares.use(handler(server.config.root));
    },
  };
}

// Офлайн-режим для сайта: после сборки составляет список всех файлов приложения
// с «отпечатками» (хэшами) и записывает помощника sw.js по шаблону scripts/sw.js.
// В сборке для Android (--mode android) помощник не нужен: все файлы внутри APK.
function offlineServiceWorker(): Plugin {
  let outDir = '';
  let enabled = false;
  return {
    name: 'offline-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
      enabled = config.mode !== 'android';
    },
    closeBundle() {
      if (!enabled) return;
      const files: [string, string, number][] = [];
      const walk = (dir: string) => {
        for (const name of readdirSync(dir)) {
          const full = join(dir, name);
          if (statSync(full).isDirectory()) walk(full);
          else {
            const path = relative(outDir, full).split(sep).join('/');
            if (path === 'sw.js' || path.endsWith('.map')) continue;
            const buf = readFileSync(full);
            files.push([path, createHash('sha256').update(buf).digest('hex').slice(0, 16), buf.length]);
          }
        }
      };
      walk(outDir);
      files.sort((a, b) => a[0].localeCompare(b[0]));
      const version = createHash('sha256').update(JSON.stringify(files)).digest('hex').slice(0, 12);
      const template = readFileSync(new URL('./scripts/sw.js', import.meta.url), 'utf8');
      const marker = 'const MANIFEST = __MANIFEST__;';
      if (!template.includes(marker)) throw new Error('scripts/sw.js: не найдена строка ' + marker);
      writeFileSync(join(outDir, 'sw.js'), template.replace(marker, `const MANIFEST = ${JSON.stringify({ version, files })};`));
      const mb = files.reduce((s, f) => s + f[2], 0) / 1e6;
      console.log(`\nОфлайн-режим: ${files.length} файлов, ${mb.toFixed(1)} МБ (версия ${version})`);
    },
  };
}

export default defineConfig(({ command }) => ({
  // Относительные пути: сайт работает и на GitHub Pages (в подпапке), и внутри APK
  base: command === 'build' ? './' : '/',
  plugins: [react(), progressApi(), offlineServiceWorker()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_TIME__: JSON.stringify(command === 'build' ? new Date().toISOString() : ''),
  },
  server: { port: 3000, host: '127.0.0.1' },
  preview: { port: 4173, host: '127.0.0.1' },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm', 'pyodide'] },
  worker: { format: 'es' },
  build: {
    // Большие файлы (база данных и Python) — это нормально, предупреждение не нужно
    chunkSizeWarningLimit: 4000,
  },
}));
