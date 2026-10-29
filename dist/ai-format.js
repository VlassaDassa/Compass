const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function inline(value){
  return escape(value).replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/gi,(_,label,url)=>`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`).replace(/`([^`\n]+)`/g,'<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>').replace(/(^|\s)\*([^*\n]+)\*(?=\s|[.,!?;:]|$)/g,'$1<em>$2</em>');
}
// Only our own HTML tags are emitted; model-supplied HTML is always escaped.
export function formatAiMarkdown(value){
  const lines=String(value||'').replace(/\r/g,'').split('\n');let list='',code=false,codeLines=[],paragraph=[],out=[];
  const closeParagraph=()=>{if(paragraph.length){out.push('<p>'+paragraph.map(inline).join('<br>')+'</p>');paragraph=[];}};
  const closeList=()=>{if(list){out.push('</'+list+'>');list='';}};
  for(const line of lines){const trimmed=line.trim();if(/^```/.test(trimmed)){closeParagraph();closeList();if(code){out.push('<pre><code>'+escape(codeLines.join('\n'))+'</code></pre>');codeLines=[];code=false;}else code=true;continue;}if(code){codeLines.push(line);continue;}if(!trimmed){closeParagraph();closeList();continue;}const heading=trimmed.match(/^#{1,6}\s+(.+)$/),item=trimmed.match(/^([-*+]|\d+[.)])\s+(.+)$/);if(heading){closeParagraph();closeList();out.push('<h3>'+inline(heading[1])+'</h3>');}else if(item){closeParagraph();const kind=/^\d/.test(item[1])?'ol':'ul';if(list!==kind){closeList();list=kind;out.push('<'+list+'>');}out.push('<li>'+inline(item[2])+'</li>');}else{closeList();paragraph.push(line);}}
  closeParagraph();closeList();if(code)out.push('<pre><code>'+escape(codeLines.join('\n'))+'</code></pre>');return out.join('');
}
