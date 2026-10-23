#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /srv/compass/repo
mkdir -p /srv/compass/backups
backup_file="/srv/compass/backups/compass-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$backup_file"
test -s "$backup_file"
printf 'Backup saved: %s\n' "$backup_file"
