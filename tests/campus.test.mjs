import test from 'node:test';
import assert from 'node:assert/strict';
import {campusScene,campusLevels,sourceFloorFor,replaceCampusFloor} from '../dist/campus-model.js';
import {createBuilding,ensureBuildings} from '../dist/workspace-model.js';
import {createOffice,saveObject,moveObject} from '../dist/office-model.js';
import {sceneSvg} from '../dist/map-scene.js';

function office(){const value=createOffice([]);ensureBuildings(value);createBuilding(value,'Восточный корпус','east','east-3',3);return value;}
test('all buildings have their own simultaneous non-overlapping platform on one shared level',()=>{
  const value=office(),before=structuredClone(value),scene=campusScene(value,3);assert.equal(scene.plans.length,2);assert.ok(scene.plans.every(p=>p.floor?.number===3));assert.ok(scene.plans[0].x+scene.plans[0].width<scene.plans[1].x);assert.deepEqual(value,before);
  assert.deepEqual(campusLevels(value,3),[3,4]);const four=campusScene(value,4);assert.equal(four.plans.length,2);assert.equal(four.plans[1].floor,null);assert.deepEqual(four.plans.map(p=>[p.x,p.y]),scene.plans.map(p=>[p.x,p.y]));assert.equal(value.floors.length,before.floors.length);
});
test('the campus renders each platform and missing floor, with only one shared SVG defs block',()=>{
  const scene=campusScene(office(),4),svg=sceneSvg(scene,{},{escape:s=>s,seatSvg:()=>''});assert.equal((svg.match(/<defs>/g)||[]).length,1);assert.equal((svg.match(/data-plan-building=/g)||[]).length,2);assert.ok(svg.includes('Восточный корпус'));assert.ok(svg.includes('Нет этажа 4'));assert.ok(svg.includes('data-plan-floor="floor-4"'));
});
test('editing local furniture in a second building never edits the first building or adds scene offsets to storage',()=>{
  const value=office(),east=value.floors.find(f=>f.id==='east-3'),main=structuredClone(value.floors[0]);saveObject(east,{id:'stairs',kind:'stairs',roomId:'',name:'Лестница',x:50,y:50,width:100,height:180,rotation:0});
  assert.equal(sourceFloorFor(value,'object','stairs').id,'east-3');moveObject(sourceFloorFor(value,'object','stairs'),'stairs',80,100);assert.equal(east.objects[0].x,80);assert.deepEqual(value.floors[0],main);
  const scene=campusScene(value,3),preview=structuredClone(east);preview.width=1400;const updated=replaceCampusFloor(scene,preview);assert.equal(updated.plans[1].floor.width,1400);assert.equal(scene.plans[1].floor.width,1000);
});
test('any number of building plans stays separate and stable across floor changes',()=>{
  const value=office();for(let i=0;i<10;i++)createBuilding(value,'Корпус '+i,'b'+i,'f'+i,3);
  const scene=campusScene(value,3);assert.equal(scene.plans.length,12);for(const [i,a]of scene.plans.entries())for(const b of scene.plans.slice(i+1))assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y);
  assert.deepEqual(campusScene(value,4).plans.map(p=>[p.x,p.y]),scene.plans.map(p=>[p.x,p.y]));
});
