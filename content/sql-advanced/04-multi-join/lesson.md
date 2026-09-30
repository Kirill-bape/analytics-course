## Цепочка из нескольких таблиц

Вопрос «какая выручка по категориям товаров?» требует сразу трёх таблиц:

- `order_items` — какие товары и за сколько продали;
- `products` — к какой категории относится товар;
- `orders` — статус заказа (считаем только доставленные).

`JOIN` просто повторяют — каждая следующая таблица присоединяется к уже собранному результату:

```sql
-- chart: bar
SELECT p.category,
       SUM(oi.quantity * oi.price) AS revenue
FROM order_items oi
JOIN orders   o ON o.order_id   = oi.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.status = 'delivered'
GROUP BY p.category
ORDER BY revenue DESC;
```

> 💡 Выручку по товарам считают из `order_items` как `quantity × price`: цена на момент покупки хранится там. Текущая цена в `products` могла измениться.

Совет: рисуй на бумажке цепочку связей. Все связи есть в панели «Схема данных»:
`customers` ← `orders` ← `order_items` → `products`.

## Ловушка 1: размножение строк

После `JOIN` с `order_items` каждый заказ повторяется столько раз, сколько в нём товаров. Если потом посчитать `COUNT(*)` или `SUM(o.amount)` — заказ с тремя товарами посчитается трижды.

```sql
-- ❌ Сумма заказов «раздулась»: каждый заказ сложился столько раз, сколько в нём позиций
SELECT SUM(o.amount) AS wrong_revenue
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
WHERE o.status = 'delivered';
```

Сравни с правильной выручкой (около 154 млн). Как избежать:

- считать по той таблице, которой соответствует уровень детализации (`amount` — из `orders` без JOIN с позициями);
- для количества заказов использовать `COUNT(DISTINCT o.order_id)`.

## Ловушка 2: условие для LEFT JOIN — в ON или в WHERE?

Нужно: **все** товары категории «Спорт и отдых» и сколько штук каждого продано в январе 2026 — включая товары, которых в январе не покупали.

```sql
-- ❌ WHERE по правой таблице выкидывает товары без январских продаж — LEFT JOIN превращается в обычный JOIN
SELECT p.product_name, SUM(oi.quantity) AS units
FROM products p
LEFT JOIN order_items oi ON oi.product_id = p.product_id
LEFT JOIN orders o ON o.order_id = oi.order_id
WHERE p.category = 'Спорт и отдых'
  AND o.order_date >= '2026-01-01' AND o.order_date < '2026-02-01'
GROUP BY p.product_name;
```

У товаров без продаж `o.order_date` — `NULL`, и условие `WHERE` их отбрасывает. Правильно — отфильтровать заказы **до** присоединения: например, подготовить январские позиции подзапросом, а потом сделать `LEFT JOIN` к нему (подробнее о подзапросах — в следующей теме):

```sql
SELECT p.product_name, COALESCE(SUM(j.quantity), 0) AS units
FROM products p
LEFT JOIN (
    SELECT oi.product_id, oi.quantity
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id
    WHERE o.order_date >= '2026-01-01' AND o.order_date < '2026-02-01'
) AS j ON j.product_id = p.product_id
WHERE p.category = 'Спорт и отдых'
GROUP BY p.product_name
ORDER BY units DESC, p.product_name;
```

Условие на **левую** таблицу (`p.category`) спокойно живёт в `WHERE`. Условия на **правую** таблицу при `LEFT JOIN` ставят в `ON` или в подзапрос.

## USING — короткая запись

Если столбцы для соединения называются одинаково, можно писать `USING`:

```sql
SELECT order_id, full_name
FROM orders
JOIN customers USING (customer_id)
LIMIT 5;
```

## Шпаргалка

| Задача | Как |
|---|---|
| три таблицы | `FROM a JOIN b ON … JOIN c ON …` |
| выручка по товарам | `SUM(oi.quantity * oi.price)` |
| число заказов после JOIN с позициями | `COUNT(DISTINCT o.order_id)` |
| условие на правую таблицу при LEFT JOIN | в `ON` или в подзапрос, не в `WHERE` |
