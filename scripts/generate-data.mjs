// Генератор учебных данных интернет-магазина.
// Запуск: npm run generate-data
// Данные получаются одинаковыми при каждом запуске: случайные числа
// берутся из генератора с фиксированным «зерном» (seed).
// Если поменять данные, эталонные ответы заданий тоже изменятся — это нормально,
// проверка всегда сравнивает твой запрос с эталонным на тех же данных.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'data', 'shop');

// ---------------------------------------------------------------------------
// Случайные числа с seed
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260929);
const randInt = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;
function weighted(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of pairs) {
    r -= w;
    if (r < 0) return value;
  }
  return pairs[pairs.length - 1][0];
}
function normal(mean, sd) {
  const u = 1 - rand();
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function poisson(lambda) {
  if (lambda > 30) return Math.max(0, Math.round(normal(lambda, Math.sqrt(lambda))));
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > L);
  return k - 1;
}
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

// ---------------------------------------------------------------------------
// Даты: храним как номер дня от 1970-01-01 (UTC)
// ---------------------------------------------------------------------------
const DAY_MS = 86_400_000;
const day = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY_MS;
const fmt = (d) => new Date(d * DAY_MS).toISOString().slice(0, 10);
const monthOf = (d) => new Date(d * DAY_MS).getUTCMonth() + 1; // 1..12
const weekdayOf = (d) => new Date(d * DAY_MS).getUTCDay(); // 0 = вс

const REG_START = day('2024-01-01');
const ORD_START = day('2025-01-01');
const ORD_END = day('2026-06-30');

// ---------------------------------------------------------------------------
// Каталог товаров: [название, бренд, цена, сезонный тег?]
// ---------------------------------------------------------------------------
const CATALOG = {
  'Электроника': {
    share: 0.17, cost: [0.72, 0.86],
    items: [
      ['Смартфон Xiaomi Redmi Note 14', 'Xiaomi', 21990],
      ['Смартфон Samsung Galaxy A56', 'Samsung', 36990],
      ['Смартфон Samsung Galaxy S25', 'Samsung', 84990],
      ['Смартфон Apple iPhone 16', 'Apple', 94990],
      ['Смартфон Apple iPhone 16 Pro', 'Apple', 129990],
      ['Смартфон realme C75', 'realme', 13490],
      ['Смартфон HONOR X9c', 'HONOR', 32990],
      ['Наушники беспроводные Apple AirPods 4', 'Apple', 17990],
      ['Наушники беспроводные Xiaomi Redmi Buds 6', 'Xiaomi', 3290],
      ['Наушники беспроводные Samsung Galaxy Buds3', 'Samsung', 12990],
      ['Наушники накладные JBL Tune 520BT', 'JBL', 4990],
      ['Фитнес-браслет Xiaomi Smart Band 9', 'Xiaomi', 3990],
      ['Умные часы Apple Watch SE', 'Apple', 27990],
      ['Умные часы HUAWEI Watch Fit 3', 'HUAWEI', 11990],
      ['Планшет Xiaomi Redmi Pad SE', 'Xiaomi', 17490],
      ['Планшет Apple iPad 10.9', 'Apple', 42990],
      ['Ноутбук HUAWEI MateBook D 16', 'HUAWEI', 64990],
      ['Ноутбук ASUS Vivobook 15', 'ASUS', 52990],
      ['Ноутбук Apple MacBook Air 13 M3', 'Apple', 119990],
      ['Портативная колонка JBL Flip 6', 'JBL', 10990],
      ['Умная колонка Яндекс Станция Мини 3', 'Яндекс', 7990],
      ['Внешний аккумулятор Xiaomi 20000 мАч', 'Xiaomi', 2490],
      ['Зарядное устройство Anker 65 Вт', 'Anker', 3490],
      ['Электронная книга PocketBook 629', 'PocketBook', 16990],
    ],
  },
  'Бытовая техника': {
    share: 0.11, cost: [0.66, 0.8],
    items: [
      ['Робот-пылесос Xiaomi Robot Vacuum S20', 'Xiaomi', 24990],
      ['Робот-пылесос Dreame L10s Ultra', 'Dreame', 49990],
      ['Пылесос беспроводной Dyson V12', 'Dyson', 59990],
      ['Пылесос вертикальный Tefal X-Force Flex 8.60', 'Tefal', 21990],
      ['Чайник электрический Xiaomi Kettle 2', 'Xiaomi', 2290],
      ['Чайник электрический Bosch TWK 3A011', 'Bosch', 3190],
      ['Кофемашина DeLonghi Magnifica S', 'DeLonghi', 44990],
      ['Кофеварка капельная Philips HD7461', 'Philips', 5490],
      ['Микроволновая печь Samsung ME88SUG', 'Samsung', 11990],
      ['Микроволновая печь Midea MM720', 'Midea', 6490],
      ['Утюг Philips DST 3020', 'Philips', 4790],
      ['Блендер погружной Braun MQ 7035', 'Braun', 7990],
      ['Фен Dyson Supersonic', 'Dyson', 49490],
      ['Фен Polaris PHD 2077', 'Polaris', 2990],
      ['Мультиварка Redmond RMC-M90', 'Redmond', 5990],
      ['Стиральная машина Haier HW60', 'Haier', 32490],
      ['Посудомоечная машина Midea MFD45S', 'Midea', 27990],
    ],
  },
  'Одежда и обувь': {
    share: 0.2, cost: [0.35, 0.55],
    items: [
      ['Футболка базовая хлопковая', 'Befree', 999],
      ['Футболка оверсайз', 'Твоё', 1299],
      ['Джинсы прямые', 'Gloria Jeans', 2999],
      ['Джинсы классические', 'Lee', 6990],
      ['Худи с капюшоном', 'Demix', 3299],
      ['Куртка зимняя пуховая', 'Outventure', 12990, 'winter'],
      ['Куртка демисезонная', 'Befree', 4999],
      ['Пуховик удлинённый', 'Zarina', 9990, 'winter'],
      ['Кроссовки беговые Nike Revolution 7', 'Nike', 7990],
      ['Кроссовки adidas Runfalcon 3', 'adidas', 6490],
      ['Кеды Converse Chuck Taylor', 'Converse', 7490],
      ['Ботинки зимние', 'Ralf Ringer', 11490, 'winter'],
      ['Платье трикотажное', 'Zarina', 3499],
      ['Свитер шерстяной', 'Lime', 5990, 'winter'],
      ['Шапка вязаная', 'Твоё', 799, 'winter'],
      ['Носки набор 5 пар', 'Demix', 499],
      ['Спортивный костюм', 'Demix', 4990],
      ['Пижама женская', 'Твоё', 1999],
    ],
  },
  'Дом и кухня': {
    share: 0.15, cost: [0.45, 0.65],
    items: [
      ['Сковорода антипригарная 28 см', 'Tefal', 3490],
      ['Набор кастрюль 6 предметов', 'Rondell', 7490],
      ['Набор ножей 5 предметов', 'Fissman', 4590],
      ['Постельное бельё евро сатин', 'Togas', 5890],
      ['Подушка ортопедическая', 'Askona', 3990],
      ['Одеяло всесезонное 200x220', 'Askona', 4490],
      ['Плед флисовый 150x200', 'Самойловский текстиль', 1490],
      ['Контейнеры для еды набор 5 шт', 'Fissman', 1290],
      ['Полотенца банные набор 2 шт', 'Togas', 2490],
      ['Гирлянда светодиодная 10 м', 'Feron', 890, 'newyear'],
      ['Искусственная ёлка 180 см', 'Crystal Trees', 8990, 'newyear'],
      ['Настольная лампа LED', 'Xiaomi', 2990],
      ['Ароматическая свеча', 'Aroma Home', 790, 'nosales'],
      ['Кружка керамическая 350 мл', 'Fissman', 490],
      ['Органайзер для хранения', 'Handy Home', 690],
      ['Швабра с отжимом', 'Vileda', 2290],
    ],
  },
  'Красота и здоровье': {
    share: 0.15, cost: [0.4, 0.6],
    items: [
      ['Шампунь восстанавливающий 400 мл', 'Garnier', 459],
      ['Крем для лица увлажняющий', 'La Roche-Posay', 2190],
      ['Сыворотка для лица с витамином C', 'The Ordinary', 1890],
      ['Зубная щётка электрическая Oral-B Pro 3', 'Oral-B', 5490],
      ['Ирригатор Revyline RL 450', 'Revyline', 5990],
      ['Парфюмерная вода женская', 'Zarkoperfume', 4990, 'march8'],
      ['Туалетная вода мужская', 'Hugo Boss', 7990],
      ['Бритва электрическая Philips S3000', 'Philips', 6990],
      ['Витамин D3 2000 МЕ', 'Эвалар', 690],
      ['Омега-3 капсулы', 'Solgar', 2490],
      ['Маска для волос', 'Kapous', 890],
      ['Набор косметики подарочный', 'Vivienne Sabo', 2990, 'march8'],
      ['Массажёр для шеи', 'Yamaguchi', 7490],
      ['Гель для душа 750 мл', 'Palmolive', 399],
    ],
  },
  'Книги': {
    share: 0.08, cost: [0.5, 0.65],
    items: [
      ['Python для анализа данных', 'Питер', 2890],
      ['SQL. Быстрое погружение', 'Питер', 1490],
      ['Голая статистика', 'МИФ', 990],
      ['Статистика и котики', 'АСТ', 790],
      ['Думай медленно, решай быстро', 'АСТ', 1190],
      ['Атомные привычки', 'МИФ', 1090],
      ['Мастер и Маргарита', 'Эксмо', 590],
      ['Преступление и наказание', 'Эксмо', 490],
      ['Гарри Поттер и философский камень', 'Махаон', 890],
      ['Дюна', 'АСТ', 1290],
      ['Сторителлинг на данных', 'МИФ', 1690],
      ['Чистый код', 'Питер', 1590],
      ['Доверительное A/B-тестирование', 'ДМК Пресс', 1990],
      ['Как лгать при помощи статистики', 'Альпина Паблишер', 690, 'nosales'],
    ],
  },
  'Спорт и отдых': {
    share: 0.08, cost: [0.5, 0.7],
    items: [
      ['Гантели разборные 2x10 кг', 'Demix', 4990],
      ['Коврик для йоги 6 мм', 'Demix', 1490],
      ['Велосипед горный 27.5', 'Stern', 24990, 'summer'],
      ['Электросамокат Xiaomi Electric Scooter 4', 'Xiaomi', 39990, 'summer'],
      ['Самокат складной', 'Ridex', 5490, 'summer'],
      ['Палатка 3-местная', 'Outventure', 8990, 'summer'],
      ['Спальный мешок', 'Outventure', 3990, 'summer'],
      ['Бутылка для воды 750 мл', 'Demix', 590],
      ['Фитнес-резинки набор', 'Demix', 890],
      ['Скакалка скоростная', 'Torres', 690, 'nosales'],
      ['Беговая дорожка складная', 'Unix Fit', 34990],
      ['Лыжи беговые комплект', 'Fischer', 16990, 'wintersport'],
      ['Санки-ватрушка 100 см', 'Ника', 1990, 'wintersport'],
      ['Мяч футбольный', 'adidas', 2990, 'summer'],
    ],
  },
  'Детские товары': {
    share: 0.06, cost: [0.5, 0.7],
    items: [
      ['Конструктор LEGO City Полицейский участок', 'LEGO', 9990, 'gift'],
      ['Конструктор LEGO Classic Набор для творчества', 'LEGO', 3490, 'gift'],
      ['Мягкая игрушка Медведь 50 см', 'Мякиши', 1490, 'gift'],
      ['Настольная игра Монополия', 'Hasbro', 2490, 'gift'],
      ['Настольная игра Имаджинариум', 'Cosmodrome Games', 2290, 'gift'],
      ['Подгузники-трусики размер 4', 'Pampers', 1790],
      ['Подгузники размер 3', 'Huggies', 1590],
      ['Кукла Барби', 'Mattel', 1990, 'gift'],
      ['Радиоуправляемая машинка', 'Maisto', 3290, 'gift'],
      ['Детский самокат трёхколёсный', 'Micro', 6990, 'summer'],
      ['Коляска прогулочная', 'Happy Baby', 17990],
      ['Автокресло 9-36 кг', 'Siger', 8990],
      ['Набор для рисования в чемоданчике', 'Мульти-Пульти', 1290, 'nosales'],
      ['Пазл 1000 элементов', 'Ravensburger', 1690],
    ],
  },
};

// Сезонность по категориям (множитель по месяцам 1..12)
const CATEGORY_SEASON = {
  'Электроника':        [0.9, 0.9, 0.95, 0.9, 0.9, 0.9, 0.9, 0.95, 1.0, 1.05, 1.5, 1.7],
  'Бытовая техника':    [0.9, 0.9, 1.0, 1.0, 0.95, 0.9, 0.9, 0.95, 1.0, 1.05, 1.5, 1.3],
  'Одежда и обувь':     [0.8, 0.85, 1.1, 1.2, 1.1, 0.9, 0.8, 0.95, 1.3, 1.35, 1.25, 1.1],
  'Дом и кухня':        [0.9, 0.9, 1.0, 1.0, 1.0, 0.95, 0.9, 0.95, 1.0, 1.05, 1.2, 1.4],
  'Красота и здоровье': [0.9, 1.3, 1.5, 1.0, 0.95, 0.9, 0.9, 0.9, 1.0, 1.0, 1.2, 1.5],
  'Книги':              [1.0, 0.95, 0.95, 0.9, 0.9, 1.1, 1.2, 1.2, 1.2, 1.0, 1.1, 1.3],
  'Спорт и отдых':      [0.9, 0.8, 0.9, 1.2, 1.5, 1.6, 1.5, 1.3, 1.0, 0.8, 0.8, 0.9],
  'Детские товары':     [0.8, 0.8, 0.9, 0.9, 1.0, 1.2, 1.0, 1.1, 1.0, 1.0, 1.2, 2.0],
};
// Сезонность отдельных товаров по тегу
const TAG_SEASON = {
  winter:      [1.6, 0.9, 0.4, 0.2, 0.08, 0.05, 0.05, 0.15, 0.8, 2.2, 2.6, 2.2],
  summer:      [0.15, 0.2, 0.5, 1.4, 2.5, 3.0, 2.8, 2.0, 0.8, 0.3, 0.15, 0.2],
  wintersport: [2.5, 1.8, 0.4, 0.05, 0.02, 0.02, 0.02, 0.02, 0.05, 0.3, 1.5, 3.5],
  newyear:     [0.15, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.03, 0.05, 0.3, 3.0, 9.0],
  march8:      [0.8, 2.2, 1.8, 0.7, 0.7, 0.7, 0.7, 0.7, 0.8, 0.9, 1.1, 1.6],
  gift:        [0.8, 0.9, 0.9, 0.8, 0.9, 1.1, 0.9, 0.9, 0.9, 1.0, 1.3, 2.4],
};

// ---------------------------------------------------------------------------
// Товары
// ---------------------------------------------------------------------------
const products = [];
{
  let id = 1;
  for (const [category, cfg] of Object.entries(CATALOG)) {
    for (const [name, brand, price, tag] of cfg.items) {
      const ratio = cfg.cost[0] + rand() * (cfg.cost[1] - cfg.cost[0]);
      const cost = Math.round(price * ratio * 100) / 100;
      const rating = chance(0.1) ? null : Math.round(clamp(normal(4.55, 0.28), 3.1, 5.0) * 10) / 10;
      // Популярность: дешёвые товары покупают чаще, плюс случайный «хит»-фактор
      const popularity = tag === 'nosales' ? 0 : Math.pow(price, -0.45) * Math.exp(normal(0, 0.55));
      products.push({ product_id: id++, product_name: name, category, brand, price, cost_price: cost, rating, tag, popularity });
    }
  }
  // Нормируем популярность внутри категории
  for (const category of Object.keys(CATALOG)) {
    const list = products.filter((p) => p.category === category);
    const sum = list.reduce((s, p) => s + p.popularity, 0);
    for (const p of list) p.popularity = (p.popularity / sum) * CATALOG[category].share;
  }
}

// ---------------------------------------------------------------------------
// Клиенты
// ---------------------------------------------------------------------------
const MALE = ['Александр', 'Дмитрий', 'Максим', 'Сергей', 'Андрей', 'Алексей', 'Артём', 'Илья', 'Кирилл', 'Михаил',
  'Никита', 'Матвей', 'Роман', 'Егор', 'Иван', 'Денис', 'Евгений', 'Павел', 'Владимир', 'Тимур', 'Олег', 'Глеб'];
const FEMALE = ['Анна', 'Мария', 'Елена', 'Екатерина', 'Ольга', 'Наталья', 'Татьяна', 'Юлия', 'Анастасия', 'Дарья',
  'Ксения', 'Алина', 'Виктория', 'Полина', 'Софья', 'Ирина', 'Светлана', 'Марина', 'Валерия', 'Алиса', 'Вероника', 'Кристина'];
const SURNAMES = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Васильев', 'Петров', 'Соколов', 'Михайлов', 'Новиков',
  'Фёдоров', 'Морозов', 'Волков', 'Алексеев', 'Лебедев', 'Семёнов', 'Егоров', 'Павлов', 'Козлов', 'Степанов',
  'Николаев', 'Орлов', 'Андреев', 'Макаров', 'Никитин', 'Захаров', 'Зайцев', 'Соловьёв', 'Борисов', 'Яковлев',
  'Григорьев', 'Романов', 'Воробьёв', 'Сергеев', 'Кузьмин', 'Фролов', 'Александров', 'Дмитриев', 'Королёв',
  'Гусев', 'Киселёв', 'Ильин', 'Максимов', 'Поляков', 'Сорокин', 'Виноградов', 'Ковалёв', 'Белов', 'Медведев'];
const SURNAMES_SAME = ['Ким', 'Шевченко', 'Бондаренко', 'Коваленко', 'Цой', 'Мельниченко'];

const CITIES = [
  ['Москва', 28, 'msk'], ['Санкт-Петербург', 14, 'spb'], ['Новосибирск', 5, 'far'], ['Екатеринбург', 5, 'far'],
  ['Казань', 5, 'near'], ['Нижний Новгород', 4, 'near'], ['Краснодар', 4, 'mid'], ['Самара', 3, 'mid'],
  ['Ростов-на-Дону', 3, 'mid'], ['Уфа', 3, 'mid'], ['Челябинск', 3, 'far'], ['Воронеж', 3, 'near'],
  ['Пермь', 3, 'mid'], ['Красноярск', 2.5, 'far'], ['Омск', 2, 'far'], ['Волгоград', 2, 'mid'],
  ['Тюмень', 2, 'far'], ['Ярославль', 1.5, 'near'], ['Тула', 1.5, 'near'], ['Иркутск', 1.5, 'far'],
  ['Владивосток', 1.5, 'far'], ['Хабаровск', 1, 'far'], ['Калининград', 1.5, 'mid'], ['Сочи', 1.5, 'mid'],
];
const CITY_ZONE = Object.fromEntries(CITIES.map(([c, , z]) => [c, z]));

function regWeight(d) {
  const t = (d - REG_START) / (ORD_END - REG_START);
  const m = monthOf(d);
  const season = m === 11 || m === 12 ? 1.35 : m === 1 ? 0.85 : 1;
  return (1 + 1.6 * t) * season;
}

const N_CUSTOMERS = 3000;
const customers = [];
for (let i = 0; i < N_CUSTOMERS; i++) {
  // Дата регистрации: со временем регистраций становится больше
  let reg;
  do {
    reg = randInt(REG_START, ORD_END);
  } while (rand() * 2.9 > regWeight(reg));

  const gender = chance(0.56) ? 'female' : 'male';
  const first = gender === 'female' ? pick(FEMALE) : pick(MALE);
  let last;
  if (chance(0.06)) last = pick(SURNAMES_SAME);
  else last = pick(SURNAMES) + (gender === 'female' ? 'а' : '');
  const age = Math.round(clamp(normal(34, 10), 18, 72));
  const birth = chance(0.07) ? null : fmt(day(`${2026 - age}-01-01`) + randInt(0, 364));
  const city = chance(0.02) ? null : weighted(CITIES.map(([c, w]) => [c, w]));
  const tReg = (reg - REG_START) / (ORD_END - REG_START);
  const channel = weighted([['organic', 30], ['ads', 28], ['social', 18], ['referral', 12], ['bloggers', 4 + 16 * tReg]]);
  customers.push({ full_name: `${first} ${last}`, gender, birth_date: birth, city, registration_date: reg, acquisition_channel: channel });
}
customers.sort((a, b) => a.registration_date - b.registration_date);
customers.forEach((c, i) => (c.customer_id = i + 1));

// ---------------------------------------------------------------------------
// Заказы: веса по дням (тренд, сезонность, дни недели, акции)
// ---------------------------------------------------------------------------
const MONTH_FACTOR = [0.82, 0.86, 0.97, 0.95, 0.92, 0.9, 0.88, 0.95, 1.0, 1.05, 1.3, 1.45];
const WEEKDAY_FACTOR = [1.18, 0.95, 0.96, 0.97, 0.98, 1.0, 1.1]; // вс, пн, ..., сб
function dayWeight(d) {
  const s = fmt(d);
  const t = (d - ORD_START) / (ORD_END - ORD_START);
  let w = (1 + 0.35 * t) * MONTH_FACTOR[monthOf(d) - 1] * WEEKDAY_FACTOR[weekdayOf(d)];
  if (s >= '2025-11-27' && s <= '2025-11-30') w *= 3.2; // Чёрная пятница
  if (s === '2025-12-01') w *= 1.8; // Киберпонедельник
  if (s === '2025-11-11') w *= 2.0; // 11.11
  if (s >= '2025-12-15' && s <= '2025-12-28') w *= 1.35; // подарки к Новому году
  if (s <= '2025-01-08' || (s >= '2025-12-31' && s <= '2026-01-08')) w *= 0.55; // новогодние праздники
  if ((s >= '2025-03-01' && s <= '2025-03-07') || (s >= '2026-03-01' && s <= '2026-03-07')) w *= 1.25; // к 8 марта
  return w;
}
const DAYS = [];
const CUM = [];
{
  let acc = 0;
  for (let d = ORD_START; d <= ORD_END; d++) {
    acc += dayWeight(d);
    DAYS.push(d);
    CUM.push(acc);
  }
}
// Случайный день между from и to (включительно) с учётом весов
function sampleDay(from, to) {
  const i0 = Math.max(0, from - ORD_START);
  const i1 = Math.min(DAYS.length - 1, to - ORD_START);
  const lo = i0 === 0 ? 0 : CUM[i0 - 1];
  const hi = CUM[i1];
  const r = lo + rand() * (hi - lo);
  let a = i0;
  let b = i1;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (CUM[mid] < r) a = mid + 1;
    else b = mid;
  }
  return DAYS[a];
}

const rawOrders = [];
for (const c of customers) {
  const start = Math.max(c.registration_date, ORD_START);
  if (start > ORD_END) continue;
  if (chance(0.21)) continue; // зарегистрировался, но ничего не купил
  const freq = Math.exp(normal(-0.6, 0.85)); // заказов в месяц
  let stop = ORD_END;
  if (chance(0.4)) stop = Math.min(ORD_END, start + Math.round(-Math.log(1 - rand()) * 150)); // перестал покупать
  const months = Math.max(0.5, (stop - start) / 30.4);
  let n = Math.min(45, poisson(freq * months));
  const dates = [];
  // Первый заказ часто сразу после регистрации
  if (c.registration_date >= ORD_START && chance(0.7)) {
    dates.push(Math.min(ORD_END, c.registration_date + Math.floor(-Math.log(1 - rand()) * 3)));
    n = Math.max(0, n - 1);
  } else if (n === 0) {
    n = 1;
  }
  for (let k = 0; k < n; k++) dates.push(sampleDay(start, stop));
  dates.sort((a, b) => a - b);
  dates.forEach((d, idx) => rawOrders.push({ customer: c, date: d, isFirst: idx === 0 && c.registration_date >= ORD_START, tie: rand() }));
}
rawOrders.sort((a, b) => a.date - b.date || a.tie - b.tie);

// ---------------------------------------------------------------------------
// Позиции заказов, промокоды, статусы
// ---------------------------------------------------------------------------
function productWeight(p, month) {
  if (p.popularity === 0) return 0;
  let w = p.popularity * CATEGORY_SEASON[p.category][month - 1];
  if (p.tag && TAG_SEASON[p.tag]) w *= TAG_SEASON[p.tag][month - 1];
  return w;
}
function roundPrice(p) {
  return p >= 1000 ? Math.round(p / 100) * 100 - 10 : Math.round(p / 10) * 10 - 1;
}
const round2 = (x) => Math.round(x * 100) / 100;

function deliveryDays(city, d) {
  const zone = city ? CITY_ZONE[city] : 'mid';
  let days = { msk: randInt(1, 3), spb: randInt(2, 4), near: randInt(2, 5), mid: randInt(3, 6), far: randInt(4, 10) }[zone];
  const s = fmt(d);
  if ((s >= '2025-11-27' && s <= '2025-12-05') || (s >= '2025-12-18' && s <= '2025-12-30')) days += randInt(1, 3);
  return days;
}

const orders = [];
const orderItems = [];
let orderId = 100001;
let itemId = 1;
for (const ro of rawOrders) {
  const c = ro.customer;
  const d = ro.date;
  const s = fmt(d);
  const m = monthOf(d);
  const t = (d - ORD_START) / (ORD_END - ORD_START);

  // Состав заказа
  const nItems = weighted([[1, 55], [2, 27], [3, 12], [4, 6]]);
  const weights = products.map((p) => [p, productWeight(p, m)]);
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < nItems && guard++ < 50) chosen.add(weighted(weights));
  let itemsTotal = 0;
  let hasClothes = false;
  for (const p of chosen) {
    let qty = 1;
    if (p.product_name.startsWith('Подгузники')) qty = weighted([[1, 45], [2, 35], [3, 15], [4, 5]]);
    else if (p.price < 1000) qty = weighted([[1, 60], [2, 30], [3, 10]]);
    else if (p.price < 5000) qty = weighted([[1, 85], [2, 15]]);
    const price = roundPrice(p.price * (0.92 + 0.08 * t)); // цены постепенно росли
    itemsTotal += qty * price;
    if (p.category === 'Одежда и обувь') hasClothes = true;
    orderItems.push({ item_id: itemId++, order_id: orderId, product_id: p.product_id, quantity: qty, price });
  }

  // Промокод
  let promo = null;
  let discount = 0;
  if (ro.isFirst && c.acquisition_channel === 'referral' && chance(0.55) && itemsTotal >= 1500) {
    promo = 'FRIEND300'; discount = 300;
  } else if (ro.isFirst && chance(0.35)) {
    promo = 'WELCOME10'; discount = Math.min(1000, round2(itemsTotal * 0.1));
  } else if (s >= '2025-11-24' && s <= '2025-12-01' && chance(0.45)) {
    promo = 'BLACKFRIDAY'; discount = round2(itemsTotal * 0.15);
  } else if (s >= '2025-12-10' && s <= '2025-12-31' && chance(0.25)) {
    promo = 'NEWYEAR2026'; discount = round2(itemsTotal * 0.1);
  } else if (s >= '2026-03-01' && s <= '2026-05-31' && itemsTotal >= 3000 && chance(0.15)) {
    promo = 'SPRING500'; discount = 500;
  } else if (s >= '2025-06-01' && s <= '2025-08-31' && chance(0.1)) {
    promo = 'SUMMER5'; discount = round2(itemsTotal * 0.05);
  }
  const amount = round2(itemsTotal - discount);

  // Способ оплаты: доля СБП растёт, наличных — падает
  const payment = weighted([['card', 60], ['sbp', 14 + 22 * t], ['cash', 15 - 7 * t]]);

  // Статус и дата доставки
  const days = deliveryDays(c.city, d);
  let status;
  let delivery = null;
  if (chance(payment === 'cash' ? 0.13 : 0.055)) {
    status = 'cancelled';
  } else if (d > ORD_END - 2 && chance(0.5)) {
    status = 'processing';
  } else if (d + days > ORD_END) {
    status = 'shipped';
  } else {
    delivery = d + days;
    status = chance(hasClothes ? 0.12 : 0.025) ? 'returned' : 'delivered';
  }

  orders.push({
    order_id: orderId,
    customer_id: c.customer_id,
    order_date: s,
    status,
    payment_method: payment,
    promo_code: promo,
    discount: discount.toFixed(2),
    amount: amount.toFixed(2),
    delivery_date: delivery === null ? null : fmt(delivery),
  });
  orderId++;
}

// ---------------------------------------------------------------------------
// Запись CSV
// ---------------------------------------------------------------------------
function csvValue(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function writeCsv(name, columns, rows) {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvValue(r[c])).join(','));
  writeFileSync(join(OUT, name), lines.join('\n') + '\n', 'utf8');
}

mkdirSync(OUT, { recursive: true });
writeCsv('customers.csv', ['customer_id', 'full_name', 'gender', 'birth_date', 'city', 'registration_date', 'acquisition_channel'],
  customers.map((c) => ({ ...c, registration_date: fmt(c.registration_date) })));
writeCsv('products.csv', ['product_id', 'product_name', 'category', 'brand', 'price', 'cost_price', 'rating'],
  products.map((p) => ({ ...p, price: p.price.toFixed(2), cost_price: p.cost_price.toFixed(2), rating: p.rating === null ? null : p.rating.toFixed(1) })));
writeCsv('orders.csv', ['order_id', 'customer_id', 'order_date', 'status', 'payment_method', 'promo_code', 'discount', 'amount', 'delivery_date'], orders);
writeCsv('order_items.csv', ['item_id', 'order_id', 'product_id', 'quantity', 'price'],
  orderItems.map((i) => ({ ...i, price: i.price.toFixed(2) })));

// ===========================================================================
// ПРОИЗВОДСТВО: завод бытовой техники (свой генератор случайных чисел,
// чтобы данные магазина не менялись)
// ===========================================================================
{
  const r = mulberry32(777);
  const rInt = (min, max) => min + Math.floor(r() * (max - min + 1));
  const rNorm = (mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const rPick = (arr) => arr[Math.floor(r() * arr.length)];
  const OUT_F = join(ROOT, 'public', 'data', 'factory');
  mkdirSync(OUT_F, { recursive: true });

  const lines = [
    { line_id: 1, line_name: 'Линия А1', workshop: 'Сборка', launch_year: 2019, capacity_per_shift: 420, product: 'Чайник электрический', wear: 1.0 },
    { line_id: 2, line_name: 'Линия А2', workshop: 'Сборка', launch_year: 2023, capacity_per_shift: 480, product: 'Чайник электрический', wear: 0.7 },
    { line_id: 3, line_name: 'Линия Б1', workshop: 'Сборка', launch_year: 2016, capacity_per_shift: 300, product: 'Блендер погружной', wear: 1.6 },
    { line_id: 4, line_name: 'Линия Б2', workshop: 'Сборка', launch_year: 2024, capacity_per_shift: 360, product: 'Блендер погружной', wear: 0.6 },
    { line_id: 5, line_name: 'Линия В1', workshop: 'Упаковка', launch_year: 2018, capacity_per_shift: 900, product: 'Упаковка комплектов', wear: 1.1 },
    { line_id: 6, line_name: 'Линия Г1', workshop: 'Покраска', launch_year: 2021, capacity_per_shift: 520, product: 'Корпуса утюгов', wear: 0.9 },
  ];

  const FIRST = ['Алексей', 'Сергей', 'Ирина', 'Олег', 'Наталья', 'Дмитрий', 'Елена', 'Виктор', 'Андрей', 'Татьяна',
    'Павел', 'Светлана', 'Игорь', 'Марина', 'Роман', 'Юлия', 'Николай', 'Ольга', 'Максим', 'Анна', 'Артём', 'Галина', 'Денис', 'Людмила'];
  const LAST_M = ['Кузнецов', 'Соколов', 'Морозов', 'Волков', 'Лебедев', 'Козлов', 'Новиков', 'Павлов', 'Семёнов', 'Голубев', 'Виноградов', 'Богданов'];
  const operators = [];
  for (let i = 1; i <= 24; i++) {
    const first = FIRST[i - 1];
    const female = /[ая]$/.test(first);
    const last = rPick(LAST_M) + (female ? 'а' : '');
    const line = lines[(i - 1) % lines.length];
    const exp = i % 5 === 0 ? rInt(0, 1) : rInt(1, 22); // среди операторов есть новички
    const hire = fmt(day('2026-06-30') - Math.round(exp * 365 + rInt(0, 300)));
    operators.push({ operator_id: i, full_name: `${first} ${last}`, workshop: line.workshop, line_id: line.line_id, experience_years: exp, hire_date: hire });
  }

  const production = [];
  let recordId = 1;
  const START = day('2025-07-01');
  const END = day('2026-06-30');
  for (let d = START; d <= END; d++) {
    const s = fmt(d);
    const wd = weekdayOf(d);
    if (s >= '2026-01-01' && s <= '2026-01-08') continue; // новогодние каникулы
    for (const line of lines) {
      for (const shift of ['день', 'ночь']) {
        if (wd === 0 && shift === 'ночь') continue; // в воскресенье ночной смены нет
        if (wd === 0 && line.workshop !== 'Упаковка' && r() < 0.5) continue;
        const ops = operators.filter((o) => o.line_id === line.line_id);
        const op = ops[(Math.floor((d - START) / 7) + (shift === 'ночь' ? 1 : 0)) % ops.length];
        const planned = line.capacity_per_shift - (s.slice(5, 7) === '08' ? 40 : 0);
        // Простои: старые линии ломаются чаще, в феврале 2026 авария на линии Б1
        let downtime = Math.max(0, Math.round(rNorm(18 * line.wear, 12 * line.wear)));
        if (r() < 0.02 * line.wear) downtime += rInt(90, 300);
        if (line.line_id === 3 && s >= '2026-02-09' && s <= '2026-02-13') downtime += rInt(240, 420);
        downtime = Math.min(downtime, 480);
        const available = 1 - downtime / 480;
        const skill = Math.min(1, 0.9 + op.experience_years * 0.01);
        const produced = Math.max(0, Math.round(planned * available * skill * (0.95 + r() * 0.08) * (shift === 'ночь' ? 0.96 : 1)));
        const defectRate = Math.max(0, rNorm(0.018 * line.wear * (op.experience_years < 2 ? 2.2 : 1) * (shift === 'ночь' ? 1.25 : 1), 0.006));
        const defects = Math.min(produced, Math.round(produced * defectRate));
        production.push({
          record_id: recordId++,
          prod_date: s,
          line_id: line.line_id,
          shift,
          operator_id: op.operator_id,
          product: line.product,
          planned_units: planned,
          produced_units: produced,
          defect_units: defects,
          downtime_min: r() < 0.015 ? null : downtime, // датчик иногда не передаёт данные
        });
      }
    }
  }

  writeCsv2(OUT_F, 'production_lines.csv', ['line_id', 'line_name', 'workshop', 'launch_year', 'capacity_per_shift'], lines);
  writeCsv2(OUT_F, 'operators.csv', ['operator_id', 'full_name', 'workshop', 'line_id', 'experience_years', 'hire_date'], operators);
  writeCsv2(OUT_F, 'production.csv', ['record_id', 'prod_date', 'line_id', 'shift', 'operator_id', 'product', 'planned_units', 'produced_units', 'defect_units', 'downtime_min'], production);
  console.log(`Производство: ${lines.length} линий, ${operators.length} операторов, ${production.length} смен`);
}

// ===========================================================================
// A/B-ТЕСТЫ: два эксперимента интернет-магазина
// ===========================================================================
{
  const r = mulberry32(4242);
  const rNorm = (mean, sd) => mean + sd * Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const rW = (pairs) => {
    const total = pairs.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [v, w] of pairs) {
      x -= w;
      if (x < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };
  const OUT_AB = join(ROOT, 'public', 'data', 'ab');
  mkdirSync(OUT_AB, { recursive: true });

  const experiments = [
    // Новая страница оформления заказа: эффект есть
    { name: 'checkout_v2', start: '2026-05-04', days: 28, perGroup: 8000, conv: { A: 0.1, B: 0.113 }, avgCheck: { A: 3600, B: 3650 } },
    // Цвет кнопки на баннере: эффекта нет
    { name: 'banner_color', start: '2026-06-01', days: 14, perGroup: 3000, conv: { A: 0.05, B: 0.051 }, avgCheck: { A: 2900, B: 2900 } },
  ];
  const users = [];
  let userId = 500001;
  for (const e of experiments) {
    for (const group of ['A', 'B']) {
      for (let i = 0; i < e.perGroup; i++) {
        const device = rW([['mobile', 62], ['desktop', 31], ['tablet', 7]]);
        const deviceK = device === 'mobile' ? 0.85 : device === 'desktop' ? 1.3 : 1.0;
        const converted = r() < e.conv[group] * deviceK ? 1 : 0;
        const revenue = converted ? Math.round(Math.exp(rNorm(Math.log(e.avgCheck[group]) - 0.18, 0.6))) : 0;
        users.push({
          user_id: userId++,
          experiment: e.name,
          group_name: group,
          entry_date: fmt(day(e.start) + Math.floor(r() * e.days)),
          device,
          sessions: Math.max(1, Math.round(Math.exp(rNorm(0.7, 0.6)))),
          converted,
          revenue: revenue.toFixed(2),
        });
      }
    }
  }
  // Перемешиваем, чтобы группы не шли подряд
  for (let i = users.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [users[i], users[j]] = [users[j], users[i]];
  }
  writeCsv2(OUT_AB, 'ab_users.csv', ['user_id', 'experiment', 'group_name', 'entry_date', 'device', 'sessions', 'converted', 'revenue'], users);
  console.log(`A/B-тесты: ${users.length} пользователей в ${experiments.length} экспериментах`);
}

function writeCsv2(dir, name, columns, rows) {
  const lines = [columns.join(',')];
  for (const row of rows) lines.push(columns.map((c) => csvValue(row[c])).join(','));
  writeFileSync(join(dir, name), lines.join('\n') + '\n', 'utf8');
}

// Короткая сводка, чтобы убедиться, что данные выглядят правдоподобно
const byStatus = {};
for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
console.log(`Клиентов: ${customers.length}`);
console.log(`Товаров: ${products.length}`);
console.log(`Заказов: ${orders.length}`);
console.log(`Позиций в заказах: ${orderItems.length}`);
console.log('Статусы:', byStatus);
console.log(`Файлы сохранены в ${OUT}`);
