import { build } from 'esbuild';
import { mkdir,copyFile,readdir,readFile,writeFile } from 'node:fs/promises';
import {createHash} from 'node:crypto';
await build({entryPoints:['src/editor.js'],bundle:true,format:'esm',minify:true,outfile:'dist/editor.js',target:['es2022'],legalComments:'none'});
await build({entryPoints:['src/map-3d.js'],bundle:true,format:'esm',minify:true,outfile:'dist/map-3d.js',target:['es2022'],legalComments:'none'});
await mkdir('dist/fonts',{recursive:true});
for(const filename of await readdir('node_modules/@fontsource-variable/golos-text/files')){
  if(filename.endsWith('.woff2'))await copyFile('node_modules/@fontsource-variable/golos-text/files/'+filename,'dist/fonts/'+filename);
}
await copyFile('node_modules/@fontsource-variable/golos-text/LICENSE','dist/fonts/LICENSE.txt');
await copyFile('node_modules/three/LICENSE','dist/THREE-LICENSE.txt');
// Content-address the complete browser module graph, not just the HTML URL.
// Keep prior assets available so already-open tabs can finish loading chunks.
const app=await build({entryPoints:['dist/app.js'],bundle:true,splitting:true,format:'esm',minify:true,outdir:'dist/assets',entryNames:'app-[hash]',chunkNames:'chunk-[hash]',target:['es2022'],legalComments:'none',metafile:true});
const entry=Object.entries(app.metafile.outputs).find(([,value])=>value.entryPoint==='dist/app.js')?.[0];
if(!entry)throw new Error('Browser entrypoint was not generated.');
let html=await readFile('dist/index.html','utf8');
const styles=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
for(const match of styles){const name=match[1].split('/').at(-1).split('?')[0].replace(/-[a-f0-9]{12}(?=\.css$)/,'');if(!/^[a-z-]+\.css$/.test(name))throw new Error('Unexpected stylesheet: '+name);const css=await readFile('dist/'+name),hash=createHash('sha256').update(css).digest('hex').slice(0,12),asset='assets/'+name.replace('.css','-'+hash+'.css');await writeFile('dist/'+asset,css);html=html.replace(match[0],'<link rel="stylesheet" href="/'+asset+'">');}
html=html.replace(/<script type="module" src="[^"]+"><\/script>/,'<script type="module" src="/'+entry.replace(/^dist\//,'')+'"></script>');
await writeFile('dist/index.html',html);
console.log('Editor, 3D map and fingerprinted browser assets ready. Static application: dist/');
