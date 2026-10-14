// Домашний видеосервер «Пути аналитика».
// Раздаёт видео и материалы купленных курсов с этого компьютера приложению
// на телефоне, планшете или здесь же — как YouTube, без скачивания целиком.
// Материалы НЕ копируются в проект и никогда не попадают на GitHub.
//
// Настройки — в файле media.config.json рядом с проектом (его нет в Git):
//   { "root": "C:\\Users\\...\\Desktop\\курсы",        ← папка с курсами
//     "data": "D:\\putanalitika",                      ← каталог, перепакованные видео
//     "port": 3700 }
// Запуск: node scripts/media-server.mjs  (или «Видеотека.bat»)

import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join } from 'node:path';
import { randomInt } from 'node:crypto';

const PROJECT = join(import.meta.dirname, '..');
const CONFIG_FILE = join(PROJECT, 'media.config.json');
if (!existsSync(CONFIG_FILE)) {
  console.error('Нет файла media.config.json — видеотека ещё не настроена.');
  process.exit(1);
}
const config = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
const PORT = config.port ?? 3700;

// Код доступа: без него с других устройств ничего не открыть
if (!config.key) {
  config.key = String(randomInt(100000, 999999));
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

const MIME = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.ts': 'video/mp2t',
  '.pdf': 'application/pdf',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ipynb': 'application/json; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.epub': 'application/epub+zip',
  '.zip': 'application/zip',
};

// Каталог (для приложения) и список файлов (только для сервера)
let catalog = null;
let files = {};
function load() {
  const c = join(config.data, 'catalog.json');
  const f = join(config.data, 'files.json');
  catalog = existsSync(c) ? readFileSync(c) : null;
  files = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
}
load();

/** Полный путь к файлу по его номеру: перепакованное видео в приоритете */
function resolve(id) {
  const entry = files[id];
  if (!entry) return null;
  if (entry.mp4) {
    const p = join(config.data, 'video-mp4', entry.mp4);
    if (existsSync(p)) return p;
  }
  const p = join(config.root, entry.path);
  return existsSync(p) ? p : null;
}

const isLocal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Метод не поддерживается');

  if (url.pathname === '/api/ping') return send(res, 200, JSON.stringify({ ok: true, app: 'put-analitika-media' }), 'application/json');
  if (!isLocal(req) && url.searchParams.get('k') !== config.key) return send(res, 401, 'Нужен код доступа');

  if (url.pathname === '/api/catalog') {
    if (url.searchParams.has('reload')) load();
    if (!catalog) return send(res, 404, 'Каталог ещё не собран');
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    return res.end(catalog);
  }

  const m = url.pathname.match(/^\/api\/file\/([\w-]+)$/);
  if (!m) return send(res, 404, 'Нет такого адреса');
  const path = resolve(m[1]);
  if (!path) return send(res, 404, 'Файл не найден — возможно, его переместили из папки с курсами');

  const size = statSync(path).size;
  const type = MIME[extname(path).toLowerCase()] ?? 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, max-age=3600' };
  if (url.searchParams.has('download')) {
    headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(path.split(/[\\/]/).pop())}`;
  }
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/);
  if (range) {
    let start = range[1] ? Number(range[1]) : size - Number(range[2]);
    let end = range[1] && range[2] ? Number(range[2]) : size - 1;
    if (!range[1]) end = size - 1;
    if (start >= size || start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return res.end();
    }
    end = Math.min(end, size - 1);
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(path).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  // Адреса в домашней сети (без служебных виртуальных сетей Windows и VPN-программ)
  const ips = Object.entries(networkInterfaces())
    .filter(([name]) => !/vEthernet|WSL|VirtualBox|VMware|Hyper-V|Loopback|xray|v2ray|happ|clash|vpn|wireguard|outline|\btun|\btap/i.test(name))
    .flatMap(([, list]) => list ?? [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
  const nVideos = catalog ? JSON.parse(catalog).courses.reduce((s, c) => s + c.videos, 0) : 0;
  console.log('');
  console.log('  Видеотека «Путь аналитика» запущена.');
  console.log(`  В каталоге: ${nVideos} видео.`);
  console.log('');
  console.log('  Чтобы смотреть с телефона: «Настройки» → «Видеотека» в приложении, ввести:');
  for (const ip of ips) console.log(`    адрес: http://${ip}:${PORT}`);
  console.log(`    код доступа: ${config.key}`);
  console.log('');
  console.log('  Не закрывай это окно, пока смотришь видео.');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log('');
    console.log('  Видеотека уже запущена (её открыло другое окно), второй раз запускать не нужно.');
    console.log('  Это окно можно закрыть.');
  } else {
    console.log('  Видеотека не запустилась:', e.message);
  }
});
