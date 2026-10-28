import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
import {buildProviderMessages} from './dist/ai-prompts.js';
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.woff2':'font/woff2' };
const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.COMPASS_DATABASE_URL || process.env.DATABASE_URL || '';
const production=process.env.NODE_ENV==='production';
const username=process.env.COMPASS_AUTH_USER||'admin',password=process.env.COMPASS_AUTH_PASSWORD||'';
if(production&&(!databaseUrl||!process.env.COMPASS_SECRET||!password))throw new Error('Production requires COMPASS_DATABASE_URL, COMPASS_SECRET and COMPASS_AUTH_PASSWORD.');
const pool = databaseUrl ? new Pool({connectionString:databaseUrl,connectionTimeoutMillis:5000,ssl:process.env.COMPASS_DB_SSL==='true'?{rejectUnauthorized:true}:undefined}) : null;
pool?.on('error',error=>console.error('PostgreSQL pool:',error.message));
let databaseState = databaseUrl ? 'connecting' : 'not_configured';

const schema=await readFile(new URL('./docs/runtime-schema.sql',import.meta.url),'utf8');

async function initializeDatabase(){
  if(!pool)return;
  try{await pool.query(schema);databaseState='connected';}
  catch(error){databaseState='error';console.error('PostgreSQL is unavailable:',error.message);if(production)throw error;}
}
const json=(res,status,payload)=>{const body=JSON.stringify(payload);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);};
const readBody=req=>new Promise((resolve,reject)=>{let body='';req.setEncoding('utf8');req.on('data',chunk=>{body+=chunk;if(body.length>20*1024*1024)reject(new Error('Request is too large'));});req.on('end',()=>{try{resolve(body?JSON.parse(body):{});}catch{reject(new Error('Invalid JSON'));}});req.on('error',reject);});
const secretKey=()=>crypto.createHash('sha256').update(process.env.COMPASS_SECRET||'local-development-only-change-me').digest();
function encrypt(value){if(!value)return'';const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',secretKey(),iv);const encrypted=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return [iv,cipher.getAuthTag(),encrypted].map(x=>x.toString('base64url')).join('.');}
function decrypt(value){if(!value)return'';try{const [iv,tag,data]=value.split('.').map(x=>Buffer.from(x,'base64url'));const decipher=crypto.createDecipheriv('aes-256-gcm',secretKey(),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString('utf8');}catch{return'';}}
async function aiSettings(){if(!pool||databaseState!=='connected')return null;const result=await pool.query('SELECT provider, model, base_url, api_key_cipher, updated_at FROM compass_ai_settings WHERE workspace_id=$1',['default']);const row=result.rows[0];return row?{provider:row.provider,model:row.model,baseUrl:row.base_url,apiKey:decrypt(row.api_key_cipher),configured:Boolean(row.api_key_cipher),updatedAt:row.updated_at}:null;}
const providerDefaults={gigachat:{model:'GigaChat-2-Max',baseUrl:'https://gigachat.devices.sberbank.ru/api/v1'},openai:{model:'deepseek-chat',baseUrl:'https://api.deepseek.com/v1'},custom:{model:'',baseUrl:''}};
function providerConfig(input){const provider=['gigachat','openai','custom'].includes(input.provider)?input.provider:'gigachat';const defaults=providerDefaults[provider];return{provider,model:String(input.model||defaults.model).slice(0,120),baseUrl:String(input.baseUrl||defaults.baseUrl).replace(/\/$/,'').slice(0,500),apiKey:String(input.apiKey||'').slice(0,1000)};}
async function gigachatToken(apiKey){const response=await fetch('https://ngw.devices.sberbank.ru:9443/api/v2/oauth',{method:'POST',headers:{Authorization:`Basic ${apiKey}`,RqUID:crypto.randomUUID(),'Content-Type':'application/x-www-form-urlencoded'},body:'scope=GIGACHAT_API_PERS'});if(!response.ok)throw new Error(`GigaChat OAuth: ${response.status}`);const data=await response.json();return data.access_token;}
async function askProvider(config,messages){
  const token=config.provider==='gigachat'?await gigachatToken(config.apiKey):config.apiKey;
  const response=await fetch(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages,temperature:.2})});
  const text=await response.text();if(!response.ok)throw new Error(`${config.provider}: ${response.status} ${text.slice(0,300)}`);let data;try{data=JSON.parse(text);}catch{throw new Error('Провайдер вернул некорректный ответ');}return data.choices?.[0]?.message?.content||'Провайдер не вернул текст ответа.';
}
async function api(req,res,pathname){
  if((pathname==='/api/status'||pathname==='/api/health')&&req.method==='GET'){
    if(pool)try{await pool.query('SELECT 1');databaseState='connected';}catch{databaseState='error';}
    return json(res,pathname==='/api/health'&&databaseState!=='connected'?503:200,{runtime:'server',database:databaseState,persistence:databaseState==='connected'});
  }
  if(!pathname.startsWith('/api/'))return false;
  if(databaseState!=='connected')return json(res,503,{error:'PostgreSQL не настроен или недоступен.',database:databaseState});
  if(pathname==='/api/state'&&req.method==='GET'){
    const result=await pool.query('SELECT state,revision FROM compass_workspace_state WHERE workspace_id=$1',['default']);
    return result.rows[0]?json(res,200,{state:result.rows[0].state,revision:result.rows[0].revision}):json(res,404,{state:null});
  }
  if(pathname==='/api/state'&&req.method==='PUT'){
    const body=await readBody(req),state=body.state;
    if(!state||!Array.isArray(state.articles)||!Array.isArray(state.people)||!Array.isArray(state.office?.floors)||!Array.isArray(state.users))return json(res,400,{error:'Некорректное рабочее пространство.'});
    if(!Number.isInteger(body.revision)||body.revision<0)return json(res,400,{error:'Укажите версию рабочего пространства.'});
    const result=await pool.query('INSERT INTO compass_workspace_state(workspace_id,state,revision) VALUES($1,$2,1) ON CONFLICT(workspace_id) DO UPDATE SET state=EXCLUDED.state,revision=compass_workspace_state.revision+1,updated_at=now() WHERE compass_workspace_state.revision=$3 RETURNING revision',['default',state,body.revision]);
    if(!result.rows.length)return json(res,409,{error:'Данные изменились в другом окне. Обновляем рабочее пространство.'});
    return json(res,200,{ok:true,revision:result.rows[0].revision});
  }
  if(pathname==='/api/ai/settings'&&req.method==='GET'){
    const settings=await aiSettings();return json(res,200,{provider:settings?.provider||'gigachat',model:settings?.model||providerDefaults.gigachat.model,baseUrl:settings?.baseUrl||providerDefaults.gigachat.baseUrl,configured:Boolean(settings?.apiKey),updatedAt:settings?.updatedAt||null});
  }
  if(pathname==='/api/ai/settings'&&req.method==='PUT'){
    const config=providerConfig(await readBody(req)),previous=await aiSettings();config.apiKey ||= previous?.apiKey||'';if(!config.apiKey)return json(res,400,{error:'Укажите API-ключ провайдера.'});
    await pool.query('INSERT INTO compass_ai_settings(workspace_id,provider,model,base_url,api_key_cipher) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id) DO UPDATE SET provider=EXCLUDED.provider,model=EXCLUDED.model,base_url=EXCLUDED.base_url,api_key_cipher=EXCLUDED.api_key_cipher,updated_at=now()',['default',config.provider,config.model,config.baseUrl,encrypt(config.apiKey)]);return json(res,200,{provider:config.provider,model:config.model,baseUrl:config.baseUrl,configured:true});
  }
  if(pathname==='/api/assistant/query'&&req.method==='POST'){
    const body=await readBody(req),config=await aiSettings();if(!config?.apiKey)return json(res,409,{error:'ИИ-провайдер ещё не настроен.'});let messages;try{messages=buildProviderMessages(body);}catch(error){return json(res,400,{error:error.message});}
    try{return json(res,200,{text:await askProvider(config,messages),provider:config.provider});}catch(error){return json(res,502,{error:error.message});}
  }
  return json(res,404,{error:'API route not found'});
}
function authorized(req,res){
  if(!password)return true;
  const supplied=String(req.headers.authorization||'').replace(/^Basic /i,'');
  let decoded='';try{decoded=Buffer.from(supplied,'base64').toString('utf8');}catch{}
  const digest=value=>crypto.createHash('sha256').update(value).digest();
  if(crypto.timingSafeEqual(digest(decoded),digest(username+':'+password)))return true;
  res.writeHead(401,{'WWW-Authenticate':'Basic realm="Compass", charset="UTF-8"','Cache-Control':'no-store'}).end('Authentication required');return false;
}
const server = http.createServer(async (req,res) => {
  try {
    if(!authorized(req,res))return;
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin){const allowed=process.env.COMPASS_PUBLIC_URL||('http://'+req.headers.host);if(req.headers.origin!==allowed){json(res,403,{error:'Недопустимый источник запроса.'});return;}}
    res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/api/')){await api(req,res,pathname);return;}
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if(!target.startsWith(root + path.sep) && target !== path.join(root,'index.html')) {res.writeHead(403).end();return;}
    const body = await readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
  } catch(error) {if(!res.headersSent)json(res,error.message==='Request is too large'?413:error.message==='Invalid JSON'?400:error.code==='ENOENT'?404:500,{error:error.message||'Server error'});}
});
await initializeDatabase();
server.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} · PostgreSQL: ${databaseState}`));

async function shutdown(){server.close(async()=>{await pool?.end();process.exit(0);});setTimeout(()=>process.exit(1),10000).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
