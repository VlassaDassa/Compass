import test from 'node:test';
import assert from 'node:assert/strict';
import {createOffice,upgradeOffice,saveRoom,saveObject,moveObject,objectSize,deleteMapEntity,resizeFloor} from '../dist/office-model.js';

const blank=()=>({id:'f',width:1000,height:800,rooms:[{id:'r',name:'Любое название',x:40,y:40,width:480,height:440,color:'coral'}],seats:[],objects:[]});
const item=(values={})=>({id:'o',roomId:'r',kind:'window',name:'Окно у входа',x:100,y:0,width:110,height:16,rotation:0,color:'blue',...values});
test('old maps upgrade once without losing seats, coordinates or equipment',()=>{
  const office=createOffice([{id:'p',floor:3,desk:'3.01',name:'Демо',pc:'PC-DEMO'}]);
  const seats=structuredClone(office.floors[0].seats);office.version=1;office.floors.forEach(f=>f.objects=[]);
  upgradeOffice(office);assert.deepEqual(office.floors[0].seats,seats);assert.equal(office.version,2);
  const upgraded=structuredClone(office);upgradeOffice(office);assert.deepEqual(office,upgraded);
  assert.ok(office.floors[0].objects.some(o=>o.kind==='table'));assert.ok(office.floors[0].objects.some(o=>o.kind==='printer'));
});
test('a zone accepts a free name and colour without a room type',()=>{
  const f=blank();saveRoom(f,{id:'custom',name:'Лаборатория / приёмка',color:'violet',x:600,y:40,width:300,height:300});
  assert.equal(f.rooms[1].name,'Лаборатория / приёмка');assert.equal(f.rooms[1].type,undefined);
});
test('corridor rectangles can join and overlap to form a continuous passage',()=>{
  const f=blank();saveRoom(f,{id:'h',name:'Проход',open:true,x:400,y:400,width:500,height:120});
  saveRoom(f,{id:'v',name:'Поворот',open:true,x:800,y:400,width:100,height:300});assert.equal(f.rooms.length,3);
});
test('windows can sit on the boundary and move with snapping',()=>{
  const f=blank();saveObject(f,item());moveObject(f,'o',126,-50);assert.equal(f.objects[0].x,130);assert.equal(f.objects[0].y,0);
});
test('rotation swaps the object footprint and prevents clipping',()=>{
  const f=blank();const o=item({width:110,height:16,rotation:90,x:460,y:200});assert.deepEqual(objectSize(o),{width:16,height:110});saveObject(f,o);
  assert.throws(()=>saveObject(f,{...o,x:470}),/границы/);assert.equal(f.objects[0].x,460);
});
test('printer data and a custom note survive repositioning',()=>{
  const f=blank();saveObject(f,item({kind:'printer',name:'МФУ коридора',width:76,height:70,x:100,y:100,ip:'192.0.2.14',model:'Demo model',notes:'Демо'}));
  const before=structuredClone(f.objects[0]);moveObject(f,'o',150,160);assert.deepEqual({...f.objects[0],x:before.x,y:before.y},before);
});
test('objects may be placed in a corridor or directly on the plan',()=>{
  const f=blank();f.rooms[0].open=true;saveObject(f,item({kind:'door',width:80,height:80,y:350}));saveObject(f,item({id:'root',roomId:'',x:700,y:500}));assert.equal(f.objects.length,2);
});
test('shrinking a zone cannot hide its objects',()=>{
  const f=blank();saveObject(f,item({x:350,y:200}));assert.throws(()=>saveRoom(f,{...f.rooms[0],width:400}),/не помещаются объекты/);assert.equal(f.rooms[0].width,480);
});
test('shrinking the plan checks objects outside zones too',()=>{
  const f=blank();saveObject(f,item({roomId:'',x:850,y:600}));assert.throws(()=>resizeFloor(f,900,800),/не помещаются/);assert.equal(f.width,1000);
});
test('deleting a zone removes only its contents and can be restored from a snapshot',()=>{
  const f=blank();f.seats.push({id:'seat',roomId:'r',personId:'person',pc:'PC'});saveObject(f,item());saveObject(f,item({id:'root',roomId:'',x:700,y:500}));const before=structuredClone(f);
  deleteMapEntity(f,'room','r');assert.equal(f.rooms.length,0);assert.equal(f.seats.length,0);assert.deepEqual(f.objects.map(o=>o.id),['root']);
  Object.assign(f,before);assert.equal(f.seats[0].personId,'person');assert.equal(f.objects.length,2);
});
test('deleting one object leaves its zone and other equipment intact',()=>{
  const f=blank();saveObject(f,item());deleteMapEntity(f,'object','o');assert.equal(f.objects.length,0);assert.equal(f.rooms.length,1);
});
test('invalid coordinates and IP do not mutate saved objects',()=>{
  const f=blank();saveObject(f,item());const before=structuredClone(f);
  assert.throws(()=>saveObject(f,item({x:NaN})),/Размер/);assert.throws(()=>saveObject(f,item({ip:'300.1.1.1'})),/IP/);assert.deepEqual(f,before);
});
