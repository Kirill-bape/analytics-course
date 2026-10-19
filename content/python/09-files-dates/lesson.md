## Данные приходят файлами

В учебном приложении таблицы уже загружены. В работе данные чаще приходят файлами: выгрузка из CRM в CSV, отчёт бухгалтерии в Excel, лог в текстовом файле. А ещё почти в каждой таблице есть даты, и с ними легко ошибиться. В этой теме научимся читать и сохранять файлы, работать с датами и автоматизировать повторяющиеся отчёты.

## CSV: чтение и запись

CSV — текстовая таблица: строки — это строки файла, столбцы разделены запятой. Но у «русского» CSV есть особенности: столбцы часто разделены **точкой с запятой**, а дроби записаны **через запятую**.

```python
import io

# Так выглядит выгрузка из русского Excel
text = """Дата;Город;Выручка
05.03.2026;Москва;125000,50
05.03.2026;Казань;48200,00
06.03.2026;Москва;131990,90"""

df = pd.read_csv(io.StringIO(text), sep=";", decimal=",")
print(df)
print(df.dtypes)
```

Главные параметры `read_csv`:

| Параметр | Зачем |
|---|---|
| `sep=";"` | разделитель столбцов |
| `decimal=","` | дробная часть через запятую |
| `encoding="cp1251"` | старая русская кодировка, если вместо букв «кракозябры» |
| `parse_dates=["Дата"]` | сразу превратить столбец в даты |
| `dayfirst=True` | день идёт первым: `05.03.2026` — это 5 марта, а не 3 мая |
| `usecols=[…]` | читать только нужные столбцы, экономит память |

`io.StringIO` здесь притворяется файлом. С настоящим файлом пишут просто путь: `pd.read_csv("sales.csv", sep=";", decimal=",")`.

Сохранить таблицу в файл — `to_csv`:

```python
orders.head(5).to_csv("sample.csv", index=False)
back = pd.read_csv("sample.csv", parse_dates=["order_date"])
print(back.shape, back["order_date"].dtype)
```

`index=False` не даёт записать в файл лишний столбец с номерами строк. Для русского Excel удобно сохранять с `sep=";"` и `encoding="utf-8-sig"`, тогда файл откроется двойным щелчком без «кракозябр».

## Excel и другие форматы

```py
df = pd.read_excel("report.xlsx", sheet_name="Продажи")   # нужен пакет openpyxl
df.to_excel("result.xlsx", index=False)
df.to_parquet("big.parquet")    # быстрый сжатый формат для больших таблиц
```

В учебном приложении нет доступа к твоим файлам, поэтому этот код здесь не запустится. В Jupyter на компьютере он работает так же, как `read_csv`. **Parquet** стоит запомнить: он хранит типы столбцов, в разы меньше CSV и читается намного быстрее. В аналитических хранилищах это стандарт.

## Даты: превратить текст в дату

Пока дата — текст, с ней ничего нельзя сделать: ни вычесть, ни сгруппировать по месяцам. `pd.to_datetime` превращает текст в настоящие даты:

```python
s = pd.Series(["05.03.2026", "28.02.2026", "31.12.2025"])
dates = pd.to_datetime(s, format="%d.%m.%Y")
print(dates)
print(dates.max())
```

`format` описывает, как записана дата: `%d` — день, `%m` — месяц, `%Y` — год из четырёх цифр, `%H:%M` — часы и минуты. С явным форматом ошибок не бывает, а без него pandas может перепутать день и месяц.

## Части даты: .dt

У столбца с датами есть набор свойств через `.dt`:

| Код | Что вернёт |
|---|---|
| `.dt.year`, `.dt.month`, `.dt.day` | год, месяц, день |
| `.dt.dayofweek` | день недели: 0 — понедельник, 6 — воскресенье |
| `.dt.day_name()` | название дня недели (по-английски) |
| `.dt.to_period("M")` | месяц как период: `2026-03` |
| `.dt.days` | для разницы дат — число дней |

```python
d = orders[orders["status"] == "delivered"].copy()
d["days"] = (d["delivery_date"] - d["order_date"]).dt.days
d["month"] = d["order_date"].dt.to_period("M")
print(d.groupby("month")["days"].mean().round(1).tail(6))
```

Разница двух дат — это **интервал** (`Timedelta`). Чтобы получить число дней, берут `.dt.days`. Прибавить к дате интервал — `+ pd.Timedelta(days=7)` или `+ pd.DateOffset(months=1)`.

## resample: ряд по периодам

Если даты стоят в индексе, `resample` собирает данные по дням, неделям или месяцам. Это `groupby` для времени:

```python
monthly = (orders[orders["status"] == "delivered"]
           .set_index("order_date")["amount"]
           .resample("MS").sum())
print(monthly.tail(3))
```

`"D"` — день, `"W"` — неделя, `"MS"` — месяц (метка — первое число), `"QS"` — квартал. Важное отличие от `groupby`: `resample` создаёт **все** периоды, даже пустые, и ряд не «схлопывается».

## Автоматизация: один код — много отчётов

Аналитик ценен не ручными выгрузками, а тем, что автоматизирует рутину. Типичный приём — функция отчёта плюс цикл:

```python
def month_report(df, month):
    part = df[(df["order_date"].dt.to_period("M") == month) & (df["status"] == "delivered")]
    return {"month": str(month), "orders": len(part), "revenue": round(part["amount"].sum())}

months = pd.period_range("2026-01", "2026-06", freq="M")
report = pd.DataFrame([month_report(orders, m) for m in months])
print(report)
```

Дальше результат сохраняют в файл с датой в названии, например `f"report_{date.today()}.csv"`. Запускать такой скрипт по расписанию можно планировщиком: `cron` на сервере, «Планировщик заданий» в Windows или Airflow, о котором расскажем в модуле про хранилища данных.

Чтобы обработать сразу много файлов из папки, используют модуль `glob`:

```py
from glob import glob

parts = [pd.read_csv(f, sep=";") for f in glob("выгрузки/*.csv")]
all_data = pd.concat(parts, ignore_index=True)
```

## Шпаргалка

| Задача | Код |
|---|---|
| прочитать «русский» CSV | `pd.read_csv(path, sep=";", decimal=",")` |
| сохранить CSV для Excel | `df.to_csv(path, sep=";", index=False, encoding="utf-8-sig")` |
| текст → дата | `pd.to_datetime(s, format="%d.%m.%Y")` |
| части даты | `.dt.year`, `.dt.month`, `.dt.dayofweek`, `.dt.to_period("M")` |
| дней между датами | `(d2 - d1).dt.days` |
| сдвиг даты | `+ pd.Timedelta(days=7)`, `+ pd.DateOffset(months=1)` |
| ряд по месяцам | `.set_index("date")["x"].resample("MS").sum()` |
| много файлов | `pd.concat([pd.read_csv(f) for f in glob("*.csv")])` |
