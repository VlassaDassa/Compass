import test from 'node:test';
import assert from 'node:assert/strict';
import {createOffice,seatSize,seatDimensions,validateSeatPosition} from '../dist/office-model.js';
import {copyMapEntity,pasteMapEntity,rotateMapEntity,deleteOfficeFloor} from '../dist/map-actions.js';
import {resizeLayout,validateLayoutResize} from '../dist/map-resize.js';
import {wallSegments,wallPath} from '../dist/map-walls.js';

test('workplaces rotate with their footprint, equipment and assignment intact',()=>{
  const f=createOffice([{id:'p',floor:3,desk:'3.01',pc:'DEMO-PC'}]).floors[0],s=f.seats[0];
  rotateMapEntity(f,'seat',s.id);const rotated=f.seats[0];
  assert.equal(rotated.rotation,90);assert.deepEqual(seatSize(rotated),{width:75,height:120});
  assert.equal(rotated.personId,'p');assert.equal(rotated.pc,'DEMO-PC');validateSeatPosition(f,rotated.id,rotated.x,rotated.y);
  const resized=validateLayoutResize(resizeLayout(f,'seat',s.id,'e',10,0)).floor.seats[0];
  assert.ok(Math.abs(seatDimensions(resized).width/seatDimensions(resized).height-1.6)<.001);assert.equal(resized.rotation,90);
});
test('four room turns restore all furniture positions and orientations',()=>{
  const f=createOffice([]).floors[0],id=f.rooms[0].id;f.seats[0].x+=25;f.seats[0].y+=50;f.seats[1].rotation=90;const original=structuredClone(f);
  for(let i=0;i<4;i++)rotateMapEntity(f,'room',id);
  assert.deepEqual([f.rooms[0].width,f.rooms[0].height],[original.rooms[0].width,original.rooms[0].height]);
  f.seats.forEach((s,i)=>assert.deepEqual([s.x,s.y,s.rotation],[original.seats[i].x,original.seats[i].y,original.seats[i].rotation||0]));
});
test('a blocked rotation is atomic',()=>{
  const f=createOffice([]).floors[0],o=f.objects.find(o=>o.kind==='printer');o.y=190;const original=structuredClone(f);
  assert.throws(()=>rotateMapEntity(f,'object',o.id),/помещаются|границ/);assert.deepEqual(f,original);
});
test('copying a room creates independent IDs and preserves employee assignments on the original',()=>{
  const f=createOffice([{id:'p',floor:3,desk:'3.01',pc:'DEMO-PC'}]).floors[0],id=f.rooms[0].id,buffer=copyMapEntity(f,'room',id);let serial=0;
  const result=pasteMapEntity(f,buffer,{createId:()=>`copy-${++serial}`}),copies=f.seats.filter(s=>s.roomId===result.id);
  assert.equal(copies.length,6);assert.ok(copies.every(s=>!s.personId));assert.equal(f.seats.find(s=>s.id===buffer.seats[0].id).personId,'p');
  assert.equal(copies[0].pc,'DEMO-PC');assert.equal(new Set(f.seats.map(s=>s.number)).size,f.seats.length);assert.equal(new Set([...f.rooms,...f.seats,...f.objects].map(x=>x.id)).size,f.rooms.length+f.seats.length+f.objects.length);
});
test('a copied seat can be pasted onto another floor without moving its employee',()=>{
  const office=createOffice([{id:'p',floor:3,desk:'3.01'}]),[source,target]=office.floors,buffer=copyMapEntity(source,'seat',source.seats[0].id),before=structuredClone(source);
  const result=pasteMapEntity(target,buffer,{roomId:target.rooms[0].id});assert.equal(target.seats.find(s=>s.id===result.id).personId,'');assert.deepEqual(source,before);
});
test('repeated furniture pastes use distinct offsets and can outlive the source',()=>{
  const f=createOffice([]).floors[0],source=f.objects.find(o=>o.kind==='printer'),buffer=copyMapEntity(f,'object',source.id);
  f.objects=f.objects.filter(o=>o.id!==source.id);const a=pasteMapEntity(f,buffer,{offset:20}),b=pasteMapEntity(f,buffer,{offset:40});
  assert.notEqual(a.id,b.id);assert.notEqual(f.objects.find(o=>o.id===a.id).x,f.objects.find(o=>o.id===b.id).x);
});
test('deleting all floors is recoverable and does not edit employee records',()=>{
  const people=[{id:'p',floor:3,desk:'3.01'}],office=createOffice(people),original=structuredClone(office),before=structuredClone(people);
  for(const f of [...office.floors])deleteOfficeFloor(office,f.id);assert.equal(office.floors.length,0);assert.deepEqual(people,before);
  Object.assign(office,original);assert.equal(office.floors.length,2);assert.equal(office.floors[0].seats[0].personId,'p');
});
const room={id:'r',x:100,y:100,width:400,height:300};
test('an adjoining corridor opens only its shared segment of wall',()=>{
  const c={id:'c',open:true,x:200,y:400,width:100,height:100},walls=wallSegments(room,[room,c]);
  assert.deepEqual(walls.s,[[0,100],[200,400]]);assert.deepEqual(walls.n,[[0,400]]);assert.deepEqual(walls.w,[[0,300]]);
  assert.ok(wallPath(room,[room,c]).includes('M0 300H100M200 300H400'));
});
test('overlapping corridor openings merge and moving the corridor restores the wall',()=>{
  const a={id:'a',open:true,x:200,y:390,width:100,height:100},b={id:'b',open:true,x:250,y:400,width:150,height:100};
  assert.deepEqual(wallSegments(room,[room,a,b]).s,[[0,100],[300,400]]);
  assert.deepEqual(wallSegments(room,[room,{...a,y:500}]).s,[[0,400]]);
});
test('inside or distant open areas do not cut walls, and all four sides can open',()=>{
  const inside={id:'in',open:true,x:200,y:200,width:100,height:100};assert.deepEqual(wallSegments(room,[room,inside]),wallSegments(room,[room]));
  const halls=[{id:'n',open:true,x:200,y:20,width:100,height:80},{id:'s',open:true,x:200,y:400,width:100,height:80},{id:'w',open:true,x:20,y:150,width:80,height:100},{id:'e',open:true,x:500,y:150,width:80,height:100}];
  const walls=wallSegments(room,[room,...halls]);assert.equal(walls.n.length,2);assert.equal(walls.s.length,2);assert.equal(walls.e.length,2);assert.equal(walls.w.length,2);
});
