## Откуда ещё берутся данные

Файлы — не единственный источник. Аналитик забирает данные:

- из **баз данных** — прямо SQL-запросом из Python;
- из **API** — программного интерфейса сервиса: курсы валют, рекламные кабинеты, CRM, погода;
- со **страниц сайтов** — парсингом, когда API нет.

Во всех трёх случаях данные приходят «сырыми», и их нужно превратить в DataFrame.

> 🧪 Учебное приложение работает без интернета, поэтому код с настоящими запросами показан серым блоком и здесь не запускается. Всё остальное — разбор JSON, сборка таблиц, регулярные выражения — можно запускать.

## JSON — язык API

Почти все API отвечают в формате **JSON**: это вложенные словари и списки, записанные текстом. В Python его читает модуль `json`:

```python
import json

text = '{"date": "2026-06-30", "base": "RUB", "rates": {"USD": 0.0127, "EUR": 0.0109}}'
data = json.loads(text)          # текст → словарь
print(data["rates"]["USD"])
print(json.dumps(data, ensure_ascii=False, indent=2))   # словарь → красивый текст
```

`json.loads` превращает текст в словари и списки Python. Дальше по ним ходят ключами: `data["rates"]["USD"]`.

## Запрос к API

```py
import requests

resp = requests.get(
    "https://api.example.com/v1/orders",
    params={"date_from": "2026-06-01", "page": 1},
    headers={"Authorization": f"Bearer {API_TOKEN}"},
    timeout=30,
)
resp.raise_for_status()      # если ошибка — сразу исключение
data = resp.json()           # ответ уже разобран из JSON
```

Коды ответа, которые нужно знать:

| Код | Что значит |
|---|---|
| 200 | всё хорошо |
| 400 | неправильный запрос: проверь параметры |
| 401 / 403 | нет доступа: неверный или просроченный ключ |
| 404 | такого адреса нет |
| 429 | слишком много запросов: подожди и повтори |
| 500 и выше | ошибка на стороне сервиса |

> ⚠️ **Ключи и токены API — как пароли.** Не пиши их прямо в коде и никогда не публикуй в GitHub или в чате. Храни в переменных окружения или в отдельном файле, исключённом из репозитория (`.env` + `.gitignore`), а в коде читай: `os.environ["API_TOKEN"]`. Утёкший ключ позволяет чужим людям действовать от твоего имени — и за твой счёт.

## Из вложенного JSON в таблицу

Ответ API обычно — список записей, внутри которых есть вложенные словари. `pd.json_normalize` раскладывает их в плоскую таблицу:

```python
response = [
    {"id": 1, "amount": 4990, "client": {"name": "Анна", "city": "Москва"}, "items": 2},
    {"id": 2, "amount": 1290, "client": {"name": "Олег", "city": "Казань"}, "items": 1},
]
df = pd.json_normalize(response)
print(df)
```

Вложенные поля превратились в столбцы `client.name` и `client.city`. Если в записи есть **список** (например, товары заказа), используют `record_path` и `meta`: каждая позиция станет строкой, а поля заказа повторятся.

## Пагинация: данные по страницам

API редко отдаёт всё сразу: обычно по 100 записей на страницу. Чтобы собрать всё, запрашивают страницы в цикле, пока не придёт пустая:

```python
def get_page(page):
    """Имитация API: 250 записей, по 100 на страницу."""
    start = (page - 1) * 100
    return [{"id": i, "value": i * 10} for i in range(start, min(start + 100, 250))]

rows, page = [], 1
while True:
    batch = get_page(page)
    if not batch:
        break
    rows.extend(batch)
    page += 1

df = pd.DataFrame(rows)
print(len(df), "записей за", page - 1, "страницы")
```

В настоящем коде между запросами добавляют паузу (`time.sleep`), чтобы не получить ошибку 429.

## SQL из Python

Чтобы забрать данные из базы, к ней подключаются и выполняют запрос. Результат сразу приходит в DataFrame:

```py
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine(os.environ["DB_URL"])   # postgresql://user:pass@host:5432/db
df = pd.read_sql("""
    SELECT order_date, SUM(amount) AS revenue
    FROM orders
    WHERE status = 'delivered'
    GROUP BY order_date
""", engine)
```

Правило: **считай в базе то, что можно посчитать в базе**. Агрегировать миллиарды строк SQL-запросом и забрать в Python готовые сотни строк намного быстрее, чем тащить всё сырьё по сети. А в Python делай то, что неудобно в SQL: сложные графики, статистику, модели.

> ⚠️ Не собирай SQL-запрос склейкой строк с пользовательским вводом (`f"WHERE city = '{city}'"`). Это открывает дорогу SQL-инъекциям. Используй параметры запроса: `pd.read_sql(text("… WHERE city = :city"), engine, params={"city": city})`.

## Парсинг: когда API нет

Если данных нет ни в базе, ни в API, их можно вытащить из HTML-страницы. Для этого используют библиотеку BeautifulSoup:

```py
from bs4 import BeautifulSoup

soup = BeautifulSoup(html, "html.parser")
for card in soup.select("div.product"):
    name = card.select_one("h3").text
    price = card.select_one(".price").text
```

Для простых случаев хватит **регулярных выражений** — шаблонов поиска в тексте. Модуль `re` встроен в Python:

```python
import re

html = '<div class="price">4 990 ₽</div><div class="price">12 590 ₽</div><div class="price">790 ₽</div>'
raw = re.findall(r'class="price">([\d ]+) ₽', html)
prices = [int(p.replace(" ", "")) for p in raw]
print(raw, prices, sum(prices))
```

| Шаблон | Что ищет |
|---|---|
| `\d` | цифра |
| `\d+` | одна или больше цифр подряд |
| `[\d ]+` | цифры и пробелы |
| `(…)` | часть, которую нужно вернуть |
| `.*?` | любые символы, как можно меньше |

> 💡 Перед парсингом проверь правила сайта (файл `robots.txt` и пользовательское соглашение) и не нагружай сервер частыми запросами. Если у сервиса есть API, всегда выбирай его.

## Шпаргалка

| Задача | Код |
|---|---|
| текст JSON → словарь | `json.loads(text)` |
| словарь → текст JSON | `json.dumps(d, ensure_ascii=False)` |
| запрос к API | `requests.get(url, params=…, headers=…, timeout=30).json()` |
| вложенный JSON → таблица | `pd.json_normalize(records)` |
| все страницы API | цикл `while`, пока страница не пустая |
| SQL → DataFrame | `pd.read_sql(query, engine)` |
| найти в тексте | `re.findall(r"шаблон", text)` |
| секреты | `os.environ["TOKEN"]`, не в коде и не в GitHub |
