// Адреса опубликованного приложения на GitHub.

export const GITHUB_USER: string = 'Kirill-bape';
export const REPO_NAME = 'analytics-course';

const base = GITHUB_USER ? `https://github.com/${GITHUB_USER}/${REPO_NAME}` : '';
/** Исходный код */
export const REPO_URL = base;
/** Сайт для iPad, MacBook и компьютера */
export const SITE_URL = GITHUB_USER ? `https://${GITHUB_USER.toLowerCase()}.github.io/${REPO_NAME}/` : '';
/** Свежий APK для Android */
export const APK_URL = base ? `${base}/releases/latest/download/put-analitika.apk` : '';
