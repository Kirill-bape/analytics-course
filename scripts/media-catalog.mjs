// Собирает каталог видеотеки: какие видео и материалы купленных курсов
// относятся к каждому уроку «Пути аналитика». Сами материалы не копируются.
//
// Берёт настройки из media.config.json (его нет в Git):
//   root  — папка с курсами, data — папка для каталога (D:\putanalitika),
//   map   — файл с правилами раскладки (route(path) → урок и блок).
// Пишет в data: catalog.json (для приложения), files.json (для видеосервера),
// report.csv (отчёт «файл → модуль → урок → блок → статус»).
// Запуск: node scripts/media-catalog.mjs

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJECT = join(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(join(PROJECT, 'media.config.json'), 'utf8'));
const { route, COURSES, COURSE_ORDER, PRIMARY = [] } = await import(pathToFileURL(config.map).href);
const tier = (courseName) => (PRIMARY.includes(courseName) ? 'main' : 'extra');
const course = JSON.parse(readFileSync(join(PROJECT, 'content', 'course.json'), 'utf8'));

const lessonTitle = {};
const moduleTitle = {};
for (const m of course.modules) {
  moduleTitle[m.id] = m.title;
  for (const t of m.topics) lessonTitle[`${m.id}/${t.id}`] = t.title;
}

const VIDEO = new Set(['.mp4', '.mkv', '.ts', '.avi', '.mov', '.webm', '.m4v', '.wmv']);
const KIND = {
  '.pdf': 'pdf', '.docx': 'doc', '.doc': 'doc', '.odt': 'doc', '.rtf': 'doc', '.pptx': 'slides', '.ppt': 'slides',
  '.ipynb': 'notebook', '.csv': 'data', '.tsv': 'data', '.xlsx': 'data', '.xls': 'data', '.json': 'data', '.parquet': 'data',
  '.py': 'code', '.sql': 'code', '.yaml': 'code', '.yml': 'code', '.html': 'page', '.htm': 'page', '.txt': 'text', '.md': 'text',
  '.zip': 'archive', '.rar': 'archive', '.gz': 'archive', '.tar': 'archive', '.7z': 'archive', '.epub': 'book', '.fb2': 'book',
};
const PRACTICE_NAME = /задани|домаш|дз|homework|минипроект|проект|практик|итогов|task_|lab_|кейс|case|workshop|воркшоп|exercise|solution|решени|dz_/i;

const idOf = (rel) => createHash('sha1').update(rel).digest('hex').slice(0, 16);

// ---------------------------------------------------------------------------
// Длительности видео и (позже) описания с таймкодами
// ---------------------------------------------------------------------------
const durations = {};
const durFile = join(config.data, 'videos.tsv');
if (existsSync(durFile)) {
  for (const line of readFileSync(durFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const [s, , p] = line.split('\t');
    if (p) durations[p] = Number(s) || 0;
  }
}
const notesFile = join(config.data, 'video-notes.json');
const notes = existsSync(notesFile) ? JSON.parse(readFileSync(notesFile, 'utf8')) : {};
const transcriptsDir = join(config.data, 'transcripts');

function transcriptDuration(id) {
  const f = join(transcriptsDir, `${id}.json`);
  if (!existsSync(f)) return 0;
  try {
    return Math.round(JSON.parse(readFileSync(f, 'utf8')).duration || 0);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Обход папки с курсами
// ---------------------------------------------------------------------------
const all = [];
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else all.push({ rel: relative(config.root, full).split(sep).join('/'), size: statSync(full).size });
  }
}
walk(config.root);

const cleanTitle = (file) =>
  file
    .replace(/(\.(mp4|mkv|ts|mov|avi|webm|wmv|m4v))+$/i, '')
    .replace(/\.(mp4|mov)$/i, '')
    .replace(/\s*\[[\w.-]+\.(org|ru|com|net)\]/gi, '')
    .replace(/\s*-\s*1080$/, '')
    .replace(/\s*\(1\)$/, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const docTitle = (file) =>
  file
    .replace(/\.[^.]+$/, '')
    .replace(/\s*\[[\w.-]+\.(org|ru|com|net)\]/gi, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const lessons = {};
const files = {};
const report = [];
const unknownKeys = new Set();
const courseStats = {};

function lesson(key) {
  return (lessons[key] ??= { videos: [], theory: [], practice: [] });
}

for (const { rel, size } of all) {
  const parts = rel.split('/');
  const courseDir = parts[0];
  const courseName = COURSES[courseDir] ?? courseDir;
  const section = parts.slice(1, -1).join(' / ') || '—';
  const file = parts.at(-1);
  const ext = extname(file).toLowerCase();
  const isVideo = VIDEO.has(ext) || /\.mp4\.(mp4|mkv)$/i.test(file);
  let r;
  try {
    r = route(rel);
  } catch (e) {
    r = null;
    console.warn('Ошибка правила для', rel, e.message);
  }
  if (r && typeof r === 'string') r = { key: r };

  if (!r) {
    report.push([rel, '', '', isVideo ? 'Видео' : 'Материал', 'НЕ РАЗОБРАНО — уточнить по расшифровке или содержимому']);
    continue;
  }
  if (r.exclude) {
    report.push([rel, '', '', '', `Не включено: ${r.exclude}`]);
    continue;
  }
  if (r.duplicate) {
    report.push([rel, '', '', '', `Дубль: ${r.duplicate}`]);
    continue;
  }
  if (r.asset) {
    report.push([rel, '', '', '', `Входит в материал: ${r.asset}`]);
    continue;
  }
  if (!lessonTitle[r.key]) unknownKeys.add(r.key);

  const id = idOf(rel);
  const [moduleId] = r.key.split('/');
  const where = [moduleTitle[moduleId] ?? moduleId, lessonTitle[r.key] ?? r.key];
  courseStats[courseName] ??= { videos: 0, seconds: 0 };

  if (isVideo) {
    const duration = durations[rel] || transcriptDuration(id);
    const note = notes[id] ?? {};
    const remuxed = existsSync(join(config.data, 'video-mp4', `${id}.mp4`));
    const fmt = ext === '.mp4' || ext === '.m4v' || remuxed ? 'mp4' : ext.replace('.', '');
    const item = { id, title: note.title ?? cleanTitle(file), course: courseName, tier: tier(courseName), section, duration, size, fmt };
    if (note.description) item.description = note.description;
    if (note.chapters?.length) item.chapters = note.chapters;
    lesson(r.key).videos.push(item);
    files[id] = { path: rel, ...(VIDEO.has(ext) && ext !== '.mp4' && ext !== '.m4v' ? { mp4: `${id}.mp4` } : {}) };
    courseStats[courseName].videos += 1;
    courseStats[courseName].seconds += duration;
    report.push([rel, ...where, 'Видео', note.description ? 'Вписано, с описанием' + (note.chapters?.length ? ' и таймкодами' : '') : 'Вписано (описание будет по расшифровке)']);
    continue;
  }

  const kind = KIND[ext] ?? (ext === '' ? 'data' : 'other');
  if (kind === 'other') {
    report.push([rel, ...where, '', 'Входит в материал: служебный файл (картинка, настройки) рядом с материалами урока']);
    continue;
  }
  const block = r.block ?? (['data', 'code', 'notebook', 'archive'].includes(kind) || PRACTICE_NAME.test(file) ? 'practice' : 'theory');
  const item = { id, title: docTitle(file), course: courseName, tier: tier(courseName), section, kind, ext: ext.replace('.', '') || 'файл', size };
  lesson(r.key)[block].push(item);
  files[id] = { path: rel };
  report.push([rel, ...where, block === 'practice' ? 'Практика' : 'Теория', 'Вписано']);
}

// Порядок внутри урока: курсы по важности, внутри курса — по разделам и номерам
const order = (c) => {
  const p = PRIMARY.indexOf(c);
  if (p >= 0) return p;
  const i = COURSE_ORDER.indexOf(c);
  return 10 + (i < 0 ? 99 : i);
};
const natural = (a, b) => a.localeCompare(b, 'ru', { numeric: true });
for (const l of Object.values(lessons)) {
  for (const list of [l.videos, l.theory, l.practice]) {
    list.sort((a, b) => order(a.course) - order(b.course) || natural(`${a.section}/${a.title}`, `${b.section}/${b.title}`));
  }
}

// Для заданий из курсов — подсказка, где данные (файлы данных рядом с заданием)
for (const l of Object.values(lessons)) {
  const data = l.practice.filter((d) => d.kind === 'data' || d.kind === 'archive');
  for (const d of l.practice) {
    if (d.kind === 'data' || d.kind === 'archive') continue;
    const near = data.filter((x) => x.course === d.course && x.section === d.section).map((x) => `«${x.title}.${x.ext}»`);
    d.brief = near.length ? `Данные к заданию: ${near.slice(0, 6).join(', ')}${near.length > 6 ? ` и ещё ${near.length - 6}` : ''}.` : undefined;
    if (!d.brief) delete d.brief;
  }
}

const courses = Object.entries(courseStats)
  .map(([title, s]) => ({ id: idOf(title), title, tier: tier(title), videos: s.videos, hours: Math.round(s.seconds / 360) / 10 }))
  .sort((a, b) => order(a.title) - order(b.title));

const catalog = { version: 1, generatedAt: new Date().toISOString(), lessons, courses };
writeFileSync(join(config.data, 'catalog.json'), JSON.stringify(catalog));
writeFileSync(join(config.data, 'files.json'), JSON.stringify(files));
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;
writeFileSync(join(config.data, 'report.csv'), '\uFEFF' + [['Файл', 'Модуль', 'Урок', 'Блок', 'Статус'], ...report].map((r) => r.map(csv).join(';')).join('\r\n'));

// Итог в консоль
const count = (pred) => report.filter(pred).length;
const vids = Object.values(lessons).reduce((s, l) => s + l.videos.length, 0);
console.log(`Уроков с материалами: ${Object.keys(lessons).length}`);
console.log(`Видео вписано: ${vids}, документов в «Теории»: ${Object.values(lessons).reduce((s, l) => s + l.theory.length, 0)}, в «Практике»: ${Object.values(lessons).reduce((s, l) => s + l.practice.length, 0)}`);
console.log(`Не разобрано: ${count((r) => r[4].startsWith('НЕ РАЗОБРАНО'))}, не включено: ${count((r) => r[4].startsWith('Не включено'))}, дублей: ${count((r) => r[4].startsWith('Дубль'))}`);
if (unknownKeys.size) console.log('Уроков нет в course.json:', [...unknownKeys].join(', '));
