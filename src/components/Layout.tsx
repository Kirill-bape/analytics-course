// Каркас приложения. Три вида — под ширину экрана:
// • компьютер и iPad горизонтально — боковое меню со статистикой;
// • iPad вертикально и внутренний экран раскладушки — узкая колонка значков;
// • телефон и внешний экран раскладушки — меню внизу экрана.

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { BookOpen, CalendarDays, Database, Flame, Gift, House, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { href } from '../router';
import { getDbStatus, restartDb, subscribeDb } from '../sql/engine';
import { useProgress } from '../progress';
import { coursePercent, streakInfo } from '../stats';
import { applyUpdate, getPwa, subscribePwa, type OfflineState } from '../pwa';
import { useActiveInput, useTouchDevice } from '../keyboard';
import { SchemaPanel } from './SchemaPanel';
import { KeyboardBar } from './KeyboardBar';
import { plural } from '../sql/compare';

type NavItem = { id: string; label: string; icon: LucideIcon };

const NAV: NavItem[] = [
  { id: '', label: 'Главная', icon: House },
  { id: 'course', label: 'Курс', icon: BookOpen },
  { id: 'plan', label: 'План', icon: CalendarDays },
];
const SETTINGS: NavItem = { id: 'settings', label: 'Настройки', icon: SlidersHorizontal };

function offlineText(o: OfflineState): string | null {
  if (o.kind === 'preparing') return o.total ? `Готовлю офлайн-режим: ${Math.floor((o.done / o.total) * 100)} %` : 'Готовлю офлайн-режим…';
  if (o.kind === 'ready') return 'Работает без интернета';
  if (o.kind === 'native') return 'Работает без интернета';
  if (o.kind === 'error') return 'Офлайн-режим не готов';
  return null;
}

/** Знак приложения: отрезок линии с поворотом и тремя станциями, первая пройдена */
function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden>
      <path d="M5 25 H13 L21 11 H27" fill="none" stroke="var(--line-sql-basics)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="5" cy="25" r="3.6" className="brand-stop done" />
      <circle cx="17" cy="18" r="3.6" className="brand-stop" />
      <circle cx="27" cy="11" r="3.6" className="brand-stop" />
    </svg>
  );
}

function DbStatusLine() {
  const db = useSyncExternalStore(subscribeDb, getDbStatus);
  return (
    <div className={`status-line ${db.state}`}>
      <span className="dot" />
      {db.state === 'loading' && 'База данных загружается…'}
      {db.state === 'ready' && 'База данных готова'}
      {db.state === 'error' && (
        <span>
          Ошибка базы данных{' '}
          <button className="link" onClick={() => restartDb()}>
            перезапустить
          </button>
        </span>
      )}
    </div>
  );
}

/** Короткая строка состояния для телефона: видна, только пока что-то загружается или сломалось */
function PhoneStatus() {
  const db = useSyncExternalStore(subscribeDb, getDbStatus);
  const pwa = useSyncExternalStore(subscribePwa, getPwa);
  if (db.state === 'error') {
    return (
      <span className="chip error">
        Ошибка базы:{' '}
        <button className="link" onClick={() => restartDb()}>
          перезапустить
        </button>
      </span>
    );
  }
  if (db.state === 'loading') return <span className="chip loading">База загружается…</span>;
  if (pwa.offline.kind === 'preparing') return <span className="chip loading">{offlineText(pwa.offline)}</span>;
  return null;
}

function Banners() {
  const pwa = useSyncExternalStore(subscribePwa, getPwa);
  const { saveError } = useProgress();
  return (
    <>
      {pwa.updateReady && (
        <div className="banner banner-accent" role="status">
          <span>
            <Gift size={20} aria-hidden /> Вышла новая версия курса.
          </span>
          <button className="btn btn-small btn-primary" onClick={applyUpdate}>
            Обновить
          </button>
        </div>
      )}
      {saveError === 'device' && (
        <div className="banner banner-error" role="alert">
          <span>
            Не получилось сохранить прогресс в памяти устройства (возможно, включён режим «Инкогнито» или закончилось место). Сохрани прогресс в файл на странице{' '}
            <a href={href('settings')}>«Настройки»</a>.
          </span>
        </div>
      )}
    </>
  );
}

export function Layout({ route, children }: { route: string[]; children: ReactNode }) {
  const [schemaOpen, setSchemaOpen] = useState(false);
  const { data, saveError } = useProgress();
  const pwa = useSyncExternalStore(subscribePwa, getPwa);
  const touch = useTouchDevice();
  const typing = Boolean(useActiveInput()) && touch;
  const pct = coursePercent(data);
  const streak = streakInfo(data);
  const section = route[0] === 'topic' ? 'course' : (route[0] ?? '');
  const offline = offlineText(pwa.offline);

  const navLink = (n: NavItem, cls: string) => (
    <a key={n.id} href={href(n.id)} className={`${cls}${section === n.id ? ' active' : ''}`} aria-current={section === n.id ? 'page' : undefined}>
      <span className="nav-icon" aria-hidden>
        <n.icon size={22} strokeWidth={section === n.id ? 2.2 : 1.9} />
      </span>
      <span className="nav-label">{n.label}</span>
    </a>
  );
  const schemaButton = (cls: string) => (
    <button className={cls} onClick={() => setSchemaOpen(true)}>
      <span className="nav-icon" aria-hidden>
        <Database size={22} strokeWidth={1.9} />
      </span>
      <span className="nav-label">
        <span className="long">Схема данных</span>
        <span className="short">Схема</span>
      </span>
    </button>
  );

  return (
    <div className={`app${typing ? ' typing' : ''}`}>
      <header className="topbar">
        <a className="brand" href={href()}>
          <BrandMark />
          <span className="brand-name">Путь аналитика</span>
        </a>
        <PhoneStatus />
      </header>

      <nav className="sidebar" aria-label="Разделы">
        <a className="brand" href={href()} title="Путь аналитика">
          <BrandMark />
          <span className="brand-name">Путь аналитика</span>
        </a>
        <div className="nav">
          {NAV.map((n) => navLink(n, 'nav-item'))}
          {schemaButton('nav-item')}
          {navLink(SETTINGS, 'nav-item')}
        </div>
        <div className="sidebar-stats">
          <div className="mini-stat">
            <span>Курс пройден</span>
            <b>{pct.toFixed(pct > 0 && pct < 10 ? 1 : 0)}%</b>
          </div>
          <div className="progress-bar">
            <div style={{ width: `${pct}%` }} />
          </div>
          <div className="mini-stat">
            <span>Серия</span>
            <b>
              <Flame size={15} color="var(--warn)" aria-hidden /> {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
            </b>
          </div>
        </div>
        <div className="sidebar-footer">
          <DbStatusLine />
          {offline && (
            <div className={`status-line ${pwa.offline.kind === 'preparing' ? 'loading' : pwa.offline.kind === 'error' ? 'error' : 'ready'}`}>
              <span className="dot" />
              {pwa.offline.kind === 'error' ? <a href={href('settings')}>{offline}</a> : offline}
            </div>
          )}
          {saveError === 'file' && <div className="save-error">Не удалось обновить копию прогресса в progress.json. Проверь, что окно запуска не закрыто.</div>}
        </div>
      </nav>

      <main className="main">
        <Banners />
        {children}
      </main>

      <nav className="tabbar" aria-label="Разделы">
        {NAV.map((n) => navLink(n, 'tab'))}
        {schemaButton('tab')}
        {navLink(SETTINGS, 'tab')}
      </nav>

      <button className="schema-fab" onClick={() => setSchemaOpen(true)}>
        <Database size={18} aria-hidden /> Схема данных
      </button>
      <SchemaPanel open={schemaOpen} onClose={() => setSchemaOpen(false)} />
      <KeyboardBar />
    </div>
  );
}
