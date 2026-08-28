# Деплой МатАкадемия CRM в облако

Стек в облаке: **Vercel** (хостинг Next.js) + **Neon** (бесплатный PostgreSQL).
Проект уже переведён на PostgreSQL и подготовлен к деплою — ниже только то, что нужно
сделать вам (требуются ваши личные аккаунты; за вас их создать нельзя).

Оценка времени: ~15 минут. Всё в рамках бесплатных тарифов.

---

## Шаг 1. Загрузить код на GitHub

Vercel деплоит из Git-репозитория.

```bash
# в папке проекта
git add -A
git commit -m "MatAcademy CRM"
```

1. Создайте пустой репозиторий на https://github.com/new (например, `matacademy-crm`, private).
2. Подключите и запушьте (GitHub попросит ваш логин/токен — это делаете вы):

```bash
git remote add origin https://github.com/ВАШ_ЛОГИН/matacademy-crm.git
git branch -M main
git push -u origin main
```

---

## Шаг 2. Создать базу PostgreSQL (Neon)

1. Зарегистрируйтесь на https://neon.tech (можно через GitHub).
2. Create Project → регион ближе к вам (например, Europe).
3. На странице проекта откройте **Connection Details** и скопируйте две строки:
   - **Pooled connection** (с `-pooler` в хосте) → это `DATABASE_URL`
   - **Direct connection** (без `-pooler`) → это `DIRECT_URL`

   Обе строки вида `postgresql://user:pass@host/dbname?sslmode=require`.

---

## Шаг 3. Создать проект на Vercel

1. Зарегистрируйтесь на https://vercel.com (через GitHub).
2. **Add New… → Project** → выберите репозиторий `matacademy-crm`.
3. Framework Preset определится как **Next.js** автоматически. Ничего не меняйте.
4. Разверните раздел **Environment Variables** и добавьте четыре переменные:

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | pooled-строка из Neon |
   | `DIRECT_URL` | direct-строка из Neon |
   | `AUTH_SECRET` | сгенерируйте: в терминале `openssl rand -base64 32` |
   | `AUTH_TRUST_HOST` | `true` |

5. Нажмите **Deploy**.

При сборке Vercel сам выполнит `prisma generate && prisma migrate deploy` — таблицы
создадутся в вашей базе Neon автоматически (скрипт `build` в package.json).

---

## Шаг 4. Залить стартовые данные (один раз)

После первого успешного деплоя база пустая (нет даже пользователей для входа).
Залейте демо-данные и учётные записи с вашего компьютера, указав строку Neon:

```bash
# подставьте вашу DIRECT-строку из Neon
DATABASE_URL="postgresql://...direct..." DIRECT_URL="postgresql://...direct..." npm run db:seed
```

После этого можно войти на вашем `*.vercel.app` под `admin@matacademy.kz` / `admin123`.

> ⚠️ **Смените демо-пароли перед реальным использованием.** Отредактируйте `prisma/seed.ts`
> или заведите настоящих пользователей (можно через `npm run db:studio`, подключившись к Neon).

---

## Обновления в будущем

Любой `git push` в ветку `main` автоматически пересобирает и передеплоивает проект.
Если меняли схему базы (`prisma/schema.prisma`) — сначала создайте миграцию локально:

```bash
npm run db:migrate -- --name краткое_описание
git add -A && git commit -m "..." && git push
```

Миграция применится в облаке автоматически при сборке.

---

## Авто-напоминания в Telegram (необязательно)

Система умеет сама отправлять родителям напоминания об оплате и об окончании абонемента
через Telegram-бота — бесплатно. Настройка (~10 минут):

1. **Создайте бота**: напишите [@BotFather](https://t.me/BotFather) → `/newbot` → задайте имя.
   Получите **токен** (вида `123456:ABC-...`) и **username** бота (например `matacademy_bot`).
2. **Добавьте переменные** в Vercel (Settings → Environment Variables):
   - `TELEGRAM_BOT_TOKEN` — токен от BotFather
   - `TELEGRAM_BOT_USERNAME` — username бота без `@`
   - `CRON_SECRET` — случайная строка (`openssl rand -hex 16`)
   - `TELEGRAM_ADMIN_CHAT_ID` — ваш chat id для ежедневной сводки (узнать у [@userinfobot](https://t.me/userinfobot)); можно оставить пустым
   - `TELEGRAM_WEBHOOK_SECRET` — случайная строка (для защиты вебхука)
3. **Подключите вебхук** (один раз, чтобы бот ловил «Старт» родителей). Выполните в терминале,
   подставив токен, ваш домен и секрет:
   ```bash
   curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://crm.matacademy.kz/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
4. **Готово.** Теперь в карточке каждого ученика есть кнопка «Открыть в Telegram» / ссылка —
   отправьте её родителю, он нажмёт «Старт» и подпишется. Рассылка идёт автоматически каждый
   день в 09:00 (Алматы) через Vercel Cron. Проверить вручную:
   ```bash
   curl "https://crm.matacademy.kz/api/cron/reminders?secret=<CRON_SECRET>"
   ```

Без этих переменных приложение работает как обычно — просто без авто-рассылки
(напоминания остаются доступны вручную на странице «Напоминания» с кнопкой WhatsApp).

## Локальная разработка (PostgreSQL)

Проект использует PostgreSQL и локально. Самый простой способ — Docker:

```bash
docker run -d --name matacademy-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=matacademy -p 5434:5432 postgres:16

cp .env.example .env          # строки уже настроены на локальный Docker
# впишите AUTH_SECRET: openssl rand -base64 32

npm install
npm run db:deploy             # применить миграции
npm run db:seed               # демо-данные
npm run dev                   # http://localhost:3000
```

Альтернатива без Docker — создать в Neon отдельную ветку для разработки и указать её
строки в `.env`.
