import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

export function createEditor({element,toolbar,content,onChange,onLink,onError,onImageState,icon}){
  let editor;
  const controls=[['bold','<b>B</b>','Полужирный · Ctrl B'],['italic','<i>I</i>','Курсив · Ctrl I'],['underline','<u>U</u>','Подчёркнутый · Ctrl U'],['strike','<s>S</s>','Зачёркнутый'],['sep'],['bulletList',icon('list'),'Маркированный список'],['orderedList',icon('ordered'),'Нумерованный список'],['taskList',icon('task'),'Чек-лист'],['blockquote',icon('quote'),'Цитата'],['sep'],['link',icon('link'),'Вставить ссылку · Ctrl K'],['image',icon('image'),'Вставить изображение'],['codeBlock',icon('code'),'Блок кода'],['code','<span style="font-family:monospace;font-size:12px">&lt;/&gt;</span>','Код в строке'],['table',icon('table'),'Вставить таблицу'],['horizontalRule','―','Разделитель'],['sep'],['undo',icon('undo'),'Отменить · Ctrl Z'],['redo',icon('redo'),'Повторить · Ctrl Shift Z']];
  toolbar.innerHTML=`<select aria-label="Стиль текста" id="text-style"><option value="p">Обычный текст</option><option value="h2">Заголовок 2</option><option value="h3">Заголовок 3</option></select><span class="separator"></span>${controls.map(([cmd,html,label])=>cmd==='sep'?'<span class="separator"></span>':`<button type="button" data-editor-command="${cmd}" title="${label}" aria-label="${label}" aria-pressed="false">${html}</button>`).join('')}<input id="editor-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>`;
  const upload=async files=>{
    const images=[...files].filter(f=>/^image\/(png|jpeg|webp|gif)$/.test(f.type));
    if(!images.length){onError('Выберите изображение PNG, JPEG, WebP или GIF.');return;}
    onImageState(1);
    try{
      for(const file of images){
        if(file.size>12*1024*1024)throw new Error('Изображение больше 12 МБ. Выберите файл поменьше.');
        const src=await imageData(file);
        if(editor.isDestroyed)return;
        editor.chain().focus().setImage({src,alt:file.name.replace(/\.[^.]+$/,'')}).run();
      }
    }catch(e){onError(e.message||'Не получилось вставить изображение.');}
    finally{onImageState(-1);}
  };
  editor=new Editor({
    element,content,
    extensions:[StarterKit.configure({heading:{levels:[2,3]},link:{openOnClick:false,autolink:true,defaultProtocol:'https',protocols:['http','https','mailto','tel']}}),Image.configure({allowBase64:true}),Placeholder.configure({placeholder:'Начните писать инструкцию…\nВставьте скриншот из буфера или перетащите картинку сюда.'}),TableKit.configure({table:{resizable:true}}),TaskList,TaskItem.configure({nested:true})],
    editorProps:{
      attributes:{class:'prose',role:'textbox','aria-label':'Содержание инструкции','aria-multiline':'true'},
      transformPastedHTML:html=>html.replace(/<img\b[^>]*>/gi,tag=>/src=["']data:image\/(png|jpeg|webp|gif);base64,/i.test(tag)?tag:''),
      handlePaste:(view,event)=>{const files=[...(event.clipboardData?.files||[])];if(files.some(f=>f.type.startsWith('image/'))){event.preventDefault();upload(files);return true;}return false;},
      handleDrop:(view,event,moved)=>{if(moved)return false;const files=[...(event.dataTransfer?.files||[])];if(files.some(f=>f.type.startsWith('image/'))){event.preventDefault();const pos=view.posAtCoords({left:event.clientX,top:event.clientY});if(pos)editor.commands.setTextSelection(pos.pos);upload(files);return true;}return false;},
      handleKeyDown:(view,event)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();event.stopPropagation();onLink(editor);return true;}return false;}
    },
    onUpdate:()=>{refresh();onChange();},onSelectionUpdate:()=>refresh(),
  });
  function refresh(){
    toolbar.querySelectorAll('[data-editor-command]').forEach(b=>{const cmd=b.dataset.editorCommand;const active=editor.isActive(cmd);b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));if(cmd==='undo')b.disabled=!editor.can().undo();if(cmd==='redo')b.disabled=!editor.can().redo();});
    toolbar.querySelector('#text-style').value=editor.isActive('heading',{level:2})?'h2':editor.isActive('heading',{level:3})?'h3':'p';
    document.querySelector('#table-actions')?.classList.toggle('hidden',!editor.isActive('table'));
    const code=document.querySelector('#code-actions');code?.classList.toggle('hidden',!editor.isActive('codeBlock'));
  }
  toolbar.addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault();});
  toolbar.addEventListener('click',e=>{const b=e.target.closest('[data-editor-command]');if(!b)return;const cmd=b.dataset.editorCommand;const chain=editor.chain().focus();const commands={bold:()=>chain.toggleBold().run(),italic:()=>chain.toggleItalic().run(),underline:()=>chain.toggleUnderline().run(),strike:()=>chain.toggleStrike().run(),bulletList:()=>chain.toggleBulletList().run(),orderedList:()=>chain.toggleOrderedList().run(),taskList:()=>chain.toggleTaskList().run(),blockquote:()=>chain.toggleBlockquote().run(),codeBlock:()=>chain.toggleCodeBlock().run(),code:()=>chain.toggleCode().run(),horizontalRule:()=>chain.setHorizontalRule().run(),undo:()=>chain.undo().run(),redo:()=>chain.redo().run(),table:()=>chain.insertTable({rows:3,cols:3,withHeaderRow:true}).run(),image:()=>toolbar.querySelector('#editor-image-input').click(),link:()=>onLink(editor)};commands[cmd]?.();refresh();});
  toolbar.querySelector('#text-style').addEventListener('change',e=>{const v=e.target.value;v==='p'?editor.chain().focus().setParagraph().run():editor.chain().focus().setHeading({level:Number(v[1])}).run();});
  toolbar.querySelector('#editor-image-input').addEventListener('change',e=>{upload(e.target.files);e.target.value='';});
  document.querySelector('#table-actions')?.addEventListener('click',e=>{const cmd=e.target.closest('[data-table-command]')?.dataset.tableCommand;if(cmd&&['addRowAfter','addColumnAfter','deleteRow','deleteColumn','deleteTable'].includes(cmd))editor.chain().focus()[cmd]().run();});
  element.addEventListener('dragover',e=>{if([...e.dataTransfer?.types||[]].includes('Files'))element.classList.add('drop-target');});
  element.addEventListener('dragleave',()=>element.classList.remove('drop-target'));
  element.addEventListener('drop',()=>element.classList.remove('drop-target'));
  refresh();
  return editor;
}

async function imageData(file){
  const raw=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Не удалось прочитать файл.'));r.readAsDataURL(file);});
  if(file.type==='image/gif'&&file.size<3*1024*1024)return raw;
  const image=await new Promise((resolve,reject)=>{const img=new window.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Формат изображения не поддерживается.'));img.src=raw;});
  const ratio=Math.min(1,1800/Math.max(image.width,image.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/webp',.92);
}
