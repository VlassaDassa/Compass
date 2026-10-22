export function redactVault(records){return records.map(item=>({...item,fields:item.fields.map(field=>field.secret?{...field,value:'',redacted:true}:{...field})}));}
export function searchVault(records,query){const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean);return records.filter(item=>terms.every(term=>[item.title,item.notes,...item.fields.flatMap(field=>[field.label,field.secret?'':field.value])].join(' ').toLocaleLowerCase('ru').includes(term)));}
export function saveVaultRecord(state,record){
  if(!record.id||!record.title?.trim()||record.title.length>120||!Array.isArray(record.fields)||!record.fields.length||record.fields.length>20||record.fields.some(field=>!field.id||!field.label?.trim()||field.label.length>80||typeof field.value!=='string'||!field.value.trim()||field.value.length>4000)||new Set(record.fields.map(field=>field.id)).size!==record.fields.length)throw new Error('Заполните название записи, подписи и значения полей. В записи может быть до 20 полей.');
  const next=structuredClone(record),index=state.vault.findIndex(item=>item.id===record.id);next.title=next.title.trim();if(index<0)state.vault.push(next);else state.vault[index]=next;
}
export function deleteVaultRecord(state,id){const index=state.vault.findIndex(item=>item.id===id);if(index<0)return;state.vaultTrash.push(state.vault[index]);state.vault.splice(index,1);if(state.vaultTrash.length>20)state.vaultTrash.shift();}
export function restoreVaultRecord(state){const item=state.vaultTrash.pop();if(item&&!state.vault.some(record=>record.id===item.id))state.vault.push(item);}
