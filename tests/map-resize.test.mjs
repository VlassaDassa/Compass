import test from 'node:test';
import assert from 'node:assert/strict';
import {resizeLayout,validateLayoutResize} from '../dist/map-resize.js';
import {objectSize,seatSize} from '../dist/office-model.js';
import {sceneSvg} from '../dist/map-scene.js';

const plan=()=>({id:'f',width:1000,height:800,rooms:[{id:'r',name:'Комната',x:100,y:100,width:600,height:500}],seats:[{id:'s',roomId:'r',x:40,y:180,personId:'p',pc:'DEMO-PC'}],objects:[{id:'o',roomId:'r',kind:'table',name:'Стол',x:250,y:220,width:100,height:80,rotation:0}]});
for(const axis of ['n','ne','e','se','s','sw','w','nw'])test(`furniture can resize from the ${axis} boundary`,()=>{
  const f=plan(),before=structuredClone(f),result=validateLayoutResize(resizeLayout(f,'object','o',axis,axis.includes('w')?-20:20,axis.includes('n')?-20:20)),item=result.floor.objects[0];
  const scale=axis.includes('n')||axis.includes('s')?1.25:1.2;
  assert.equal(item.width,100*scale);assert.equal(item.height,80*scale);
  assert.equal(item.x,axis.includes('w')?350-item.width:250);assert.equal(item.y,axis.includes('n')?300-item.height:220);
  assert.ok(Math.abs(item.width/item.height-1.25)<.001);
  assert.deepEqual(f,before);
});
test('rotated furniture resizes in screen directions and keeps its opposite edge',()=>{
  const f=plan();f.objects[0].rotation=90;
  const result=validateLayoutResize(resizeLayout(f,'object','o','w',-40,0)),item=result.floor.objects[0];
  assert.deepEqual(objectSize(item),{width:120,height:150});assert.equal(item.rotation,90);assert.equal(item.x,210);assert.equal(item.x+objectSize(item).width,330);
});
test('resizing a room from the top-left preserves world positions of its contents',()=>{
  const f=plan(),result=validateLayoutResize(resizeLayout(f,'room','r','nw',-40,-30)),room=result.floor.rooms[0];
  assert.equal(room.x,60);assert.ok(Math.abs(room.y-66.67)<.001);assert.equal(room.width,640);assert.equal(room.height,533.33);
  for(const key of ['seats','objects'])assert.ok(Math.abs(room.x+result.floor[key][0].x-f.rooms[0].x-f[key][0].x)<.001&&Math.abs(room.y+result.floor[key][0].y-f.rooms[0].y-f[key][0].y)<.001);
});
test('all floor edges resize while a left/top extension preserves visual content positions',()=>{
  const f=plan();f.objects.push({...f.objects[0],id:'root',roomId:'',x:800,y:600});
  const result=validateLayoutResize(resizeLayout(f,'floor','f','nw',-50,-60));
  assert.deepEqual([result.floor.width,result.floor.height],[1075,860]);
  assert.deepEqual(result.origin,{x:-75,y:-60});
  assert.equal(result.floor.rooms[0].x+result.origin.x,f.rooms[0].x);
  assert.equal(result.floor.objects[1].y+result.origin.y,f.objects[1].y);
});
test('workplace sizes persist without losing assignments and equipment',()=>{
  const result=validateLayoutResize(resizeLayout(plan(),'seat','s','se',20,10)),seat=result.floor.seats[0];
  assert.deepEqual(seatSize(seat),{width:140,height:87.5});assert.equal(seat.personId,'p');assert.equal(seat.pc,'DEMO-PC');
});
test('resizing cannot overlap seats, clip equipment or shrink a floor over a room',()=>{
  const f=plan();f.seats.push({...f.seats[0],id:'s2',x:220});
  assert.throws(()=>validateLayoutResize(resizeLayout(f,'seat','s','e',80,0)),/другое рабочее место/);
  assert.throws(()=>validateLayoutResize(resizeLayout(plan(),'object','o','e',500,0)),/границы|не помещаются/);
  assert.throws(()=>validateLayoutResize(resizeLayout(plan(),'room','r','w',90,0)),/рабочие места/);
  assert.throws(()=>validateLayoutResize(resizeLayout(plan(),'floor','f','w',100,0)),/Координаты/);
  assert.throws(()=>validateLayoutResize(resizeLayout(plan(),'floor','f','e',-500,0)),/не помещаются/);
});
test('dragging through an opposite edge clamps the size and keeps it anchored',()=>{
  const result=resizeLayout(plan(),'object','o','nw',10000,10000),item=result.floor.objects[0];
  assert.equal(item.width,15);assert.equal(item.height,12);assert.equal(item.x+item.width,350);assert.equal(item.y+item.height,300);
});
test('all entity boundaries have continuous resize hit areas in edit mode only',()=>{
  const f=plan(),options={escape:x=>x,seatSvg:()=>''};
  const read=sceneSvg(f,{editing:false},options),edit=sceneSvg(f,{editing:true,objectId:'o'},options);
  assert.ok(!read.includes('data-resize-kind'));
  for(const kind of ['floor','room','object'])for(const axis of ['n','ne','e','se','s','sw','w','nw'])assert.ok(edit.includes(`data-resize-kind="${kind}" data-resize-id="${kind==='floor'?'f':kind==='room'?'r':'o'}" data-resize-axis="${axis}"`));
  assert.ok(edit.includes('map-wood'));assert.ok(edit.includes('furniture-art'));
});

test('room edges resize freely while room and canvas corners preserve their ratio',()=>{
  const f=plan(),edge=resizeLayout(f,'room','r','e',40,0),corner=resizeLayout(f,'room','r','se',40,30),canvas=resizeLayout(f,'floor','f','se',100,40);
  assert.equal(edge.floor.rooms[0].height,500);assert.equal(edge.floor.rooms[0].width,640);
  assert.ok(Math.abs(corner.width/corner.height-600/500)<.001);assert.ok(Math.abs(canvas.width/canvas.height-1000/800)<.001);
});
