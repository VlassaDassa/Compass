import test from 'node:test';
import assert from 'node:assert/strict';
import {articleViews,incrementArticleView} from '../dist/article-views.js';

test('published article openings increment without affecting other articles',()=>{const state={articles:[{id:'a',status:'published',views:2},{id:'b',status:'published',views:9},{id:'draft',status:'draft'}]};assert.equal(incrementArticleView(state,'a'),true);assert.equal(incrementArticleView(state,'a'),true);assert.equal(state.articles[0].views,4);assert.equal(state.articles[1].views,9);assert.equal(incrementArticleView(state,'draft'),false);assert.equal(incrementArticleView(state,'missing'),false);});
test('invalid, negative and old counts are normalized safely',()=>{for(const value of [undefined,-1,'bad',1.5])assert.equal(articleViews({views:value}),0);const state={articles:[{id:'a',status:'published',views:-1}]};incrementArticleView(state,'a');assert.equal(state.articles[0].views,1);assert.equal(articleViews({views:0}),0);});
