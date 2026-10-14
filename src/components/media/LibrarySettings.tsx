// «Настройки» → «Видеотека»: подключение к компьютеру, где лежат купленные курсы.

import { useState } from 'react';
import { CircleCheck, CirclePlay, Link2, RefreshCw, TriangleAlert, Unlink } from 'lucide-react';
import { connectServer, refreshCatalog, useMedia } from '../../media/client';
import { plural } from '../../sql/compare';

const isLocalApp = typeof location !== 'undefined' && ['127.0.0.1', 'localhost'].includes(location.hostname) && location.protocol === 'http:';

function normalizeUrl(raw: string): string {
  let u = raw.trim().replace(/\/+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`;
  if (/^http:\/\/[^/:]+$/i.test(u)) u += ':3700';
  return u;
}

export function LibrarySettings() {
  const m = useMedia();
  const [url, setUrl] = useState(m.server && !isLocalApp ? m.server.url : '');
  const [key, setKey] = useState(m.server?.key ?? '');
  const [error, setError] = useState('');
  const videos = m.catalog?.courses.reduce((s, c) => s + c.videos, 0) ?? 0;
  const hours = m.catalog?.courses.reduce((s, c) => s + c.hours, 0) ?? 0;

  const connect = () => {
    const u = normalizeUrl(url);
    if (!u) {
      setError('Впиши адрес компьютера — он показан в окне «Видеотека» на компьютере.');
      return;
    }
    if (!/^\d{6}$/.test(key.trim())) {
      setError('Код доступа — 6 цифр из окна «Видеотека» на компьютере.');
      return;
    }
    setError('');
    connectServer({ url: u, key: key.trim() });
  };

  return (
    <section className="card settings-section">
      <h2>
        <CirclePlay size={22} aria-hidden /> Видеотека курсов
      </h2>
      <p className="muted">
        Видео и материалы купленных курсов лежат на твоём компьютере. Приложение показывает их прямо в уроках — как YouTube, без скачивания целиком.
        Компьютер при этом должен быть включён, а видеосервер запущен (он стартует вместе с <code>start.bat</code>).
      </p>

      {m.status === 'ok' && m.catalog && (
        <p className="status-ok">
          <CircleCheck size={18} aria-hidden /> Подключено: {videos} {plural(videos, 'видео', 'видео', 'видео')}, около {Math.round(hours)} ч, из{' '}
          {m.catalog.courses.length} {plural(m.catalog.courses.length, 'курса', 'курсов', 'курсов')}.
        </p>
      )}
      {m.status === 'loading' && <p className="muted">Подключаюсь к компьютеру…</p>}
      {m.status === 'error' && (
        <p className="warn-text status-ok">
          <TriangleAlert size={18} aria-hidden /> {m.message}
        </p>
      )}
      {m.status === 'off' && isLocalApp && <p className="muted">Видеосервер на этом компьютере не запущен. Запусти приложение через start.bat.</p>}

      {!isLocalApp && (
        <div className="library-form">
          <label>
            <span>Адрес компьютера</span>
            <input className="number-input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.1.20:3700" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
          <label>
            <span>Код доступа</span>
            <input className="number-input" value={key} onChange={(e) => setKey(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 цифр" inputMode="numeric" />
          </label>
          {error && <p className="warn-text small" style={{ margin: 0 }}>{error}</p>}
          <div className="settings-actions">
            <button className="btn btn-primary" onClick={connect}>
              <Link2 size={18} aria-hidden /> Подключить
            </button>
            {m.server && (
              <>
                <button className="btn btn-secondary" onClick={() => refreshCatalog()}>
                  <RefreshCw size={17} aria-hidden /> Обновить список
                </button>
                <button className="btn btn-ghost" onClick={() => connectServer(null)}>
                  <Unlink size={17} aria-hidden /> Отключить
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {isLocalApp && m.server && (
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={() => refreshCatalog()}>
            <RefreshCw size={17} aria-hidden /> Обновить список
          </button>
        </div>
      )}

      <details className="settings-help">
        <summary>Как смотреть видео с телефона</summary>
        <ol>
          <li>На компьютере запусти приложение через <code>start.bat</code> — вместе с ним откроется окно «Видеотека».</li>
          <li>В этом окне написаны адрес компьютера и код доступа из 6 цифр.</li>
          <li>Телефон должен быть в той же Wi-Fi-сети, что и компьютер. Впиши адрес и код выше и нажми «Подключить».</li>
          <li>Чтобы смотреть вне дома, понадобится Tailscale — бесплатная закрытая сеть для твоих устройств (настроим отдельно).</li>
        </ol>
      </details>
    </section>
  );
}
