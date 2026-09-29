// Перевод ошибок базы данных на понятный язык.
// База пишет ошибки по-английски и довольно сухо — здесь мы объясняем,
// что случилось и как это обычно исправляют.

import { tables } from '../content';
import { FriendlyError } from './engine';

export interface ExplainedError {
  title: string;
  /** Объяснение в Markdown */
  text: string;
  /** Исходный текст ошибки от базы (если был) */
  raw?: string;
}

const KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'DISTINCT', 'AND', 'OR', 'NOT', 'IN',
  'BETWEEN', 'LIKE', 'ILIKE', 'IS', 'NULL', 'AS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC', 'JOIN',
  'LEFT', 'INNER', 'ON', 'WITH', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'COALESCE', 'EXTRACT', 'INTERVAL',
];

const ALL_COLUMNS = [...new Set(tables.flatMap((t) => t.columns.map((c) => c.name)))];
const ALL_TABLES = tables.map((t) => t.name);

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

function closest(word: string, candidates: string[], maxDist = 2): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const c of candidates) {
    const d = levenshtein(word.toLowerCase(), c.toLowerCase());
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD > 0 && bestD <= maxDist ? best : undefined;
}

const hasCyrillic = (s: string) => /[а-яё]/i.test(s);

/** Сопоставляет ошибку с понятным объяснением */
export function explainError(err: unknown, code: string): ExplainedError {
  if (err instanceof FriendlyError) {
    return { title: 'Запрос не выполнен', text: err.message };
  }
  const raw = String((err as Error)?.message ?? err);
  const msg = raw.replace(/\s+/g, ' ');
  const found = (re: RegExp) => msg.match(re);
  let m: RegExpMatchArray | null;

  // Столбец не найден
  if ((m = found(/Referenced column "([^"]+)" not found/i))) {
    const name = m[1];
    // Текст в двойных кавычках: WHERE city = "Москва"
    if (code.includes(`"${name}"`) && (hasCyrillic(name) || !ALL_COLUMNS.includes(name.toLowerCase()))) {
      return {
        title: 'Текст нужно писать в одинарных кавычках',
        text:
          `В запросе \`"${name}"\` стоит в двойных кавычках. В SQL двойные кавычки означают **название столбца**, ` +
          `поэтому база ищет столбец с именем «${name}» и не находит его.\n\n` +
          `Текстовые значения пишут в **одинарных** кавычках: \`'${name}'\`.`,
        raw,
      };
    }
    const candidates = [...msg.matchAll(/Candidate bindings: ([^!]*?)(?:LINE|$)/gi)][0]?.[1]
      ?.match(/"([^"]+)"/g)
      ?.map((s) => s.replace(/"/g, '').split('.').pop()!)
      .slice(0, 5);
    const guess = closest(name, ALL_COLUMNS, 3);
    let text = `В таблице нет столбца \`${name}\`.`;
    if (guess) text += ` Возможно, опечатка и имелось в виду \`${guess}\`?`;
    else if (candidates?.length) text += ` Похожие по смыслу столбцы: ${candidates.map((c) => `\`${c}\``).join(', ')}.`;
    if (hasCyrillic(name)) {
      text += '\n\nНазвания столбцов в нашей базе — английскими буквами. Если это было текстовое значение, возьми его в одинарные кавычки.';
    }
    text += '\n\nВсе названия столбцов есть в панели **«Схема данных»**.';
    return { title: 'Столбец не найден', text, raw };
  }

  // Таблица не найдена
  if ((m = found(/Table with name ([^\s!]+) does not exist/i))) {
    const name = m[1];
    const guess = found(/Did you mean "([^"]+)"/i)?.[1] ?? closest(name, ALL_TABLES, 3);
    return {
      title: 'Таблица не найдена',
      text:
        `Таблицы \`${name}\` нет в базе.` +
        (guess ? ` Возможно, имелось в виду \`${guess}\`?` : '') +
        `\n\nДоступные таблицы: ${ALL_TABLES.map((t) => `\`${t}\``).join(', ')}.`,
      raw,
    };
  }

  // Функция не существует
  if ((m = found(/(?:Scalar|Aggregate|Table) Function with name "?([\w]+)"? does not exist/i))) {
    const guess = found(/Did you mean "([^"(]+)/i)?.[1];
    return {
      title: 'Такой функции нет',
      text:
        `Функции \`${m[1]}\` в этой базе данных нет.` +
        (guess ? ` Возможно, имелось в виду \`${guess}\`?` : ' Проверь написание.'),
      raw,
    };
  }

  // Столбец без агрегации рядом с COUNT/SUM без GROUP BY
  if ((m = found(/column "?([^"\s]+)"? must appear in the GROUP BY clause/i))) {
    return {
      title: 'Нельзя смешивать итог и отдельные строки',
      text:
        `В запросе есть агрегатная функция (COUNT, SUM, AVG…), которая сворачивает много строк в одну, ` +
        `и обычный столбец \`${m[1]}\`, у которого в каждой строке своё значение. База не понимает, какое из значений показать рядом с итогом.\n\n` +
        'Если нужен один общий итог — убери обычный столбец. Если нужен итог *для каждого* значения столбца — понадобится `GROUP BY` (это следующий модуль).',
      raw,
    };
  }

  if (found(/WHERE clause cannot contain aggregates/i)) {
    return {
      title: 'Агрегатная функция внутри WHERE',
      text:
        '`WHERE` проверяет каждую строку по отдельности, а `COUNT`, `SUM`, `AVG` считаются по многим строкам сразу — поэтому их нельзя использовать в `WHERE`.\n\n' +
        'Условие на отдельные строки пиши в `WHERE`, а функцию — в `SELECT`. (Для условий на итоги есть `HAVING` — будет в продвинутом модуле.)',
      raw,
    };
  }

  if (found(/aggregate function calls cannot be nested/i)) {
    return {
      title: 'Функция внутри функции',
      text: 'Нельзя вкладывать агрегатные функции друг в друга, например `SUM(COUNT(...))`. Посчитай нужный итог одной функцией.',
      raw,
    };
  }

  // Не подходит тип данных для функции
  if ((m = found(/No function matches the given name and argument types '(\w+)\(([^)]*)\)'/i))) {
    return {
      title: 'Функция не подходит для этого типа данных',
      text:
        `Функцию \`${m[1]}\` нельзя применить к данным типа \`${m[2]}\`.` +
        (/VARCHAR/i.test(m[2]) ? ' Например, `SUM` и `AVG` работают только с числами, а тут текст.' : '') +
        '\n\nПроверь, тот ли столбец ты передаёшь в функцию.',
      raw,
    };
  }

  // Сравнение разных типов
  if ((m = found(/Could not convert string '([^']*)' to (\w+)/i))) {
    const target = m[2].toUpperCase();
    const what = target.startsWith('INT') || target === 'DOUBLE' || target.startsWith('DECIMAL') ? 'число' : target === 'DATE' ? 'дату' : target;
    return {
      title: 'Не получилось превратить текст в ' + what,
      text:
        `База пыталась превратить текст \`'${m[1]}'\` в ${what} и не смогла.\n\n` +
        (what === 'дату'
          ? 'Даты пишут в формате `\'ГГГГ-ММ-ДД\'`, например `\'2026-03-01\'`.'
          : 'Скорее всего, столбец с числами сравнивается с текстом. Числа пишут **без кавычек**: `price > 1000`, а не `price > \'тысяча\'`.'),
      raw,
    };
  }

  if (found(/Cannot compare values of type (\w+) and type (\w+)|Cannot mix values of type/i)) {
    return {
      title: 'Сравниваются разные типы данных',
      text: 'Похоже, в условии сравниваются значения разных типов — например, число с текстом. Числа пишут без кавычек, текст и даты — в одинарных кавычках.',
      raw,
    };
  }

  if ((m = found(/Ambiguous reference to column name "([^"]+)"/i))) {
    return {
      title: 'Неясно, из какой таблицы столбец',
      text: `Столбец \`${m[1]}\` есть сразу в нескольких таблицах запроса. Укажи таблицу явно: \`таблица.${m[1]}\`.`,
      raw,
    };
  }

  if ((m = found(/Referenced table "([^"]+)" not found/i))) {
    return {
      title: 'Неизвестное имя таблицы',
      text: `В запросе используется \`${m[1]}.столбец\`, но таблицы или псевдонима \`${m[1]}\` в разделе FROM нет. Проверь написание.`,
      raw,
    };
  }

  if (found(/unterminated quoted (string|identifier)/i)) {
    return {
      title: 'Незакрытая кавычка',
      text: 'Где-то открыта кавычка, но не закрыта. У каждой `\'` должна быть пара: `\'Москва\'`.',
      raw,
    };
  }

  if (found(/syntax error at end of input/i)) {
    return {
      title: 'Запрос оборвался',
      text:
        'Запрос закончился раньше, чем ожидала база. Обычно не хватает чего-то в конце: названия таблицы после `FROM`, ' +
        'значения после `=`, закрывающей скобки `)` или слова `END` в конструкции `CASE`.',
      raw,
    };
  }

  if ((m = found(/syntax error at or near "([^"]*)"/i))) {
    const token = m[1];
    const upper = token.toUpperCase();
    let text = `Синтаксическая ошибка рядом со словом \`${token}\`.`;
    const typo = !KEYWORDS.includes(upper) ? closest(upper, KEYWORDS, 2) : undefined;
    if (typo) {
      text += ` Похоже на опечатку: может быть, \`${typo}\`?`;
    } else if (KEYWORDS.includes(upper)) {
      const beforeKw = new RegExp(`,\\s*${upper}\\b`, 'i');
      if (beforeKw.test(code)) {
        text += `\n\nПеред \`${upper}\` стоит **лишняя запятая**. После последнего столбца запятую не ставят.`;
      } else if (['WHERE', 'ORDER', 'LIMIT', 'GROUP', 'FROM'].includes(upper)) {
        text +=
          '\n\nПроверь порядок частей запроса. Он всегда такой:\n`SELECT` → `FROM` → `WHERE` → `ORDER BY` → `LIMIT`.' +
          '\n\nЕщё частая причина — пропущенная запятая или скобка прямо перед этим словом.';
      } else {
        text += '\n\nПроверь, что перед этим словом нет лишней или пропущенной запятой, скобки или кавычки.';
      }
    } else {
      text += '\n\nЧастые причины: пропущена или лишняя запятая, незакрытая скобка, текст без кавычек.';
    }
    return { title: 'Ошибка в написании запроса', text, raw };
  }

  if (found(/Division by zero/i)) {
    return { title: 'Деление на ноль', text: 'Где-то в вычислениях происходит деление на ноль. Проверь делитель.', raw };
  }

  if (found(/out of memory/i)) {
    return {
      title: 'Не хватило памяти',
      text: 'Результат получился слишком большим. Скорее всего, таблицы перемножились друг на друга. База перезапущена — попробуй исправить запрос.',
      raw,
    };
  }

  return {
    title: 'Ошибка при выполнении запроса',
    text:
      'Я не смог автоматически распознать эту ошибку. Прочитай текст ниже — обычно в нём есть название проблемного места (столбца, функции или слова), ' +
      'а строка `LINE` показывает, где именно ошибка.',
    raw,
  };
}
