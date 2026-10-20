## Модель видит только числа

Модели работают с таблицей чисел: строка — объект, столбец — признак. Реальные данные устроены иначе: в них есть текстовые категории, даты, пропуски и признаки в совершенно разных масштабах. **Подготовка признаков (feature engineering)** часто влияет на качество сильнее, чем выбор алгоритма.

## Пропуски

| Способ | Когда |
|---|---|
| удалить строки | пропусков мало, и они случайны |
| заполнить медианой (числа) | устойчиво к выбросам |
| заполнить самым частым значением или «не указан» (категории) | категории |
| добавить флаг «было пусто» | сам факт пропуска может что-то значить |

Факт пропуска бывает информативным: клиент, не указавший дату рождения, может вести себя иначе. Поэтому вместе с заполнением часто добавляют признак-флаг.

```python
age = ((pd.Timestamp("2026-07-01") - customers["birth_date"]).dt.days / 365.25) // 1
print("пропусков:", age.isna().sum())

features = pd.DataFrame({
    "age": age.fillna(age.median()),
    "age_missing": age.isna().astype(int),
})
print(features.describe().round(1))
```

## Категории → числа: one-hot

Нельзя просто пронумеровать каналы «organic = 1, ads = 2, social = 3»: модель решит, что social «больше» organic. Правильный способ — **one-hot кодирование**: для каждой категории свой столбец из 0 и 1.

```python
channels = pd.get_dummies(customers["acquisition_channel"], prefix="ch", dtype=int)
print(channels.head())
```

Если категорий сотни (города, товары), one-hot раздувает таблицу. Тогда редкие значения объединяют в «другое», оставляя только самые частые.

## Масштаб признаков

`recency` измеряется в днях (до 455), а `monetary` — в рублях (до 650 000). Методам, которые считают **расстояния** (k-ближайших соседей, кластеризация) или используют градиентный спуск, разница масштабов мешает: признак с большими числами «перекричит» остальные. Поэтому признаки приводят к одному масштабу:

- **стандартизация**: `z = (x − среднее) / стандартное отклонение` — среднее 0, разброс 1;
- **min-max**: `(x − min) / (max − min)` — все значения от 0 до 1.

```python
cut = pd.Timestamp("2026-04-01")
hist = orders[orders["order_date"] < cut]
df = hist.groupby("customer_id").agg(frequency=("order_id", "count"), monetary=("amount", "sum"), last=("order_date", "max"))
df["recency"] = (cut - df["last"]).dt.days

cols = ["recency", "frequency", "monetary"]
z = (df[cols] - df[cols].mean()) / df[cols].std()
print(z.describe().loc[["mean", "std", "min", "max"]].round(2))
```

> ⚠️ Среднее, стандартное отклонение, медиану для заполнения пропусков считают **только по обучающей выборке**, а потом применяют к тестовой. Иначе информация из теста «протечёт» в обучение, и оценка качества окажется завышенной.

Деревья решений (следующие уроки) к масштабу нечувствительны: они сравнивают значения с порогами.

## Скошенные признаки: логарифм

Суммы покупок, доходы, просмотры обычно **скошены**: большинство значений небольшие, и есть длинный хвост гигантов. Логарифм `np.log1p(x)` (это `log(1 + x)`, он работает и с нулями) сжимает хвост и делает распределение ближе к симметричному. Это помогает линейным моделям и кластеризации.

## Новые признаки

Часто сильнее всего помогают признаки, придуманные из понимания бизнеса:

- из дат: день недели, выходной ли, месяц, «дней с регистрации»;
- отношения: средний чек = сумма / число заказов, доля заказов со скидкой;
- агрегаты по истории: число заказов за последние 30 / 90 дней, тренд.

```python
f = pd.DataFrame({
    "weekday": orders["order_date"].dt.dayofweek,          # 0 — понедельник
    "is_weekend": (orders["order_date"].dt.dayofweek >= 5).astype(int),
    "month": orders["order_date"].dt.month,
    "has_promo": orders["promo_code"].notna().astype(int),
})
print(f.mean().round(3))
```

## Как это выглядит в scikit-learn

```py
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer

prep = ColumnTransformer([
    ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), ["age", "recency", "monetary"]),
    ("cat", OneHotEncoder(handle_unknown="ignore"), ["acquisition_channel", "city"]),
])
prep.fit(X_train)                     # статистики — только по обучающей выборке
X_train_ready = prep.transform(X_train)
X_test_ready = prep.transform(X_test)
```

## Шпаргалка

| Приём | Код |
|---|---|
| заполнить медианой | `s.fillna(s.median())` |
| флаг пропуска | `s.isna().astype(int)` |
| one-hot | `pd.get_dummies(s, prefix="ch", dtype=int)` |
| стандартизация | `(x - x.mean()) / x.std()` |
| min-max | `(x - x.min()) / (x.max() - x.min())` |
| логарифм | `np.log1p(x)` |
| признаки из даты | `.dt.dayofweek`, `.dt.month` |
