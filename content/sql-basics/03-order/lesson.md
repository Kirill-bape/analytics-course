## Сортировка: ORDER BY

Без сортировки база возвращает строки в произвольном порядке. Чтобы упорядочить результат, в конце запроса добавляют `ORDER BY` («упорядочить по»):

```sql
SELECT product_name, price
FROM products
ORDER BY price;
```

По умолчанию сортировка идёт **по возрастанию** — от меньшего к большему. Можно написать это явно: `ASC` (ascending — «по возрастанию»). Для сортировки **по убыванию** — `DESC` (descending):

```sql
SELECT product_name, price
FROM products
ORDER BY price DESC;
```

Текст сортируется по алфавиту, даты — от ранних к поздним.

> 💡 Пустые значения (`NULL`) при сортировке обычно оказываются в конце. Подробно про `NULL` — в теме 5.

## Сортировка по нескольким столбцам

Можно перечислить несколько столбцов через запятую. Сначала строки сортируются по первому столбцу, а **при равенстве** — по второму:

```sql
-- Сначала по категории (А→Я), внутри категории — от дорогих к дешёвым
SELECT category, product_name, price
FROM products
ORDER BY category, price DESC;
```

Направление (`ASC`/`DESC`) указывается **для каждого столбца отдельно**.

## ТОП-N: ORDER BY + LIMIT

Самый частый вопрос бизнеса — «покажи топ-10». Это сортировка плюс ограничение числа строк:

```sql
-- 3 самых дорогих товара
SELECT product_name, price
FROM products
ORDER BY price DESC
LIMIT 3;
```

> ⚠️ `LIMIT` без `ORDER BY` даёт просто «какие-то» строки. Для топа сортировка обязательна.

Если у нескольких строк одинаковое значение, их порядок между собой не определён. Поэтому в настоящих отчётах добавляют второй столбец для сортировки — например, `ORDER BY amount DESC, order_id`.

## Уникальные значения: DISTINCT

`DISTINCT` убирает повторяющиеся строки из результата. Например, какие вообще бывают статусы заказов?

```sql
SELECT DISTINCT status
FROM orders;
```

В таблице ≈ 15 000 заказов, а статусов — всего пять. `DISTINCT` пишется сразу после `SELECT` и действует на **всю строку целиком**:

```sql
-- Уникальные сочетания «категория + бренд»
SELECT DISTINCT category, brand
FROM products
ORDER BY category, brand;
```

> 💡 Привычка аналитика: `SELECT DISTINCT столбец` — быстрый способ узнать, какие значения встречаются в столбце, прежде чем писать `WHERE`.

## Порядок частей запроса

```text
SELECT [DISTINCT] столбцы
FROM     таблица
WHERE    условие
ORDER BY столбцы [ASC | DESC]
LIMIT    число
```

Этот порядок строгий: `ORDER BY` — после `WHERE`, `LIMIT` — в самом конце.

```sql
-- 5 самых свежих заказов с промокодом BLACKFRIDAY
SELECT order_id, order_date, amount
FROM orders
WHERE promo_code = 'BLACKFRIDAY'
ORDER BY order_date DESC, order_id DESC
LIMIT 5;
```

## Шпаргалка

| Задача | Как написать |
|---|---|
| по возрастанию | `ORDER BY price` |
| по убыванию | `ORDER BY price DESC` |
| по двум столбцам | `ORDER BY category, price DESC` |
| топ-10 | `ORDER BY amount DESC LIMIT 10` |
| без повторов | `SELECT DISTINCT city FROM customers` |
