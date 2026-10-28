#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
if [[ -e .env ]]; then
  printf '%s\n' '.env уже существует и оставлен без изменений. Проверьте обязательные поля по .env.example.'
  exit 0
fi
if ! command -v openssl >/dev/null 2>&1; then
  printf '%s\n' 'Для генерации паролей нужен openssl. Установите его или создайте .env вручную по .env.example.' >&2
  exit 1
fi
db_password=$(openssl rand -hex 24)
app_secret=$(openssl rand -hex 32)
login_password=$(openssl rand -hex 24)
# noclobber prevents an existing file from being replaced, even on a race.
set -C
printf '%s\n' \
  'COMPASS_PUBLIC_URL=https://compass.vlassadassa.ru' \
  'COMPASS_APP_PORT=4180' \
  'POSTGRES_USER=compass' \
  'POSTGRES_DB=compass' \
  "POSTGRES_PASSWORD=$db_password" \
  "COMPASS_SECRET=$app_secret" \
  'COMPASS_AUTH_USER=admin' \
  "COMPASS_AUTH_PASSWORD=$login_password" > .env
set +C
printf '%s\n' 'Создан .env с отдельными случайными паролями. Посмотрите логин и COMPASS_AUTH_PASSWORD в .env и сохраните файл в защищённом месте.'
