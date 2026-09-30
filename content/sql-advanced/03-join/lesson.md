## Зачем соединять таблицы

В таблице `orders` есть номер клиента, но нет его города. Город лежит в `customers`. Чтобы посчитать выручку по городам, нужно **соединить** таблицы: для каждого заказа найти его клиента. Это делает `JOIN`.

Данные специально хранят в разных таблицах: город клиента записан один раз, а не повторяется в каждом из его 20 заказов. Поэтому `JOIN` — самая частая операция в работе аналитика и самая частая тема на собеседованиях.

## INNER JOIN — только совпадения

```sql
SELECT o.order_id, o.order_date, c.full_name, c.city
FROM orders AS o
JOIN customers AS c ON c.customer_id = o.customer_id
LIMIT 10;
```

Разберём по частям:

- `orders AS o` — даём таблице короткое имя (**псевдоним**) `o`, чтобы не писать `orders` каждый раз;
- `JOIN customers AS c` — присоединяем клиентов;
- `ON c.customer_id = o.customer_id` — **условие соединения**: строки склеиваются, когда номера клиента совпадают;
- `c.city` — столбец `city` из таблицы с псевдонимом `c`.

`JOIN` без уточнения — это `INNER JOIN`: в результат попадают **только** строки, у которых нашлась пара в обеих таблицах.

> 💡 Если столбец с таким именем есть в обеих таблицах (как `customer_id`), указывать таблицу обязательно: `o.customer_id`. Иначе будет ошибка «Ambiguous reference» — база не знает, какой взять.

## JOIN + GROUP BY = главный отчёт аналитика

```sql
-- chart: bar
SELECT c.city, SUM(o.amount) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'delivered'
GROUP BY c.city
ORDER BY revenue DESC
LIMIT 10;
```

## LEFT JOIN — все строки левой таблицы

А если нужны **все** клиенты, даже те, кто ничего не заказал? `INNER JOIN` их потеряет — у них нет пары в `orders`. Для этого есть `LEFT JOIN`: он берёт **все** строки левой таблицы (той, что в `FROM`), а там, где пары нет, заполняет столбцы правой таблицы пустотой (`NULL`).

```sql
SELECT c.customer_id, c.full_name, o.order_id
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
WHERE o.order_id IS NULL
LIMIT 10;
```

Это классический приём — **поиск «сирот»**: `LEFT JOIN` + `WHERE правая.id IS NULL` находит строки, у которых нет пары. Так ищут клиентов без заказов, товары без продаж, заказы без оплаты.

| Тип | Что возвращает |
|---|---|
| `INNER JOIN` (`JOIN`) | только строки с парой в обеих таблицах |
| `LEFT JOIN` | все строки левой таблицы + пары из правой (или `NULL`) |
| `RIGHT JOIN` | наоборот — все строки правой (используют редко: проще поменять таблицы местами) |
| `FULL JOIN` | все строки обеих таблиц |

## Соединение по нескольким таблицам

`JOIN` можно повторять — об этом следующая тема. Например, данные завода: выпуск по названиям линий.

```sql
SELECT l.line_name, l.workshop, SUM(p.produced_units) AS produced
FROM production p
JOIN production_lines l ON l.line_id = p.line_id
GROUP BY l.line_name, l.workshop
ORDER BY produced DESC;
```

## Шпаргалка

```text
SELECT a.столбец, b.столбец
FROM таблица_a AS a
[LEFT] JOIN таблица_b AS b ON b.ключ = a.ключ
WHERE ...
```

| Задача | Как |
|---|---|
| подтянуть данные из справочника | `JOIN ... ON` |
| сохранить все строки слева | `LEFT JOIN` |
| найти строки без пары | `LEFT JOIN ... WHERE b.ключ IS NULL` |
