## merge — JOIN в pandas

Соединение таблиц в pandas делает `merge`. Всё, что ты знаешь про `JOIN` из SQL, работает и здесь.

```python
orders_c = orders.merge(customers, on="customer_id", how="inner")
orders_c[["order_id", "order_date", "full_name", "city"]].head()
```

- `on="customer_id"` — по какому столбцу соединять (аналог `ON a.id = b.id`);
- `how=` — тип соединения.

| how | SQL | Что остаётся |
|---|---|---|
| `"inner"` (по умолчанию) | `INNER JOIN` | только строки с парой |
| `"left"` | `LEFT JOIN` | все строки левой таблицы |
| `"right"` | `RIGHT JOIN` | все строки правой |
| `"outer"` | `FULL JOIN` | все строки обеих |

Если ключи называются по-разному: `left_on="line_id", right_on="id"`.

## merge + groupby

Главный рабочий сценарий: присоединить справочник и посчитать итоги по его полю.

```python
(
    orders[orders["status"] == "delivered"]
    .merge(customers[["customer_id", "city"]], on="customer_id")
    .groupby("city")["amount"]
    .sum()
    .sort_values(ascending=False)
    .head(5)
)
```

> 💡 Из справочника лучше брать только нужные столбцы (`customers[["customer_id", "city"]]`) — таблица получится компактнее, а одинаковые имена столбцов не будут конфликтовать.

## Одинаковые названия столбцов

Если в обеих таблицах есть столбец с одним именем (кроме ключа), pandas добавит к ним суффиксы `_x` и `_y`. Например, у `order_items` и `products` есть столбец `price`: после соединения будут `price_x` (цена продажи) и `price_y` (текущая цена). Суффиксы можно задать: `suffixes=("_sold", "_now")`.

## Поиск строк без пары

Аналог `LEFT JOIN … WHERE правая.id IS NULL`: соединяем с `indicator=True` — появится столбец `_merge` со значениями `both`, `left_only`, `right_only`.

```python
m = customers.merge(orders[["customer_id"]].drop_duplicates(), on="customer_id", how="left", indicator=True)
m["_merge"].value_counts()
```

`left_only` — клиенты без заказов.

## Несколько таблиц

`merge` можно вызывать цепочкой:

```python
items = (
    order_items
    .merge(orders[["order_id", "status"]], on="order_id")
    .merge(products[["product_id", "category"]], on="product_id")
)
items["revenue"] = items["quantity"] * items["price"]
items[items["status"] == "delivered"].groupby("category")["revenue"].sum().sort_values(ascending=False)
```

Строка `items["revenue"] = …` создаёт **новый столбец** — как вычисляемое поле в SQL.

## Шпаргалка

| Задача | Код |
|---|---|
| соединить | `a.merge(b, on="key")` |
| все строки слева | `how="left"` |
| разные имена ключа | `left_on="x", right_on="y"` |
| найти строки без пары | `indicator=True` + `_merge == "left_only"` |
| новый столбец | `df["c"] = df["a"] * df["b"]` |
