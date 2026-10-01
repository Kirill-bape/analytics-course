import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ProgressProvider } from './progress';
import { registerServiceWorker } from './pwa';
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
