import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProgressProvider } from './progress';
import { registerServiceWorker } from './pwa';
// Шрифты лежат внутри приложения, чтобы всё выглядело одинаково и без интернета
import '@fontsource-variable/golos-text';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import './styles-tasks.css';

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ProgressProvider>
      <App />
    </ProgressProvider>
  </StrictMode>,
);
