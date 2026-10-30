import {readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const files=['server.mjs','auth.mjs','build.mjs',...(await readdir('dist')).filter(f=>f.endsWith('.js')&&!['editor.js','map-3d.js'].includes(f)).map(f=>'dist/'+f),...(await readdir('src')).filter(f=>f.endsWith('.js')).map(f=>'src/'+f)];
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});if(result.status)process.exit(result.status);}
console.log(`${files.length} JavaScript files checked.`);
