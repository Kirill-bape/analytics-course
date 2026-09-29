## Даты — основа аналитики

Почти любой отчёт привязан ко времени: выручка за месяц, заказы за неделю, рост к прошлому году. Поэтому работа с датами — must have для аналитика.

В нашей базе даты хранятся в типе `DATE` и выглядят так: `2026-03-15` — **год-месяц-день**. Это международный стандарт (ISO): в таком виде даты правильно сортируются и сравниваются.

## Фильтр по периоду

Даты в условиях пишут в одинарных кавычках в том же формате:

```sql
-- Заказы за март 2026
SELECT order_id, order_date, amount
FROM orders
WHERE order_date >= '2026-03-01'
  AND order_date <  '2026-04-01'
LIMIT 10;
```

> 💡 Надёжный шаблон для периода: **«больше или равно началу» и «строго меньше начала следующего периода»**. Он работает и для дат, и для дат со временем, и не нужно помнить, сколько дней в месяце.

`BETWEEN '2026-03-01' AND '2026-03-31'` тоже подойдёт для столбца типа `DATE` (обе границы входят). Но если в столбце есть время (`2026-03-31 18:30`), такой заказ в `BETWEEN` не попадёт — поэтому первый шаблон надёжнее.

## Достаём часть даты: EXTRACT

`EXTRACT(часть FROM дата)` возвращает год, месяц, день и т. д.:

```sql
SELECT order_id, order_date,
       EXTRACT(YEAR  FROM order_date) AS y,
       EXTRACT(MONTH FROM order_date) AS m,
       EXTRACT(DAY   FROM order_date) AS d,
       EXTRACT(DOW   FROM order_date) AS weekday
FROM orders
LIMIT 5;
```

| Часть | Что возвращает |
|---|---|
| `YEAR` | год: 2026 |
| `MONTH` | месяц: от 1 до 12 |
| `DAY` | день месяца: от 1 до 31 |
| `DOW` | день недели: **0 — воскресенье**, 1 — понедельник, …, 6 — суббота |
| `ISODOW` | день недели по-европейски: 1 — понедельник, …, 7 — воскресенье |
| `QUARTER` | квартал: от 1 до 4 |

`EXTRACT` удобно использовать в `WHERE`:

```sql
-- Сколько заказов сделано в декабре (любого года)
SELECT COUNT(*) AS december_orders
FROM orders
WHERE EXTRACT(MONTH FROM order_date) = 12;
```

## Начало периода: date_trunc

`date_trunc('month', дата)` «обрезает» дату до начала месяца: `2026-03-15` → `2026-03-01`. Это пригодится для группировки по месяцам в продвинутом модуле.

```sql
SELECT order_date,
       date_trunc('month', order_date) AS month_start,
       date_trunc('year', order_date)  AS year_start
FROM orders
LIMIT 5;
```

## Разница между датами

Если вычесть одну дату из другой, получится **количество дней** между ними:

```sql
-- Сколько дней шла доставка
SELECT order_id, order_date, delivery_date,
       delivery_date - order_date AS delivery_days
FROM orders
WHERE status = 'delivered'
LIMIT 10;
```

## Прибавляем время: INTERVAL

```sql
-- Крайний срок возврата — 14 дней после доставки
SELECT order_id, delivery_date,
       delivery_date + INTERVAL '14 days' AS return_deadline
FROM orders
WHERE status = 'delivered'
LIMIT 5;
```

Бывает `INTERVAL '1 month'`, `'7 days'`, `'1 year'`. Результат показывается с временем `00:00:00` — это нормально.

> 💡 В реальной работе часто пишут `CURRENT_DATE` — «сегодня», например `order_date >= CURRENT_DATE - INTERVAL '30 days'` («за последние 30 дней»). Но наши учебные данные заканчиваются **30 июня 2026**, поэтому в заданиях мы используем конкретные даты.

## Шпаргалка

| Задача | Как написать |
|---|---|
| период | `order_date >= '2026-03-01' AND order_date < '2026-04-01'` |
| год / месяц | `EXTRACT(YEAR FROM order_date)` |
| день недели | `EXTRACT(DOW FROM order_date)` — 0 = вс, 6 = сб |
| начало месяца | `date_trunc('month', order_date)` |
| разница в днях | `delivery_date - order_date` |
| сдвиг даты | `order_date + INTERVAL '7 days'` |
