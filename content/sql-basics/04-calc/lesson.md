## Считаем прямо в запросе

В `SELECT` можно писать не только названия столбцов, но и **выражения** — как формулы в Excel. Результат появится как новый столбец (сама таблица не меняется).

```sql
-- Сколько магазин зарабатывает с одной штуки товара
SELECT product_name, price, cost_price,
       price - cost_price AS profit
FROM products
LIMIT 5;
```

Арифметика: `+` сложить, `-` вычесть, `*` умножить, `/` разделить, скобки — как в математике.

> 💡 Вычисленным столбцам **всегда давай имя через `AS`**. Иначе столбец будет называться как формула, например `(price - cost_price)`, — неудобно читать.

## Округление: ROUND

`ROUND(значение, знаков)` округляет число до нужного количества знаков после запятой:

```sql
SELECT product_name, price,
       ROUND(price * 0.85, 2) AS price_minus_15,
       ROUND(price / 1000, 1) AS price_thousands
FROM products
LIMIT 5;
```

## Проценты и маржинальность

Маржинальность — какая доля цены остаётся магазину после себестоимости. Это одна из главных метрик в торговле:

```sql
SELECT product_name, price, cost_price,
       ROUND((price - cost_price) / price * 100, 1) AS margin_pct
FROM products
LIMIT 5;
```

> ⚠️ Об этом часто спрашивают на собеседованиях: в **PostgreSQL** деление целого числа на целое даёт целое: `7 / 2 = 3`. В нашей базе (DuckDB) `7 / 2 = 3.5`. Чтобы в PostgreSQL получить дробь, пишут `7 * 1.0 / 2` или `7::numeric / 2`. Запомни это на будущее.

## Склеиваем текст: ||

Оператор `||` соединяет строки:

```sql
SELECT brand || ' — ' || product_name AS title
FROM products
LIMIT 5;
```

## Условия внутри SELECT: CASE

`CASE` — это «если… то… иначе…», как функция `ЕСЛИ` в Excel. С его помощью раскладывают значения по группам:

```sql
SELECT order_id, amount,
       CASE
           WHEN amount >= 10000 THEN 'крупный'
           WHEN amount >= 3000  THEN 'средний'
           ELSE 'маленький'
       END AS order_size
FROM orders
LIMIT 10;
```

Как это работает:

1. Условия `WHEN` проверяются **сверху вниз**.
2. Срабатывает **первое** верное условие — остальные уже не проверяются.
3. Если ни одно не подошло — берётся значение из `ELSE`. (Если `ELSE` нет — будет пусто, `NULL`.)
4. В конце обязательно `END`.

Поэтому во втором `WHEN` не нужно писать `amount >= 3000 AND amount < 10000` — крупные заказы уже «забрал» первый `WHEN`.

Есть и короткая форма — когда сравниваем один столбец с разными значениями:

```sql
SELECT order_id, status,
       CASE status
           WHEN 'delivered' THEN 'Доставлен'
           WHEN 'cancelled' THEN 'Отменён'
           WHEN 'returned'  THEN 'Возврат'
           ELSE 'В процессе'
       END AS status_ru
FROM orders
LIMIT 10;
```

## Вычисления в WHERE

В `WHERE` тоже можно считать:

```sql
-- Товары, на которых магазин зарабатывает больше 20 000 ₽ с одной штуки
SELECT product_name, price, cost_price
FROM products
WHERE price - cost_price > 20000;
```

> 💡 В DuckDB можно сослаться в `WHERE` на псевдоним из `SELECT` (например, `WHERE profit > 20000`), а в PostgreSQL — нельзя. Надёжнее повторять само выражение.

## Шпаргалка

| Задача | Как написать |
|---|---|
| новый столбец | `price - cost_price AS profit` |
| округлить | `ROUND(x, 2)` |
| процент | `ROUND(part / total * 100, 1)` |
| склеить текст | `brand \|\| ' ' \|\| product_name` |
| если–то–иначе | `CASE WHEN … THEN … ELSE … END AS имя` |
