import { build } from 'esbuild';
import { mkdir,copyFile,readdir } from 'node:fs/promises';
await build({entryPoints:['src/editor.js'],bundle:true,format:'esm',minify:true,outfile:'dist/editor.js',target:['es2022'],legalComments:'none'});
await build({entryPoints:['src/map-3d.js'],bundle:true,format:'esm',minify:true,outfile:'dist/map-3d.js',target:['es2022'],legalComments:'none'});
await mkdir('dist/fonts',{recursive:true});
for(const filename of await readdir('node_modules/@fontsource-variable/golos-text/files')){
  if(filename.endsWith('.woff2'))await copyFile('node_modules/@fontsource-variable/golos-text/files/'+filename,'dist/fonts/'+filename);
}
await copyFile('node_modules/@fontsource-variable/golos-text/LICENSE','dist/fonts/LICENSE.txt');
await copyFile('node_modules/three/LICENSE','dist/THREE-LICENSE.txt');
console.log('Editor bundle ready. Static application: dist/');
