// Разбор текста SQL: делим на отдельные запросы, убираем комментарии.

/** Делит текст на запросы по «;», не обращая внимания на «;» внутри кавычек и комментариев */
export function splitStatements(sql: string): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === '-' && next === '-') {
      const end = sql.indexOf('\n', i);
      const stop = end === -1 ? sql.length : end;
      cur += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      cur += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === ch) {
          if (sql[j + 1] === ch) {
            j += 2;
            continue;
          }
          break;
        }
        j++;
      }
      cur += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === ';') {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += ch;
    i++;
  }
  out.push(cur);
  return out.filter((s) => stripComments(s).trim() !== '').map((s) => s.trim());
}

/** Убирает комментарии и содержимое строк (чтобы искать ключевые слова только в коде) */
export function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?(\*\/|$)/g, ' ');
}

/** Код без комментариев и без текста внутри кавычек — для поиска ключевых слов */
export function codeOnly(sql: string): string {
  return stripComments(sql).replace(/'(?:[^']|'')*'/g, "''");
}

export function firstKeyword(stmt: string): string {
  const m = stripComments(stmt).trim().replace(/^\(+/, '').match(/^[A-Za-z]+/);
  return m ? m[0].toUpperCase() : '';
}
