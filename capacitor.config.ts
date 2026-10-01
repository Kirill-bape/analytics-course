// Настройки Android-приложения (Capacitor). Само приложение — это та же
// сборка сайта из папки dist, упакованная в APK вместе с базой данных и Python.
// APK собирается на GitHub (см. .github/workflows/build.yml), Android Studio не нужна.

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.putanalitika.app',
  appName: 'Путь аналитика',
  webDir: 'dist',
  android: {
    // Отладку через компьютер разрешаем только в отладочных сборках
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Приложение рисуется до краёв экрана, а отступы под «чёлку» и полоску жестов
    // задаёт CSS (env(safe-area-inset-*) в src/styles.css)
    SystemBars: {
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
