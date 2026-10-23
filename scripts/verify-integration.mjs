import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {chromium} from 'playwright-core';
import {initialArticles,initialUsers,people} from '../dist/data.js';
import {createOffice} from '../dist/office-model.js';

// Each run creates and removes only its own uniquely named temporary database.
const connection=process.env.COMPASS_DATABASE_URL||process.env.DATABASE_URL;
if(!connection)throw new Error('Configure a PostgreSQL connection for verification.');
const database='compass_verify_'+randomBytes(8).toString('hex'),admin=new Pool({connectionString:connection}),url=new URL(connection);url.pathname='/'+database;
const port=Number(process.env.COMPASS_VERIFY_PORT||4187),origin=`http://127.0.0.1:${port}`,password=randomBytes(20).toString('hex'),testSecret=randomBytes(32).toString('hex'),authorization='Basic '+Buffer.from('verify:'+password).toString('base64');
let child,browser,created=false,logs='';
const request=(route,options={})=>fetch(origin+route,{...options,headers:{authorization,...options.headers}});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function start(){child=spawn(process.execPath,['server.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,NODE_ENV:'production',COMPASS_DATABASE_URL:url.toString(),PORT:String(port),HOST:'127.0.0.1',COMPASS_PUBLIC_URL:origin,COMPASS_SECRET:testSecret,COMPASS_AUTH_USER:'verify',COMPASS_AUTH_PASSWORD:password},stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);for(let i=0;i<80;i++){if(child.exitCode!==null)throw new Error('Server stopped: '+logs);try{if((await request('/api/health')).ok)return;}catch{}await pause(150);}throw new Error('Server readiness timeout: '+logs);}
async function stop(){if(child&&child.exitCode===null){child.kill('SIGTERM');await once(child,'exit');}child=null;}
try{
  await admin.query(`CREATE DATABASE "${database}"`);created=true;await start();
  assert.equal((await fetch(origin+'/api/state')).status,401);
  assert.equal((await request('/api/state')).status,404);
  const seed={articles:structuredClone(initialArticles),users:structuredClone(initialUsers),people:structuredClone(people),office:createOffice(people),settings:{},links:[],favorites:[],drafts:{},vault:[],vaultTrash:[],demoCredentials:{}};
  const put=(state,revision,extra={})=>request('/api/state',{method:'PUT',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify({state,revision})});
  const showcase=seed.office.floors[1];showcase.height=850;for(const [index,kind]of ['door','window','cabinet','plant','sofa','marker'].entries()){const sizes={door:[80,80],window:[110,16],cabinet:[85,60],plant:[48,48],sofa:[130,65],marker:[75,54]}[kind];showcase.objects.push({id:'showcase-'+kind,kind,name:kind==='marker'?'Вход в корпус':kind,roomId:'',x:40+index*155,y:660,width:sizes[0],height:sizes[1],rotation:0,color:'violet'});}
  assert.equal((await put(seed,0)).status,200);
  assert.equal((await put(seed,0)).status,409);
  assert.equal((await put(seed,1,{Origin:'https://invalid.example'})).status,403);
  seed.links.push({id:'persist-test',title:'Saved in PostgreSQL',url:'https://example.test'});
  assert.equal((await put(seed,1)).status,200);
  assert.equal((await request('/api/ai/settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'custom',baseUrl:'https://example.test/v1',model:'test',apiKey:'verification-key-only'})})).status,200);
  const dbCheck=new Pool({connectionString:url.toString()});try{const encrypted=await dbCheck.query('SELECT api_key_cipher FROM compass_ai_settings');assert.ok(!encrypted.rows[0].api_key_cipher.includes('verification-key-only'));}finally{await dbCheck.end();}
  await stop();await start();assert.equal((await (await request('/api/ai/settings')).json()).configured,true);
  assert.equal((await (await request('/api/state')).json()).state.links[0].id,'persist-test');
  console.log('PostgreSQL: authentication, schema, read/write, conflicts, origin check and restart persistence passed.');
  browser=await chromium.launch({executablePath:process.env.COMPASS_CHROMIUM||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const context=await browser.newContext({viewport:{width:1440,height:1000},httpCredentials:{username:'verify',password},deviceScaleFactor:1});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/#/map');await page.locator('.webgl-ready').waitFor({timeout:20000});
  await page.getByRole('button',{name:'Редактировать',exact:true}).click();await page.locator('.webgl-ready').waitFor();
  const viewport=await page.locator('#office-viewport').boundingBox(),dock=await page.locator('.office-map-bottom').boundingBox(),inspector=await page.locator('#office-detail').boundingBox();
  assert.ok(viewport.height>300);assert.ok(dock.y+dock.height<=1001,'dock fits the viewport');assert.ok(inspector.y+inspector.height<=1001,'inspector fits the viewport');
  assert.equal(await page.locator('.office-seat-number,.seat-coordinate,.office-room-type').count(),0);
  await page.screenshot({path:'/tmp/compass-map-desktop.png',fullPage:true});
  const map=page.locator('#office-svg');const before=await map.getAttribute('viewBox');await page.mouse.move(viewport.x+viewport.width/2,viewport.y+viewport.height/2);await page.keyboard.down('Space');await page.mouse.down();await page.mouse.move(viewport.x+viewport.width/2+30,viewport.y+viewport.height/2+10,{steps:4});await page.mouse.move(viewport.x+viewport.width/2+60,viewport.y+viewport.height/2+20,{steps:4});await page.mouse.up();await page.keyboard.up('Space');assert.notEqual(await map.getAttribute('viewBox'),before);
  await page.getByRole('button',{name:'Вписать план'}).click();
  await page.screenshot({path:'/tmp/compass-map-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Место',exact:true}).click();
  await page.locator('#seat-person').locator('..').getByRole('button').click();await page.getByRole('option',{name:'＋ Добавить нового сотрудника',exact:true}).click();
  await page.locator('#new-seat-name').fill('Иван Проверкин');await page.locator('#new-seat-department').fill('Тестовый отдел');
  // An existing free position makes the workflow deterministic without resizing production data.
  await page.locator('#seat-room').selectOption(seed.office.floors[0].rooms[1].id,{force:true});
  await page.getByRole('button',{name:'Добавить место',exact:true}).click();await page.locator('#layout-seat-form').waitFor({state:'detached'});
  const saved=(await (await request('/api/state')).json()).state,newPerson=saved.people.find(p=>p.name==='Иван Проверкин');assert.ok(newPerson);assert.ok(saved.office.floors[0].seats.some(s=>s.personId===newPerson.id));
  await page.locator('.dock-menu').filter({has:page.locator('summary',{hasText:'План'})}).locator('summary').click();await page.getByRole('button',{name:'Добавить корпус',exact:true}).click();await page.locator('#building-name').fill('Южный корпус');await page.getByRole('button',{name:'Создать план',exact:true}).click();await page.locator('#layout-building-form').waitFor({state:'detached'});assert.ok((await (await request('/api/state')).json()).state.office.buildings.some(b=>b.name==='Южный корпус'));
  await page.goto(origin+'/#/settings');await page.locator('#appearance-form').waitFor();await page.locator('#appearance-accent').fill('#000000');await page.locator('#appearance-form').getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForTimeout(250);const accent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent'));assert.notEqual(accent.trim(),'#000000');
  await page.locator('#appearance-reset').click();await page.waitForTimeout(200);
  await page.evaluate(()=>window.scrollTo(0,0));await page.mouse.move(1100,500);await page.mouse.wheel(0,200);await page.waitForTimeout(35);const midway=await page.evaluate(()=>scrollY);await page.waitForTimeout(400);const ended=await page.evaluate(()=>scrollY);assert.ok(ended>midway,'mouse wheel continues scrolling smoothly');await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'/tmp/compass-settings.png',fullPage:true});
  await page.goto(origin+'/#/people');await page.locator('.people-grid').waitFor();const person=saved.people[0];
  // Release one employee in the isolated database, then exercise the full map assignment pipeline.
  const snapshot=await (await request('/api/state')).json();for(const f of snapshot.state.office.floors)for(const s of f.seats)if(s.personId===person.id)s.personId='';assert.equal((await put(snapshot.state,snapshot.revision)).status,200);
  await page.reload();await page.getByRole('link',{name:'Добавить на карту'}).first().click();await page.locator('#assign-person-form').waitFor();await page.getByRole('button',{name:'Добавить на карту',exact:true}).click();await page.locator('#assign-person-form').waitFor({state:'detached'});
  await page.setViewportSize({width:2560,height:1440});await page.goto(origin+'/#/map');await page.locator('.webgl-ready').waitFor();await page.screenshot({path:'/tmp/compass-map-2k.png',fullPage:true});await page.locator('#office-floor').selectOption('floor-4',{force:true});await page.locator('.webgl-ready').waitFor();await page.screenshot({path:'/tmp/compass-models-2k.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:'/tmp/compass-map-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('Browser: WebGL, bounded map/dock/inspector, drag, custom selects, inline employee, multiple buildings, assignment, theme and mobile layout passed.');
}finally{await browser?.close();await stop();if(created)await admin.query(`DROP DATABASE "${database}" WITH (FORCE)`);await admin.end();console.log('Temporary verification database removed; existing databases were not changed.');}
