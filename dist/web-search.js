const clean=value=>String(value||'').replace(/<[^>]*>/g,' ').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim();
export async function searchWeb(query,endpoint,fetcher=fetch){
 if(!endpoint)return{status:'disabled',sources:[]};
 try{const url=new URL(endpoint);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('invalid endpoint');url.pathname=url.pathname.replace(/\/$/,'')+'/search';url.search='';url.searchParams.set('q',String(query).slice(0,400));url.searchParams.set('format','json');url.searchParams.set('language','ru');
  const response=await fetcher(url,{signal:AbortSignal.timeout(8000),redirect:'error',headers:{Accept:'application/json'}});if(!response.ok)throw Error('search unavailable');const data=await response.json();if(!Array.isArray(data.results))throw Error('invalid search response');const sources=[];
  for(const result of data.results){if(sources.length===4)break;let link;try{link=new URL(result.url);if(!['http:','https:'].includes(link.protocol)||link.username||link.password)continue;}catch{continue;}const title=clean(result.title).slice(0,180),snippet=clean(result.content).slice(0,700);if(!title||!snippet)continue;sources.push({title,url:link.href,snippet});}return{status:sources.length?'found':'empty',sources};
 }catch{return{status:'failed',sources:[]};}
}
