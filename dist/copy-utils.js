export function copyValue(value,label,escape,icon,compact=false){if(!value)return '<span>Не указано</span>';return `<button type="button" class="copy-value ${compact?'compact':''}" data-copy-value="${escape(value)}" aria-label="Скопировать ${escape(label)}" title="Скопировать одним кликом">${compact?'':`<span>${escape(value)}</span>`}${icon('clipboard')}</button>`;}
export async function writeClipboard(value){
  if(value===undefined||value===null||value==='')throw new Error('Нет данных для копирования.');
  const text=String(value);
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return;}}catch{}
  const input=document.createElement('textarea'),previous=document.activeElement;input.value=text;input.setAttribute('readonly','');input.style.cssText='position:fixed;left:-10000px;top:0;opacity:0';document.body.append(input);input.select();const success=document.execCommand('copy');input.remove();previous?.focus?.({preventScroll:true});if(!success)throw new Error('Не удалось скопировать. Проверьте разрешение на буфер обмена.');
}
export function installCopying({toast,resolveSecret,resolveVault}){
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-copy-value],[data-copy-code],[data-copy-secret-id],[data-copy-vault-item]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const code=button.closest('pre')?.querySelector('code');
    const value=button.hasAttribute('data-copy-vault-item')?resolveVault(button.dataset.copyVaultItem,button.dataset.copyVaultField):button.hasAttribute('data-copy-secret-id')?resolveSecret(button.dataset.copySecretId):button.hasAttribute('data-copy-code')?code?.textContent:button.dataset.copyValue;
    writeClipboard(value).then(()=>{button.dataset.copied='true';toast('Скопировано');setTimeout(()=>{if(button.isConnected)delete button.dataset.copied;},1800);}).catch(error=>toast(error.message));
  },true);
  const enhance=()=>document.querySelectorAll('.prose pre').forEach(pre=>{if(pre.closest('[contenteditable=true]')||pre.querySelector('[data-copy-code]')||!pre.querySelector('code'))return;const button=document.createElement('button');button.type='button';button.className='copy-code';button.dataset.copyCode='';button.textContent='Копировать';button.setAttribute('aria-label','Скопировать блок кода');pre.append(button);});
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
}
