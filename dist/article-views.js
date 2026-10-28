// Counts openings, not unique visitors. Invalid or old values start at zero.
export function articleViews(article){const count=Number(article?.views);return Number.isSafeInteger(count)&&count>=0?count:0;}
export function incrementArticleView(state,id){const article=state.articles.find(item=>item.id===id&&item.status==='published');if(!article)return false;article.views=Math.min(Number.MAX_SAFE_INTEGER,articleViews(article)+1);return true;}
