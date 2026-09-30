// Готовит Python (Pyodide) для работы без интернета:
// копирует ядро Pyodide из node_modules и один раз скачивает нужные
// библиотеки (pandas, numpy, scipy, matplotlib) в папку public/pyodide.
// Контрольная сумма каждого файла сверяется с официальным списком Pyodide.
// Запуск: npm run setup-python (запускается и автоматически после npm install).

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'node_modules', 'pyodide');
const OUT = join(ROOT, 'public', 'pyodide');
const PACKAGES = ['numpy', 'pandas', 'scipy', 'matplotlib'];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

async function main() {
  if (!existsSync(SRC)) {
    console.log('Pyodide не установлен (нет node_modules/pyodide) — пропускаю.');
    return;
  }
  const version = JSON.parse(readFileSync(join(SRC, 'package.json'), 'utf8')).version;
  const lock = JSON.parse(readFileSync(join(SRC, 'pyodide-lock.json'), 'utf8'));
  mkdirSync(OUT, { recursive: true });

  // 1. Ядро Pyodide
  for (const f of readdirSync(SRC)) {
    if (/\.(d\.ts|html|map|md)$/.test(f) || f === 'package.json') continue;
    copyFileSync(join(SRC, f), join(OUT, f));
  }

  // 2. Библиотеки и их зависимости
  const need = new Set();
  const visit = (name) => {
    if (need.has(name)) return;
    need.add(name);
    for (const d of lock.packages[name].depends) visit(d);
  };
  PACKAGES.forEach(visit);

  const base = `https://cdn.jsdelivr.net/pyodide/v${version}/full/`;
  let downloaded = 0;
  for (const name of need) {
    const pkg = lock.packages[name];
    const target = join(OUT, pkg.file_name);
    if (existsSync(target) && sha256(readFileSync(target)) === pkg.sha256) continue;
    process.stdout.write(`Скачиваю ${pkg.file_name}… `);
    const res = await fetch(base + pkg.file_name);
    if (!res.ok) throw new Error(`не удалось скачать ${pkg.file_name}: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (sha256(buf) !== pkg.sha256) throw new Error(`контрольная сумма ${pkg.file_name} не совпала — файл повреждён`);
    writeFileSync(target, buf);
    downloaded += buf.length;
    console.log(`${(buf.length / 1e6).toFixed(1)} МБ ✓`);
  }

  const total = readdirSync(OUT).reduce((s, f) => s + statSync(join(OUT, f)).size, 0);
  console.log(`Python готов к работе без интернета. Скачано сейчас: ${(downloaded / 1e6).toFixed(1)} МБ, всего в public/pyodide: ${(total / 1e6).toFixed(1)} МБ.`);
}

main().catch((err) => {
  // Не ломаем установку: без этих файлов Python загрузится из интернета
  console.warn(`⚠️ Не удалось подготовить Python для офлайн-режима: ${err.message}`);
  console.warn('Приложение будет загружать Python из интернета. Повторить: npm run setup-python');
});
