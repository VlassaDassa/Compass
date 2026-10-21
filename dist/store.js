import { initialArticles, initialUsers } from './data.js';
const seed = () => ({articles:structuredClone(initialArticles),users:structuredClone(initialUsers),favorites:['new-workplace','shared-folder'],drafts:{},links:[],settings:{provider:'external',center:'БЦ «Горизонт»'}});
let db;
export let state;
export let persistent = false;
export async function initialize(){
  try{
    db=await new Promise((resolve,reject)=>{const r=indexedDB.open('compass-knowledge-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('workspace');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const saved=await new Promise((resolve,reject)=>{const r=db.transaction('workspace').objectStore('workspace').get('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    state=saved||seed();persistent=true;
    if(!saved)await persist(state);
  }catch{state=seed();persistent=false;}
  return state;
}
async function persist(next){
  if(!db)throw new Error('Хранилище браузера недоступно. Разрешите локальное хранение данных.');
  await new Promise((resolve,reject)=>{const tx=db.transaction('workspace','readwrite');tx.objectStore('workspace').put(next,'state');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Не удалось сохранить.'));tx.onabort=()=>reject(tx.error||new Error('Запись отменена.'));});
}
let saving=Promise.resolve();
export function update(mutator){
  const task=saving.then(async()=>{const next=structuredClone(state);mutator(next);await persist(next);state=next;return state;});saving=task.catch(()=>{});return task;
}
export function exportData(){const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),...state},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`compass-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
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
