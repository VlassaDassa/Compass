# Compass на compass.vlassadassa.ru

Схема: Caddy → `127.0.0.1:4180` → Node.js → PostgreSQL `127.0.0.1:55432`.
Проект: `/srv/compass/repo`. Остальные сайты, их порты и блоки Caddy не меняются.
Нужны Node.js 22+, Docker с `docker compose`, Git и уже установленный Caddy.

## 1. Скачать исходники

Выполняйте на VPS от `deploy`:

```bash
sudo install -d -o deploy -g deploy /srv/compass
git clone --branch work https://github.com/VlassaDassa/Compass.git /srv/compass/repo
cd /srv/compass/repo
npm ci
npm run build
npm run setup:vps
nano .env
```

Запишите `COMPASS_AUTH_USER` и `COMPASS_AUTH_PASSWORD`: это вход владельца через
браузер. Генератор не выводит секреты и никогда не перезаписывает существующий
`.env`. Если `.env` уже был создан раньше, сверьте его с `.env.example` и добавьте
недостающие параметры. Никогда не отправляйте `.env` в GitHub.

Убедитесь, что `4180` и `55432` свободны (`sudo ss -ltnp`). При необходимости
выберите другие свободные порты. Порт приложения должен совпадать в `.env` и
блоке Caddy; порт БД — в `COMPASS_POSTGRES_PORT` и `COMPASS_DATABASE_URL`.

## 2. Подключить PostgreSQL

```bash
docker compose up -d --wait postgres
docker compose exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Compose создаёт отдельную БД и постоянный Docker volume. БД доступна только
через loopback VPS. `COMPASS_DATABASE_URL` из `.env` связывает Node.js с БД;
пароль в URL должен совпадать с `POSTGRES_PASSWORD`.

Таблицы из `docs/runtime-schema.sql` создаются сервером автоматически. Все статьи,
изображения в статьях, версии, сотрудники, корпуса, этажи, места, ссылки, заметки,
хранилище и настройки сохраняются в JSONB рабочего пространства. Ключи ИИ лежат
отдельно с AES-GCM-шифрованием. JSONB — текущая рабочая схема; `docs/schema.sql`
описывает возможное дальнейшее разбиение по сущностям, применять её не нужно.

Для уже установленного PostgreSQL Compose не требуется: создайте отдельного
пользователя и базу, задайте их URL в `.env`. Для внешней БД с проверяемым
сертификатом используйте `COMPASS_DB_SSL=true`. Не отключайте проверку TLS.

Существующие данные Docker volume не меняют пароль от редактирования `.env`.
Для смены пароля используйте `ALTER ROLE` в БД и обновите `.env`. Не удаляйте volume.

## 3. Запустить Compass как службу

```bash
sudo install -m 0644 deploy/compass.service /etc/systemd/system/compass.service
sudo systemctl daemon-reload
sudo systemctl enable --now compass
sudo systemctl status compass --no-pager
journalctl -u compass -n 50 --no-pager
curl -u admin http://127.0.0.1:4180/api/health
```

`curl` спросит пароль. Нормальный ответ: `database: connected`, `persistence: true`.
Если пользователь или путь отличаются, исправьте `User`, `Group`,
`WorkingDirectory` и `EnvironmentFile` в unit-файле до установки.
Приложение в production не запускается без БД, `COMPASS_SECRET` и пароля входа.
При недоступности БД интерфейс сообщает об ошибке, а не переключается незаметно
на другое хранилище. Параллельные записи защищены проверкой версии.

## 4. Добавить поддомен в Caddy

Проверьте A/AAAA-записи `compass.vlassadassa.ru`: они должны вести на этот VPS.
Сохраните копию текущего Caddyfile и добавьте **только новый блок**, не заменяя
существующие сайты:

```caddyfile
compass.vlassadassa.ru {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4180
}
```

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-compass
sudo nano /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Откройте `https://compass.vlassadassa.ru`, введите логин и пароль из `.env`.
Caddy сам выдаст HTTPS-сертификат. Приложение и БД не нужно открывать в firewall.
Сейчас это закрытое рабочее пространство владельца с одним серверным логином;
карточки сотрудников и роли в справочнике не создают отдельные пароли входа.

## 5. Перенести данные из текущего сайта

На старом Compass откройте **Настройки → Общее → Перенос рабочего пространства**,
скачайте файл `.compass`. На VPS в том же разделе импортируйте файл. Перед заменой
данных интерфейс покажет подтверждение. Перенесутся также корпуса, назначения,
заметки и секреты. Файл содержит секреты в открытом виде: удалите его после переноса
и не публикуйте. Обычный JSON-экспорт без секретов остаётся отдельной функцией.

## Обновления и резервные копии

```bash
cd /srv/compass/repo
bash scripts/backup.sh
git pull --ff-only origin work
npm ci
npm run build
sudo systemctl restart compass
```

Копии БД: `/srv/compass/backups/`. Отдельно сохраните `.env` в защищённом месте:
потеря `COMPASS_SECRET` делает ранее сохранённые ключи ИИ нечитаемыми.
Для восстановления в нужную базу (заменяет её содержимое; сначала сделайте копию):

```bash
gzip -dc /srv/compass/backups/ИМЯ_КОПИИ.sql.gz | docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Не используйте `docker compose down -v`: это удаляет данные PostgreSQL.
Остановка без удаления данных: `sudo systemctl stop compass` и `docker compose stop`.
