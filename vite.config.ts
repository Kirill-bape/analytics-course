import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Маленький «сервер прогресса»: сохраняет прогресс в файл progress.json
// в папке проекта, чтобы он не терялся между запусками и при очистке браузера.
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
    configurePreviewServer(server) {
      server.middlewares.use(handler(server.config.root));
    },
  };
}

export default defineConfig({
  plugins: [react(), progressApi()],
  server: { port: 3000, host: '127.0.0.1' },
  preview: { port: 3000, host: '127.0.0.1' },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm', 'pyodide'] },
  worker: { format: 'es' },
});
