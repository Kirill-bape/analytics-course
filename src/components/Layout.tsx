import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { href } from '../router';
import { getDbStatus, restartDb, subscribeDb } from '../sql/engine';
import { useProgress } from '../progress';
import { coursePercent, streakInfo } from '../stats';
import { SchemaPanel } from './SchemaPanel';
import { plural } from '../sql/compare';

const NAV = [
  { id: '', label: 'Главная', icon: '🏠' },
  { id: 'course', label: 'Курс', icon: '📚' },
  { id: 'plan', label: 'План', icon: '🗓️' },
];

export function Layout({ route, children }: { route: string[]; children: ReactNode }) {
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const db = useSyncExternalStore(subscribeDb, getDbStatus);
  const { data, saveError } = useProgress();
  const pct = coursePercent(data);
  const streak = streakInfo(data);
  const section = route[0] === 'topic' ? 'course' : (route[0] ?? '');

  return (
    <div className="app">
      <header className="mobile-bar">
        <button className="btn btn-ghost" onClick={() => setMenuOpen(!menuOpen)} aria-label="Меню">
          ☰
        </button>
        <span className="brand-name">Путь аналитика</span>
      </header>
      <nav className={`sidebar${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(false)}>
        <a className="brand" href={href()}>
          <span className="brand-logo" aria-hidden>
            <i style={{ height: 8 }} />
            <i style={{ height: 13 }} />
            <i style={{ height: 18 }} />
          </span>
          <span className="brand-name">Путь аналитика</span>
        </a>
        <div className="nav">
          {NAV.map((n) => (
            <a key={n.id} href={href(n.id)} className={`nav-item${section === n.id ? ' active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </a>
          ))}
          <button className="nav-item" onClick={() => setSchemaOpen(true)}>
            <span className="nav-icon">🗂</span>
            Схема данных
          </button>
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
          <div className={`db-status ${db.state}`}>
            <span className="dot" />
            {db.state === 'loading' && 'База данных загружается…'}
            {db.state === 'ready' && 'База данных готова'}
            {db.state === 'error' && (
              <>
                Ошибка базы данных{' '}
                <button className="link" onClick={() => restartDb()}>
                  перезапустить
                </button>
              </>
            )}
          </div>
          {saveError && <div className="save-error">Не удалось сохранить прогресс в файл. Проверь, что окно запуска не закрыто.</div>}
        </div>
      </nav>
      <main className="main">{children}</main>
      <button className="schema-fab" onClick={() => setSchemaOpen(true)}>
        🗂 Схема данных
      </button>
      <SchemaPanel open={schemaOpen} onClose={() => setSchemaOpen(false)} />
    </div>
  );
}
