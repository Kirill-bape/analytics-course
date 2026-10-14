@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Путь аналитика

if not exist node_modules (
  echo Первый запуск: устанавливаю библиотеки. Это займёт 1-3 минуты...
  call npm install
  if errorlevel 1 (
    echo.
    echo Не получилось установить библиотеки. Проверь подключение к интернету и попробуй ещё раз.
    pause
    exit /b 1
  )
)

rem Видеотека: видео купленных курсов для приложения на этом компьютере и на телефоне
if exist media.config.json (
  start "Видеотека" /min cmd /k "chcp 65001 >nul & node scripts\media-server.mjs"
)

echo.
echo Запускаю приложение. Браузер откроется сам.
echo Не закрывай это окно, пока занимаешься. Чтобы остановить приложение, закрой окно.
echo.
call npm start
pause
