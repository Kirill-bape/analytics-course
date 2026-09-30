// Перевод ошибок Python на понятный язык.

import type { ExplainedError } from '../sql/errors';
import { PythonTimeoutError } from './engine';

function lastLine(traceback: string): string {
  const lines = traceback.trim().split('\n').filter((l) => l.trim());
  return lines[lines.length - 1] ?? traceback;
}

function lineNumber(traceback: string): number | null {
  const all = [...traceback.matchAll(/File "<code>", line (\d+)/g)];
  return all.length ? Number(all[all.length - 1][1]) : null;
}

const where = (n: number | null) => (n ? ` (строка ${n})` : '');

export function explainPythonError(err: unknown): ExplainedError {
  if (err instanceof PythonTimeoutError) {
    return {
      title: 'Код выполнялся слишком долго',
      text:
        'Выполнение остановлено через 30 секунд. Чаще всего это **бесконечный цикл**: например, `while True:` без `break` или цикл, в котором не меняется условие. Python перезапущен — исправь код и запусти снова.',
    };
  }
  const raw = String((err as Error)?.message ?? err);
  const last = lastLine(raw);
  const line = lineNumber(raw);
  let m: RegExpMatchArray | null;

  if ((m = last.match(/^NameError: name '([^']+)' is not defined/))) {
    const name = m[1];
    let text = `Python не знает, что такое \`${name}\`${where(line)}.`;
    if (/^(print|len|sum|round|range)$/i.test(name) && name !== name.toLowerCase()) {
      text += ` Имена в Python чувствительны к регистру: нужно \`${name.toLowerCase()}\`.`;
    } else if (/^[а-яё]/i.test(name)) {
      text += ' Похоже, это текст без кавычек. Текст (строки) в Python пишут в кавычках: `"Москва"` или `\'Москва\'`.';
    } else {
      text += ' Обычно это опечатка в названии переменной или переменная ещё не создана (строка с `имя = …` должна идти выше). Если это модуль — не забыт ли `import`?';
    }
    return { title: 'Неизвестное имя', text, raw };
  }

  if ((m = last.match(/^KeyError: (.+)$/))) {
    const key = m[1].replace(/^['"]|['"]$/g, '');
    return {
      title: 'Такого столбца или ключа нет',
      text:
        `Не найден ключ \`${key}\`${where(line)}. В pandas это обычно значит, что **в таблице нет столбца с таким названием**. ` +
        'Проверь написание (регистр букв важен) — список столбцов можно посмотреть командой `df.columns` или в панели «Схема данных».',
      raw,
    };
  }

  if ((m = last.match(/^AttributeError: '(\w+)' object has no attribute '([^']+)'/))) {
    const [, type, attr] = m;
    let text = `У объекта типа \`${type}\` нет \`${attr}\`${where(line)}.`;
    if (type === 'DataFrame' || type === 'Series') {
      text += ` Возможно, опечатка в названии метода или столбца. Если \`${attr}\` — это столбец, обращайся к нему так: \`df['${attr}']\`.`;
    } else if (type === 'NoneType') {
      text += ' Переменная содержит `None` — обычно так бывает, если метод ничего не возвращает (например, `inplace=True`) или функция без `return`.';
    }
    return { title: 'Нет такого метода или свойства', text, raw };
  }

  if (/^(SyntaxError|IndentationError|TabError)/.test(last)) {
    const isIndent = /IndentationError|TabError|indent/i.test(last);
    let text = `Python не смог прочитать код${where(line)}. `;
    if (isIndent) {
      text += 'Проблема с **отступами**. В Python отступы важны: строки внутри `if`, `for`, `def` сдвигают на 4 пробела, а остальные — нет.';
    } else if (/was never closed|unexpected EOF|'\(' was never closed/.test(last)) {
      text += 'Не закрыта скобка или кавычка. У каждой `(`, `[`, `{`, `"` должна быть пара.';
    } else if (/unterminated string/i.test(last)) {
      text += 'Не закрыта кавычка у строки: `"Москва"` — кавычки должны быть с двух сторон.';
    } else if (/expected ':'/.test(last)) {
      text += 'После `if`, `for`, `while`, `def` в конце строки нужно двоеточие `:`.';
    } else if (/invalid syntax\. Maybe you meant '==' or ':=' instead of '='/.test(last) || /cannot assign/.test(last)) {
      text += 'Для **сравнения** используется `==` (два знака), а один `=` — это присваивание.';
    } else if (/Perhaps you forgot a comma/.test(last)) {
      text += 'Похоже, пропущена запятая между элементами.';
    } else {
      text += 'Проверь скобки, кавычки, двоеточия и запятые в этой строке и в строке перед ней.';
    }
    return { title: 'Ошибка в записи кода', text, raw };
  }

  if ((m = last.match(/^TypeError: (.+)$/))) {
    const msg = m[1];
    let text = `Операция не подходит для этих типов данных${where(line)}.`;
    if (/can only concatenate str|unsupported operand type\(s\) for \+: 'int' and 'str'|must be str, not int/.test(msg)) {
      text += ' Складываются текст и число. Преврати число в текст через `str(x)` или используй f-строку: `f"Итого: {x}"`.';
    } else if (/not callable/.test(msg)) {
      text += ' Что-то вызывается как функция (со скобками), хотя это не функция. Например, `df.shape()` вместо `df.shape`.';
    } else if (/unexpected keyword argument '([^']+)'/.test(msg)) {
      text += ` У функции нет параметра \`${msg.match(/unexpected keyword argument '([^']+)'/)![1]}\` — проверь написание.`;
    } else if (/missing \d+ required positional argument/.test(msg)) {
      text += ' Функции передано меньше значений, чем ей нужно.';
    } else if (/'<|'>|not supported between instances/.test(msg)) {
      text += ' Сравниваются несравнимые значения — например, число с текстом.';
    } else {
      text += ` Сообщение Python: «${msg}».`;
    }
    return { title: 'Неподходящий тип данных', text, raw };
  }

  if ((m = last.match(/^ValueError: (.+)$/))) {
    const msg = m[1];
    let text = `Неподходящее значение${where(line)}.`;
    if (/truth value of a (Series|DataFrame) is ambiguous/.test(msg)) {
      text +=
        ' Для условий в pandas вместо `and` / `or` используют `&` / `|`, а каждое условие берут в скобки: `df[(df.a > 1) & (df.b == "x")]`.';
    } else if (/could not convert string to float|invalid literal for int/.test(msg)) {
      text += ' Не получилось превратить текст в число — проверь, что в данных действительно числа.';
    } else {
      text += ` Сообщение Python: «${msg}».`;
    }
    return { title: 'Ошибка значения', text, raw };
  }

  if (/^ZeroDivisionError/.test(last)) {
    return { title: 'Деление на ноль', text: `В вычислениях есть деление на ноль${where(line)}.`, raw };
  }
  if (/^IndexError/.test(last)) {
    return {
      title: 'Выход за границы',
      text: `Обращение к элементу, которого нет${where(line)}. Помни, что нумерация в Python начинается с 0: у списка из 3 элементов индексы 0, 1, 2.`,
      raw,
    };
  }
  if ((m = last.match(/^ModuleNotFoundError: No module named '([^']+)'/))) {
    return {
      title: 'Такой библиотеки нет',
      text: `Библиотека \`${m[1]}\` недоступна. В курсе можно использовать pandas, numpy, scipy и matplotlib.`,
      raw,
    };
  }

  return {
    title: 'Ошибка при выполнении кода',
    text: `Python сообщил об ошибке${where(line)}: «${last}». Прочитай текст ниже — последняя строка обычно самая важная.`,
    raw,
  };
}
