## Фильтр по итогам группы

`WHERE` отбирает **строки** до группировки. А если нужно отобрать **группы** по их итогу — например, «только клиенты, у которых 10 и больше заказов»? В `WHERE` так нельзя: количество заказов ещё не посчитано. Для этого есть `HAVING` — «имеющие».

```sql
SELECT customer_id, COUNT(*) AS orders_cnt
FROM orders
GROUP BY customer_id
HAVING COUNT(*) >= 15
ORDER BY orders_cnt DESC;
```

Это самые лояльные клиенты магазина.

## WHERE или HAVING

| | WHERE | HAVING |
|---|---|---|
| Когда работает | **до** группировки | **после** группировки |
| Что проверяет | каждую строку | каждую группу |
| Агрегаты (`COUNT`, `SUM`) | нельзя | можно |
| Пример | `WHERE status = 'delivered'` | `HAVING SUM(amount) > 100000` |

Их можно и нужно использовать вместе:

```sql
-- Города, где доставленных заказов больше чем на 20 млн ₽
SELECT c.city, SUM(o.amount) AS revenue
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.status = 'delivered'      -- сначала отбрасываем недоставленные заказы
GROUP BY c.city
HAVING SUM(o.amount) > 20000000   -- потом отбрасываем «маленькие» города
ORDER BY revenue DESC;
```

(Здесь есть `JOIN` — соединение таблиц. Подробно разберём его в следующей теме.)

> 💡 Правило: если условие можно проверить для отдельной строки — пиши его в `WHERE`. Это быстрее: база не тратит время на группы, которые потом всё равно отбросит.

## Доли и проценты в группах

В `HAVING` и `SELECT` можно использовать выражения из агрегатов. Например, процент брака по операторам завода:

```sql
SELECT operator_id,
       SUM(defect_units)   AS defects,
       SUM(produced_units) AS produced,
       ROUND(100.0 * SUM(defect_units) / SUM(produced_units), 2) AS defect_pct
FROM production
GROUP BY operator_id
ORDER BY defect_pct DESC
LIMIT 5;
```

Считать долю нужно как **сумма брака / сумма выпуска**, а не как среднее долей по сменам: смены бывают разного размера.

## Шпаргалка

```text
SELECT   группа, АГРЕГАТ(...) AS итог
FROM     таблица
WHERE    условие_на_строки
GROUP BY группа
HAVING   условие_на_итог
ORDER BY итог DESC;
```
