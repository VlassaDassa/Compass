import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import { Pool } from 'pg';
const root = path.resolve(fileURLToPath(new URL('./dist/', import.meta.url)));
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.json':'application/json; charset=utf-8', '.woff2':'font/woff2' };
const port = Number(process.env.PORT || 4173);
const databaseUrl = process.env.COMPASS_DATABASE_URL || process.env.DATABASE_URL || '';
const pool = databaseUrl ? new Pool({connectionString:databaseUrl,ssl:process.env.COMPASS_DB_SSL==='true'?{rejectUnauthorized:false}:undefined}) : null;
let databaseState = databaseUrl ? 'connecting' : 'not_configured';

const schema = `
CREATE TABLE IF NOT EXISTS compass_workspace_state (
  workspace_id text PRIMARY KEY,
  state jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS compass_ai_settings (
  workspace_id text PRIMARY KEY,
  provider text NOT NULL,
  model text NOT NULL DEFAULT '',
  base_url text NOT NULL DEFAULT '',
  api_key_cipher text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);`;

async function initializeDatabase(){
  if(!pool)return;
  try{await pool.query(schema);databaseState='connected';}
  catch(error){databaseState='error';console.error('PostgreSQL is unavailable:',error.message);}
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
async function askProvider(config,question,context=''){
  const token=config.provider==='gigachat'?await gigachatToken(config.apiKey):config.apiKey;
  const response=await fetch(`${config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({model:config.model,messages:[{role:'system',content:'Ты помощник внутренней базы знаний IT-поддержки. Отвечай по-русски, коротко и практично. Используй только переданный контекст. Если контекста недостаточно, честно скажи об этом и предложи уточнить вопрос.'},{role:'user',content:`Контекст базы знаний:\n${context}\n\nВопрос пользователя:\n${question}`}],temperature:.2})});
  const text=await response.text();if(!response.ok)throw new Error(`${config.provider}: ${response.status} ${text.slice(0,300)}`);let data;try{data=JSON.parse(text);}catch{throw new Error('Провайдер вернул некорректный ответ');}return data.choices?.[0]?.message?.content||'Провайдер не вернул текст ответа.';
}
async function api(req,res,pathname){
  if(pathname==='/api/status'&&req.method==='GET')return json(res,200,{database:databaseState,persistence:databaseState==='connected'});
  if(!pathname.startsWith('/api/'))return false;
  if(databaseState!=='connected')return json(res,503,{error:'PostgreSQL не настроен или недоступен.',database:databaseState});
  if(pathname==='/api/state'&&req.method==='GET'){
    const result=await pool.query('SELECT state FROM compass_workspace_state WHERE workspace_id=$1',['default']);
    return result.rows[0]?json(res,200,{state:result.rows[0].state}):json(res,404,{state:null});
  }
  if(pathname==='/api/state'&&req.method==='PUT'){
    const body=await readBody(req);if(!body.state||typeof body.state!=='object')return json(res,400,{error:'state is required'});
    await pool.query('INSERT INTO compass_workspace_state(workspace_id,state) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()',['default',body.state]);return json(res,200,{ok:true});
  }
  if(pathname==='/api/ai/settings'&&req.method==='GET'){
    const settings=await aiSettings();return json(res,200,{provider:settings?.provider||'gigachat',model:settings?.model||providerDefaults.gigachat.model,baseUrl:settings?.baseUrl||providerDefaults.gigachat.baseUrl,configured:Boolean(settings?.apiKey),updatedAt:settings?.updatedAt||null});
  }
  if(pathname==='/api/ai/settings'&&req.method==='PUT'){
    const config=providerConfig(await readBody(req)),previous=await aiSettings();config.apiKey ||= previous?.apiKey||'';if(!config.apiKey)return json(res,400,{error:'Укажите API-ключ провайдера.'});
    await pool.query('INSERT INTO compass_ai_settings(workspace_id,provider,model,base_url,api_key_cipher) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id) DO UPDATE SET provider=EXCLUDED.provider,model=EXCLUDED.model,base_url=EXCLUDED.base_url,api_key_cipher=EXCLUDED.api_key_cipher,updated_at=now()',['default',config.provider,config.model,config.baseUrl,encrypt(config.apiKey)]);return json(res,200,{provider:config.provider,model:config.model,baseUrl:config.baseUrl,configured:true});
  }
  if(pathname==='/api/assistant/query'&&req.method==='POST'){
    const body=await readBody(req),question=String(body.question||'').trim(),config=await aiSettings();if(!question)return json(res,400,{error:'Задайте вопрос.'});if(!config?.apiKey)return json(res,409,{error:'ИИ-провайдер ещё не настроен.'});
    try{return json(res,200,{text:await askProvider(config,question,String(body.context||'').slice(0,12000)),provider:config.provider});}catch(error){return json(res,502,{error:error.message});}
  }
  return json(res,404,{error:'API route not found'});
}
const server = http.createServer(async (req,res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.startsWith('/api/')){await api(req,res,pathname);return;}
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if(!target.startsWith(root + path.sep) && target !== path.join(root,'index.html')) {res.writeHead(403).end();return;}
    const body = await readFile(target);
    res.writeHead(200, {'Content-Type':types[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(body);
  } catch(error) {if(!res.headersSent)json(res,error.message==='Request is too large'?413:500,{error:error.message||'Server error'});}
});
await initializeDatabase();
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port} · PostgreSQL: ${databaseState}`));
