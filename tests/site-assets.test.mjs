import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

test('published HTML uses fingerprinted CSS and a bundled, fingerprinted module graph',async()=>{
  const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
  assert.match(html,/<script type="module" src="\/assets\/app-[A-Z0-9]+\.js"><\/script>/);
  assert.ok(!html.includes('src="/app.js"'));
  const links=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];assert.ok(links.length>=10);
  for(const[,asset]of links){const match=asset.match(/^\/assets\/([a-z-]+)-([a-f0-9]{12})\.css$/);assert.ok(match,asset);const output=await readFile(new URL('../dist'+asset,import.meta.url)),source=await readFile(new URL('../dist/'+match[1]+'.css',import.meta.url));assert.deepEqual(output,source);assert.equal(createHash('sha256').update(output).digest('hex').slice(0,12),match[2]);}
  const entry=html.match(/<script type="module" src="([^"]+)"/)[1],code=await readFile(new URL('../dist'+entry,import.meta.url),'utf8');assert.ok(!code.includes('from"./appearance.js"'));assert.ok(!code.includes('from"./store.js"'));
});
