// Long conversations are processed in order, so early diagnostic steps are not silently dropped.
export async function draftFromConversation(messages,request,progress=()=>{}){
 const history=messages.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.trim());
 if(!history.some(m=>m.role==='user'))throw new Error('В диалоге пока нет описания проблемы.');
 const total=history.reduce((sum,m)=>sum+m.content.length,0);
 if(history.length<=20&&total<=24000&&history.every(m=>m.content.length<=6000))return request(history,'article');
 const transcript=history.map(m=>`${m.role==='user'?'Пользователь':'Помощник'}: ${m.content}`).join('\n\n');const chunks=[];for(let i=0;i<transcript.length;i+=5000)chunks.push(transcript.slice(i,i+5000));
 let summary='';for(let i=0;i<chunks.length;i++){progress(i+1,chunks.length);const input=[];if(summary)input.push({role:'user',content:'Накопленные заметки из предыдущих частей:\n'+summary});input.push({role:'user',content:`Следующая часть диалога (${i+1}/${chunks.length}):\n${chunks[i]}`});const result=await request(input,'summary');summary=result.text;if(summary.length>5900)throw new Error('Резюме диалога слишком длинное. Попробуйте сократить диалог или подготовить статью по заметкам.');}
 progress(chunks.length,chunks.length);return request([{role:'user',content:'Подготовь инструкцию на основе всех частей диалога:\n'+summary}],'article');
}
