## Фильтрация: маска из True и False

В SQL строки отбирает `WHERE`. В pandas — **маска**: столбец из `True`/`False`, который говорит, какие строки оставить.

```python
mask = customers["city"] == "Казань"
mask.head()
```

Подставляем маску в квадратные скобки — остаются только строки, где `True`:

```python
mask = customers["city"] == "Казань"
kazan = customers[mask]
kazan.head()
```

Обычно всё пишут в одну строку: `customers[customers["city"] == "Казань"]`.

## Несколько условий: & и |

В pandas вместо `and` / `or` используют **`&`** (и) и **`|`** (или), а **каждое условие берут в скобки**:

```python
expensive_tech = products[(products["category"] == "Электроника") & (products["price"] > 30000)]
expensive_tech[["product_name", "price"]]
```

> ⚠️ Самая частая ошибка новичка — забыть скобки или написать `and`. Python выдаст ошибку «The truth value of a Series is ambiguous» — приложение подскажет, как исправить.

`~` — отрицание («не»): `orders[~(orders["status"] == "cancelled")]`.

## Удобные методы для условий

| Задача | pandas | SQL |
|---|---|---|
| одно из значений | `df["status"].isin(["cancelled", "returned"])` | `IN (…)` |
| диапазон | `df["price"].between(1000, 2000)` | `BETWEEN` |
| содержит текст | `df["product_name"].str.contains("набор", case=False)` | `ILIKE '%набор%'` |
| пустое значение | `df["city"].isna()` | `IS NULL` |
| заполнено | `df["city"].notna()` | `IS NOT NULL` |
| дата после | `df["order_date"] >= "2026-06-01"` | `>= '2026-06-01'` |

```python
orders[orders["status"].isin(["cancelled", "returned"]) & (orders["payment_method"] == "cash")].head()
```

## Сортировка

```python
products.sort_values("price", ascending=False).head(5)
```

- `ascending=False` — по убыванию;
- по нескольким столбцам: `sort_values(["category", "price"], ascending=[True, False])`;
- топ-N короче: `products.nlargest(5, "price")`.

## Фильтр + нужные столбцы

Отбор строк и столбцов сразу — через `.loc[условие, столбцы]`:

```python
products.loc[products["category"] == "Книги", ["product_name", "price"]]
```

## Шпаргалка

| Задача | Код |
|---|---|
| фильтр | `df[df["a"] == 1]` |
| два условия | `df[(df["a"] == 1) & (df["b"] > 5)]` |
| или | `df[(…) \| (…)]` |
| сортировка | `df.sort_values("a", ascending=False)` |
| топ-5 | `df.nlargest(5, "a")` |
| строки + столбцы | `df.loc[условие, ["a", "b"]]` |
