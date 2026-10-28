# Compass на VPS с Docker

Схема как у портфолио: Caddy → `127.0.0.1:4180` → контейнер приложения → PostgreSQL в отдельном контейнере. Проект: `/srv/compass/repo`. Порт PostgreSQL наружу не публикуется. Node.js и npm на VPS устанавливать не нужно: приложение собирается внутри Docker.

## Перед началом

Нужны Git, Docker, Docker Compose, openssl и Caddy. Проверьте `docker --version`, `docker compose version`, `docker info` и `openssl version`. Если Docker требует sudo, используйте `sudo docker compose` вместо `docker compose` во всех командах; не предоставляйте доступ к Docker другим пользователям без понимания рисков. Убедитесь, что порт 4180 свободен: `sudo ss -ltnp | grep ':4180'`. Если он занят, остановитесь и выберите другой порт через `COMPASS_APP_PORT` и Caddy.

Если `/srv/compass/repo` уже существует, не клонируйте и не удаляйте его. Проверьте владельца и изменения, затем обновите ветку:

```bash
cd /srv/compass/repo
git status --short --branch
git pull --ff-only origin work
```

При ошибке или наличии локальных изменений сначала разберитесь с ними; не используйте `git reset --hard`. Для новой установки:

```bash
sudo install -d -o deploy -g deploy /srv/compass
git clone --branch work https://github.com/VlassaDassa/Compass.git /srv/compass/repo
cd /srv/compass/repo
```

Если ранее запускали Compass через systemd, проверьте `sudo systemctl status compass`; не запускайте второй экземпляр на том же порту. Не останавливайте другие проекты.

## Настройка и запуск

```bash
bash scripts/setup-docker.sh
nano .env
docker compose up -d --build
docker compose ps
docker compose logs --tail=80 app
```

Скрипт создаёт `.env` со случайными паролями, только если файла нет. Запишите `COMPASS_AUTH_USER` и `COMPASS_AUTH_PASSWORD` для входа; файл никому не отправляйте. Сохраните защищённую копию `.env`: `COMPASS_SECRET` нужен для расшифровки ключа ИИ. Пароль PostgreSQL генерируется в hex; при ручной замене используйте безопасные URL символы. При уже существующей БД замена пароля в `.env` не меняет пароль её пользователя. Не удаляйте том для исправления настройки.

В `.env` от старого запуска могут оставаться `HOST`, `PORT`, `COMPASS_DATABASE_URL`: Docker Compose задаёт приложению отдельные внутренние значения и подключается к `postgres:5432`; прежние секреты и данные тома сохраняются. Если `.env` уже существует, убедитесь, что `POSTGRES_USER`, `POSTGRES_DB`, `POSTGRES_PASSWORD`, `COMPASS_SECRET`, `COMPASS_AUTH_USER` и `COMPASS_AUTH_PASSWORD` заполнены.

Проверка (подставьте другой логин вместо admin при необходимости):

```bash
curl -u admin http://127.0.0.1:4180/api/health
```

Введите пароль при запросе. Ответ должен содержать `database: connected` и `persistence: true`. База запускается первой и сервер автоматически создаёт рабочие таблицы. Если база не отвечает, используйте `docker compose logs --tail=80 postgres` и `docker compose logs --tail=80 app`. Не публикуйте журналы с секретами.

## Caddy и HTTPS

Проверьте, что DNS `compass.vlassadassa.ru` указывает на VPS и доступны порты 80 и 443. Сохраните копию конфигурации и добавьте новый блок, не меняя остальные сайты:

```bash
sudo cp -n /etc/caddy/Caddyfile /etc/caddy/Caddyfile.before-compass
sudo nano /etc/caddy/Caddyfile
```

```caddyfile
compass.vlassadassa.ru {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4180
}
```

```bash
sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy
```

Откройте https://compass.vlassadassa.ru и войдите с данными из `.env`. Это пока единый общий логин: отдельная авторизация и разделение ролей не реализованы. Не храните настоящие пароли и конфиденциальные данные до доработки безопасности.

## Перенос и резервные копии

На старом сайте экспортируйте файл в «Настройки → Общее → Перенос рабочего пространства», затем импортируйте на новом. Импорт заменяет текущее пространство: сначала сделайте копию нового. Файл может содержать секреты в открытом виде; обращайтесь с ним как с конфиденциальным.

```bash
cd /srv/compass/repo
bash scripts/backup.sh
```

Копии находятся в `/srv/compass/backups/`; защищённую копию храните также вне VPS вместе с `.env`. Восстановление заменяет данные, поэтому сначала сделайте новую копию и проверьте целевую базу. Не выполняйте `docker compose down -v`: это удалит том PostgreSQL. После остановки обычной командой `docker compose stop` данные сохраняются.

## Обновление

```bash
cd /srv/compass/repo
bash scripts/backup.sh
git status --short --branch
git pull --ff-only origin work
docker compose up -d --build
docker compose ps
```

## ИИ

В серверной версии откройте «Настройки → ИИ-помощник». Для GigaChat зарегистрируйтесь у провайдера, получите OAuth Authorization Key для `GIGACHAT_API_PERS`, выберите GigaChat, укажите доступную модель (например `GigaChat-2-Max`) и `https://gigachat.devices.sberbank.ru/api/v1`, вставьте ключ и сохраните. Проверьте текущие тарифы и доступность модели у провайдера. Вопрос и найденные фрагменты статей отправляются внешнему сервису. Для другого OpenAI-compatible провайдера укажите его URL, модель и новый ключ. Ключ шифруется через `COMPASS_SECRET`. С текущим общим входом любой его владелец может поменять провайдера; полноценного разделения прав пока нет.

Docker-образ включает `certs/russian-trusted-ca.pem`, взятый из репозитория портфолио `VlassaDassa/Sadovnikov`. `NODE_EXTRA_CA_CERTS` добавляет его к стандартным доверенным сертификатам Node.js для всех исходящих TLS-соединений приложения, не только GigaChat. Это расширяет список доверенных центров; проверку подлинности TLS не отключает. Проверяйте происхождение, актуальность и отпечатки сертификатов по официальным источникам и обновляйте bundle при изменениях. Если ошибка остаётся, проверьте DNS и исходящий доступ контейнера к GigaChat; не используйте `NODE_TLS_REJECT_UNAUTHORIZED=0`.
