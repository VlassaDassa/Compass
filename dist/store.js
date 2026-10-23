import { initialArticles, initialUsers,people } from './data.js';
import {createOffice,upgradeOffice} from './office-model.js';
import {redactVault} from './vault-model.js';
import {ensureBuildings} from './workspace-model.js';
import {appearanceVersion,migrateAppearanceSettings} from './appearance.js';
const enrichPeople=()=>people.map((p,i)=>({...p,email:`employee${i+1}@example.test`,personalPhone:`+7 (000) 000-00-${String(i+1).padStart(2,'0')}`}));
const seed = () => ({articles:structuredClone(initialArticles),users:structuredClone(initialUsers),favorites:['new-workplace','shared-folder'],drafts:{},links:[],settings:{provider:'external',center:'БЦ «Горизонт»'},people:enrichPeople(),office:createOffice(people),demoCredentials:Object.fromEntries(people.map((p,i)=>[p.id,`Demo-Only-${i+1}!`]))});
let db;
let revision=0;
export let state;
export let persistent = false;
export let serverBacked = false;
export const storageLabel=()=>serverBacked?'PostgreSQL':'локальном хранилище браузера';
async function serverState(){
  const response=await fetch('/api/state',{cache:'no-store'});
  if(response.status===404)return null;
  if(!response.ok)throw new Error('Серверное хранилище недоступно.');
  const payload=await response.json();revision=payload.revision||0;return payload.state||null;
}
async function serverPersist(next){
  const response=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({state:next,revision})});
  const payload=await response.json().catch(()=>({}));if(!response.ok){const error=new Error(payload.error||'Не удалось сохранить данные в PostgreSQL.');error.conflict=response.status===409;throw error;}revision=payload.revision;
}
export async function initialize(){
  let backendRequired=false;
  try{const response=await fetch('/api/status',{cache:'no-store'});if(response.ok&&response.headers.get('content-type')?.includes('application/json')){const status=await response.json();backendRequired=status.runtime==='server';if(backendRequired&&!status.persistence)throw new Error('PostgreSQL недоступен.');}}catch(error){if(backendRequired)throw error;}
  try{
    const remote=await serverState();
    state=remote||seed();serverBacked=true;persistent=true;
    const needsMigration=!state.office||!state.people||!state.demoCredentials||state.office.version<2||!state.vault||!state.office.buildings||state.office.floors.some(f=>!f.buildingId)||state.settings?.appearance?.version!==appearanceVersion;
    state.settings??={};migrateAppearanceSettings(state.settings);
    state.people??=enrichPeople();state.office??=createOffice(state.people);
    upgradeOffice(state.office);
    ensureBuildings(state.office);
    state.vault??=[{id:'share-folder',title:'Общая папка',notes:'Добавьте рабочие данные после настройки сервера.',updatedAt:'2026-10-22T00:00:00Z',fields:[{id:'path',label:'Сетевой путь',value:'',secret:false},{id:'contact',label:'Ответственный',value:'',secret:false}]}];state.vaultTrash??=[];
    state.demoCredentials??=Object.fromEntries(state.people.map((p,i)=>[p.id,`Demo-Only-${i+1}!`]));
    if(!remote||needsMigration)await serverPersist(state);
    return state;
  }catch(error){
    if(backendRequired)throw error;
    serverBacked=false;
  }
  try{
    db=await new Promise((resolve,reject)=>{const r=indexedDB.open('compass-knowledge-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const saved=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    state=saved||seed();persistent=true;
    // Add the editable office without touching existing articles or drafts.
    const needsMigration=!state.office||!state.people||!state.demoCredentials||state.office.version<2||!state.vault||!state.office.buildings||state.office.floors.some(f=>!f.buildingId)||state.settings?.appearance?.version!==appearanceVersion;
    state.settings??={};migrateAppearanceSettings(state.settings);
    state.people??=enrichPeople();state.office??=createOffice(state.people);
    upgradeOffice(state.office);
    ensureBuildings(state.office);
    state.vault??=[{id:'share-folder',title:'Общая папка',notes:'Сетевые пути и ответственные команды.',updatedAt:'2026-10-22T00:00:00Z',fields:[{id:'path',label:'Сетевой путь',value:'',secret:false},{id:'contact',label:'Ответственный',value:'',secret:false}]},{id:'internal-service',title:'Внутренний сервис',notes:'Ссылки, логины и скрытые значения в одной записи.',updatedAt:'2026-10-22T00:00:00Z',fields:[{id:'url',label:'URL',value:'',secret:false},{id:'login',label:'Логин',value:'',secret:false},{id:'password',label:'Пароль',value:'',secret:true}]}];state.vaultTrash??=[];
    state.demoCredentials??=Object.fromEntries(state.people.map((p,i)=>[p.id,`Demo-Only-${i+1}!`]));
    if(!saved||needsMigration)await persist(state);
  }catch{state??=seed();persistent=false;}
  state.vault??=[];state.vaultTrash??=[];state.settings??={};migrateAppearanceSettings(state.settings);ensureBuildings(state.office);return state;
}
async function persist(next){
  if(serverBacked){await serverPersist(next);return;}
  if(!db)throw new Error('Хранилище браузера недоступно. Разрешите локальное хранение данных.');
  await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(next,'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Не удалось сохранить.'));tx.onabort=()=>reject(tx.error||new Error('Запись отменена.'));});
}
let saving=Promise.resolve();
export function update(mutator){
  const task=saving.then(async()=>{for(let attempt=0;attempt<3;attempt++){const next=structuredClone(state);mutator(next);try{await persist(next);state=next;return state;}catch(error){if(!error.conflict||!serverBacked||attempt===2)throw error;state=await serverState();ensureBuildings(state.office);}}});saving=task.catch(()=>{});return task;
}
export function exportWorkspace(){const blob=new Blob([JSON.stringify({format:'compass-workspace',version:1,state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='compass-workspace.compass';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function importWorkspace(payload){const imported=payload?.format==='compass-workspace'?payload.state:payload;if(!imported||!Array.isArray(imported.articles)||!Array.isArray(imported.people)||!Array.isArray(imported.office?.floors)||!Array.isArray(imported.users))throw new Error('Файл не содержит рабочего пространства Compass.');await update(next=>{for(const key of Object.keys(next))delete next[key];Object.assign(next,structuredClone(imported));next.settings??={};migrateAppearanceSettings(next.settings);next.links??=[];next.favorites??=[];next.drafts??={};next.demoCredentials??={};next.vault??=[];next.vaultTrash??=[];upgradeOffice(next.office);ensureBuildings(next.office);});}
export function exportSnapshot(){const {demoCredentials,vault,vaultTrash,...data}=state;return{schemaVersion:3,exportedAt:new Date().toISOString(),...data,vault:redactVault(vault||[])};}
export function exportData(){const blob=new Blob([JSON.stringify(exportSnapshot(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`compass-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function textContent(html){const doc=new DOMParser().parseFromString(html,'text/html');return doc.body.textContent||'';}
export function searchArticles(query,items=state.articles){const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);return items.filter(a=>a.status==='published'&&terms.every(t=>(a.title+' '+a.summary+' '+a.tags.join(' ')+' '+textContent(a.body)).toLocaleLowerCase('ru').includes(t)));}
export function similarArticles(title,exclude){const words=title.toLocaleLowerCase('ru').match(/[а-яёa-z0-9]{4,}/g)||[];if(!words.length)return[];return state.articles.filter(a=>a.id!==exclude&&a.status==='published').map(a=>({article:a,score:words.filter(w=>(a.title+' '+a.summary).toLocaleLowerCase('ru').includes(w)).length/words.length})).filter(x=>x.score>=.4).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>x.article);}
export function sanitize(html){
  const doc=new DOMParser().parseFromString(html,'text/html');
  const allowed=new Set(['P','BR','H1','H2','H3','H4','STRONG','B','EM','I','U','S','DEL','UL','OL','LI','BLOCKQUOTE','PRE','CODE','A','IMG','TABLE','TBODY','THEAD','TR','TH','TD','HR','LABEL','INPUT','SPAN','DIV','COLGROUP','COL']);
  for(const el of [...doc.body.querySelectorAll('*')]){
    if(['SCRIPT','STYLE','IFRAME','OBJECT','EMBED','SVG','MATH','FORM'].includes(el.tagName)){el.remove();continue;}
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);continue;}
    const attrs={};
    for(const a of [...el.attributes]){
      if(['alt','title','colspan','rowspan','data-type','data-checked','start','colwidth'].includes(a.name))attrs[a.name]=a.value;
      if(a.name==='href'&&el.tagName==='A'&&/^(https?:\/\/|mailto:|tel:|#)/i.test(a.value))attrs.href=a.value;
      if(a.name==='src'&&el.tagName==='IMG'&&/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(a.value))attrs.src=a.value;
    }
    for(const a of [...el.attributes])el.removeAttribute(a.name);
    for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);
    if(el.tagName==='A'){el.setAttribute('target','_blank');el.setAttribute('rel','noopener noreferrer');}
    if(el.tagName==='IMG'&&!attrs.src)el.remove();
    if(el.tagName==='INPUT'){el.setAttribute('type','checkbox');el.setAttribute('disabled','');if(el.closest('[data-checked="true"]'))el.setAttribute('checked','');}
  }
  return doc.body.innerHTML;
}
