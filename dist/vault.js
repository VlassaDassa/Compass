import {state,update} from './store.js';
import {copyValue} from './copy-utils.js';
import {searchVault,saveVaultRecord,deleteVaultRecord,restoreVaultRecord} from './vault-model.js';

let ui,active=false,query='',formFields=[],editingId='',revealTimers=new Map();
const $=selector=>document.querySelector(selector);
const e=value=>ui.esc(value??'');
const icon=name=>ui.icon(name);
const button=(action,label,attrs='',cls='btn')=>`<button type="button" data-vault="${action}" class="${cls}" ${attrs}>${label}</button>`;
export function resolveVaultValue(itemId,fieldId){return state.vault.find(item=>item.id===itemId)?.fields.find(field=>field.id===fieldId)?.value;}
export function disposeVault(){active=false;hideRevealed();}
function hideRevealed(){for(const timer of revealTimers.values())clearTimeout(timer);revealTimers.clear();document.querySelectorAll('[data-vault-secret]').forEach(el=>el.textContent='••••••••');document.querySelectorAll('[data-vault="reveal"]').forEach(el=>{el.setAttribute('aria-pressed','false');el.innerHTML=icon('eye');});}
export function mountVault(options){ui=options;active=true;render();}
function fieldValue(item,field){
  if(field.secret)return `<span class="vault-secret-text" data-vault-secret="${e(item.id)}:${e(field.id)}">••••••••</span><div class="vault-secret-actions">${button('reveal',icon('eye'),`data-id="${e(item.id)}" data-field="${e(field.id)}" aria-label="Показать ${e(field.label)}" aria-pressed="false"`,'icon-btn')}<button class="icon-btn" type="button" data-copy-vault-item="${e(item.id)}" data-copy-vault-field="${e(field.id)}" aria-label="Скопировать ${e(field.label)}">${icon('clipboard')}</button></div>`;
  let open='';try{const url=new URL(field.value);if(['https:','http:'].includes(url.protocol))open=`<a class="vault-open" href="${e(url.href)}" target="_blank" rel="noopener noreferrer" aria-label="Открыть ${e(field.label)}">${icon('external')}</a>`;}catch{}
  return `${copyValue(field.value,field.label,e,icon)}${open}`;
}
function record(item){return `<details class="vault-record" aria-label="Запись ${e(item.title)}"><summary class="vault-record-heading"><span class="category-icon purple">${icon('lock')}</span><div><h2>${e(item.title)}</h2><span>${item.fields.length} ${item.fields.length===1?'поле':item.fields.length<5?'поля':'полей'}</span></div><div class="vault-record-tools">${button('edit',icon('edit'),`data-id="${e(item.id)}" aria-label="Изменить ${e(item.title)}"`,'icon-btn')}${button('delete',icon('trash'),`data-id="${e(item.id)}" aria-label="Удалить ${e(item.title)}"`,'icon-btn')}</div></summary><div class="vault-record-content">${item.notes?`<p class="vault-record-note">${e(item.notes)}</p>`:''}<dl class="vault-fields">${item.fields.map(field=>`<div><dt>${e(field.label)}</dt><dd>${fieldValue(item,field)}</dd></div>`).join('')}</dl></div></details>`;}
function render(){
  hideRevealed();$('#main-content').innerHTML=`${ui.titleRow('Хранилище','Записи, ссылки и доступы команды.',false)}<div class="vault-toolbar"><label class="search-field">${icon('search')}<input id="vault-search" type="search" value="${e(query)}" placeholder="Найти запись" aria-label="Поиск по хранилищу"></label>${button('add',`${icon('plus')}Добавить запись`)}${state.vaultTrash.length?button('restore',`${icon('undo')}Вернуть удалённую`):''}</div><div class="notice vault-notice">${icon('shield')}Скрытые поля открываются только по нажатию.</div><div id="vault-records" class="vault-records"></div>${ui.footer()}`;
  $('#vault-search').addEventListener('input',event=>{query=event.target.value;renderRecords();});renderRecords();
}
function renderRecords(){hideRevealed();const items=searchVault(state.vault,query).sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));$('#vault-records').innerHTML=items.length?items.map(record).join(''):`<div class="empty"><h2>${query?'Ничего не найдено':'Здесь будут ваши записи'}</h2><p>Нажмите «Добавить запись», чтобы сохранить ссылку, путь или доступ.</p></div>`;document.querySelectorAll('.vault-record').forEach(record=>record.addEventListener('toggle',()=>{if(!record.open)hideRevealed();}));}
function readFields(){return [...document.querySelectorAll('.vault-field-editor')].map(row=>({id:row.dataset.fieldId,label:row.querySelector('[data-field-label]').value.trim(),value:row.querySelector('[data-field-value]').value,secret:row.querySelector('[data-field-secret]').checked}));}
function fieldsMarkup(){return formFields.map((field,index)=>`<section class="vault-field-editor" data-field-id="${field.id}"><div class="vault-field-editor-head"><strong>Поле ${index+1}</strong>${button('remove-field',icon('trash'),`data-field="${field.id}" aria-label="Убрать поле ${index+1}"`,'icon-btn')}</div><div class="field"><label for="vault-label-${field.id}">Подпись</label><input id="vault-label-${field.id}" data-field-label value="${e(field.label)}" maxlength="80" required placeholder="Например: URL, путь к папке, логин"></div><div class="field"><label for="vault-value-${field.id}">Значение</label>${field.secret?`<input type="password" id="vault-value-${field.id}" data-field-value maxlength="4000" autocomplete="off">`:`<textarea id="vault-value-${field.id}" data-field-value rows="2" maxlength="4000">${e(field.value)}</textarea>`}</div><label class="layout-checkbox"><input data-field-secret type="checkbox" ${field.secret?'checked':''}><span>Скрывать значение до нажатия кнопки</span></label></section>`).join('');}
function renderFormFields(){
  $('#vault-form-fields').innerHTML=fieldsMarkup();
  for(const field of formFields)if(field.secret)document.querySelector(`[data-field-id="${field.id}"] [data-field-value]`).value=field.value;
  document.querySelectorAll('[data-field-secret]').forEach(el=>el.addEventListener('change',()=>{formFields=readFields();renderFormFields();}));
}
function editRecord(id){
  hideRevealed();const item=state.vault.find(item=>item.id===id);editingId=item?.id||crypto.randomUUID();formFields=item?structuredClone(item.fields):[{id:crypto.randomUUID(),label:'',value:'',secret:false}];
  ui.showModal(item?'Изменить запись':'Новая запись',`<form id="vault-record-form"><div class="field"><label for="vault-title">Название записи</label><input id="vault-title" value="${e(item?.title)}" maxlength="120" required placeholder="Например: общая папка отдела"></div><div class="field"><label for="vault-note">Описание</label><textarea id="vault-note" rows="2" maxlength="2000">${e(item?.notes)}</textarea></div><div id="vault-form-fields"></div>${button('add-field',`${icon('plus')}Добавить поле`,'','btn vault-add-field')}<div id="vault-form-error" role="alert"></div><div class="modal-footer">${button('cancel','Отмена')}<button type="submit" class="btn btn-primary">${icon('check')}Сохранить запись</button></div></form>`,true);renderFormFields();
  $('#vault-record-form').addEventListener('submit',async event=>{event.preventDefault();const submit=event.target.querySelector('[type=submit]');submit.disabled=true;try{const title=$('#vault-title').value.trim(),notes=$('#vault-note').value.trim(),fields=readFields();if(!title||!fields.length||fields.some(field=>!field.label||!field.value.trim()))throw new Error('Укажите название записи и заполните подпись и значение каждого поля.');const record={id:editingId,title,notes,fields,updatedAt:new Date().toISOString()};await update(s=>saveVaultRecord(s,record));ui.closeModal();query='';render();ui.toast('Запись сохранена');}catch(error){$('#vault-form-error').className='form-error';$('#vault-form-error').textContent=error.message;}finally{if(submit.isConnected)submit.disabled=false;}});
}
function reveal(id,fieldId,button){const key=id+':'+fieldId,wasOpen=revealTimers.has(key);hideRevealed();if(wasOpen)return;const value=resolveVaultValue(id,fieldId);if(value===undefined)return;const target=document.querySelector(`[data-vault-secret="${key}"]`);if(target){target.textContent=value;button.setAttribute('aria-pressed','true');button.innerHTML=icon('lock');revealTimers.set(key,setTimeout(hideRevealed,20000));}}
document.addEventListener('click',event=>{if(!active)return;const el=event.target.closest('[data-vault]');if(!el)return;event.preventDefault();event.stopImmediatePropagation();(async()=>{switch(el.dataset.vault){
  case 'add':editRecord();break;
  case 'edit':editRecord(el.dataset.id);break;
  case 'cancel':ui.closeModal();break;
  case 'add-field':formFields=readFields();if(formFields.length>=20){ui.toast('В одной записи можно добавить до 20 полей');break;}formFields.push({id:crypto.randomUUID(),label:'',value:'',secret:false});renderFormFields();break;
  case 'remove-field':formFields=readFields().filter(field=>field.id!==el.dataset.field);renderFormFields();break;
  case 'reveal':reveal(el.dataset.id,el.dataset.field,el);break;
  case 'delete':await update(s=>deleteVaultRecord(s,el.dataset.id));render();ui.toast('Запись удалена. Её можно вернуть кнопкой «Вернуть удалённую».');break;
  case 'restore':await update(restoreVaultRecord);query='';render();ui.toast('Запись восстановлена');break;
}})().catch(error=>ui.toast(error.message));});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')hideRevealed();});
window.addEventListener('blur',hideRevealed);
