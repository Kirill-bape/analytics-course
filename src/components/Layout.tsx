// Каркас приложения. Три вида — под ширину экрана:
// • компьютер и iPad горизонтально — боковое меню со статистикой;
// • iPad вертикально и внутренний экран раскладушки — узкая колонка значков;
// • телефон и внешний экран раскладушки — меню внизу экрана.

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { href } from '../router';
import { getDbStatus, restartDb, subscribeDb } from '../sql/engine';
import { useProgress } from '../progress';
import { coursePercent, streakInfo } from '../stats';
import { applyUpdate, getPwa, subscribePwa, type OfflineState } from '../pwa';
import { useActiveInput, useTouchDevice } from '../keyboard';
import { SchemaPanel } from './SchemaPanel';
import { KeyboardBar } from './KeyboardBar';
import { plural } from '../sql/compare';

type NavItem = { id: string; label: string; short?: string; icon: string };

const NAV: NavItem[] = [
  { id: '', label: 'Главная', icon: '🏠' },
  { id: 'course', label: 'Курс', icon: '📚' },
  { id: 'plan', label: 'План', icon: '🗓️' },
];
const SETTINGS: NavItem = { id: 'settings', label: 'Настройки', icon: '⚙️' };

function offlineText(o: OfflineState): string | null {
  if (o.kind === 'preparing') return o.total ? `Готовлю офлайн-режим: ${Math.floor((o.done / o.total) * 100)} %` : 'Готовлю офлайн-режим…';
  if (o.kind === 'ready') return 'Работает без интернета';
  if (o.kind === 'native') return 'Работает без интернета';
  if (o.kind === 'error') return 'Офлайн-режим не готов';
  return null;
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
        Ошибка базы ·{' '}
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
          <span>🎁 Вышла новая версия курса.</span>
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
        {n.icon}
      </span>
      <span className="nav-label">{n.label}</span>
    </a>
  );
  const schemaButton = (cls: string) => (
    <button className={cls} onClick={() => setSchemaOpen(true)}>
      <span className="nav-icon" aria-hidden>
        🗂
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
          <span className="brand-logo" aria-hidden>
            <i style={{ height: 7 }} />
            <i style={{ height: 11 }} />
            <i style={{ height: 15 }} />
          </span>
          <span className="brand-name">Путь аналитика</span>
        </a>
        <PhoneStatus />
      </header>

      <nav className="sidebar" aria-label="Разделы">
        <a className="brand" href={href()} title="Путь аналитика">
          <span className="brand-logo" aria-hidden>
            <i style={{ height: 8 }} />
            <i style={{ height: 13 }} />
            <i style={{ height: 18 }} />
          </span>
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
              🔥 {streak.current} {plural(streak.current, 'день', 'дня', 'дней')}
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
        🗂 Схема данных
      </button>
      <SchemaPanel open={schemaOpen} onClose={() => setSchemaOpen(false)} />
      <KeyboardBar />
    </div>
  );
}
