import {randomBytes} from 'node:crypto';
import {writeFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
const file=new URL('../.env',import.meta.url);
try{await access(file,constants.F_OK);console.log('.env уже существует и оставлен без изменений. Проверьте параметры по .env.example.');process.exit(0);}catch{}
const password=randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex'),login=randomBytes(18).toString('base64url');
const content=`NODE_ENV=production
HOST=127.0.0.1
PORT=4180
COMPASS_PUBLIC_URL=https://compass.vlassadassa.ru
POSTGRES_USER=compass
POSTGRES_DB=compass
POSTGRES_PASSWORD=${password}
COMPASS_POSTGRES_PORT=55432
COMPASS_DATABASE_URL=postgresql://compass:${password}@127.0.0.1:55432/compass
COMPASS_DB_SSL=false
COMPASS_SECRET=${secret}
COMPASS_AUTH_USER=admin
COMPASS_AUTH_PASSWORD=${login}
`;
await writeFile(file,content,{mode:0o600,flag:'wx'});
console.log('Создан .env с отдельными случайными паролями и ключом шифрования. Секреты не выводятся. Откройте .env, чтобы записать логин и COMPASS_AUTH_PASSWORD для входа.');
