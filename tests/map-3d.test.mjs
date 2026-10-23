import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createZoneWalls,createFurniture} from '../src/map-3d-models.js';
import {doorWallPlacement,wallSegments} from '../dist/map-walls.js';
import {sceneSvg,isoTransform,mapCaption,zoneCaptionPlacement} from '../dist/map-scene.js';

test('zone limits have low front walls and remain open where a corridor joins',()=>{
  const room={id:'r',x:0,y:0,width:500,height:400};const walls=createZoneWalls(room,[room]);assert.equal(walls.children.length,4);assert.deepEqual([...new Set(walls.children.map(m=>m.geometry.parameters.depth))].sort((a,b)=>a-b),[13,24]);
  assert.equal(createZoneWalls({...room,open:true},[room]).children.length,0);
  const connected=createZoneWalls(room,[room,{id:'passage',x:150,y:-100,width:200,height:100,open:true}]);assert.equal(connected.children.length,5);
});
test('window panes can be raycast at their visible height above the floor',()=>{
  const scene=new T.Scene(),model=createFurniture('window',110,16);scene.add(model);scene.updateMatrixWorld(true);
  const camera=new T.PerspectiveCamera(30,1,.1,10000);camera.up.set(0,0,1);camera.position.set(250,250,260);camera.lookAt(27,8,75);camera.updateMatrixWorld(true);
  const ray=new T.Raycaster();ray.setFromCamera(new T.Vector2(0,0),camera);const hits=ray.intersectObject(model,true);assert.ok(hits.length);assert.ok(hits[0].point.z>60,'hit is on upright window rather than its footprint');
});
for(const [rotation,x,y,side]of [[0,100,0,'n'],[0,100,320,'s'],[180,100,320,'s'],[90,420,100,'e'],[270,0,100,'w']])test(`a ${rotation}° door cuts the ${side} wall and aligns its frame`,()=>{
  const room={id:'r',x:20,y:30,width:500,height:400},door={id:'door',kind:'door',roomId:'r',x,y,width:80,height:80,rotation};
  const placement=doorWallPlacement(door,[room]);assert.equal(placement.side,side);assert.equal(wallSegments(room,[room],[door])[side].length,2);assert.equal(createZoneWalls(room,[room],[door]).children.length,5);
  const model=createFurniture('door',80,80,rotation);model.position.add(new T.Vector3(x+room.x+placement.offset.x,y+room.y+placement.offset.y,0));model.updateMatrixWorld(true);
  const frame=new T.Vector3(40,7.5,0).applyMatrix4(model.children[0].matrixWorld);assert.ok(Math.abs((placement.axis==='x'?frame.y:frame.x)-placement.line)<.001);
  assert.deepEqual(wallSegments(room,[room],[{...door,x:200,y:150}]),wallSegments(room,[room]),'moving a door away restores the wall');
});
test('a floor-level door cuts both sides of a shared boundary, but furniture never cuts walls',()=>{
  const a={id:'a',x:0,y:0,width:500,height:400},b={id:'b',x:0,y:400,width:500,height:300},door={kind:'door',roomId:'',x:100,y:320,width:80,height:80,rotation:0};
  assert.equal(wallSegments(a,[a,b],[door]).s.length,2);assert.equal(wallSegments(b,[a,b],[door]).n.length,2);
  assert.deepEqual(wallSegments(a,[a,b],[{...door,kind:'table'}]),wallSegments(a,[a,b]));
});
test('furniture has no cast or received shadows',()=>{
  for(const kind of ['workstation','door','window','printer','cabinet','plant','sofa','marker','table','stairs'])createFurniture(kind,80,80).traverse(mesh=>{assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,false);});
});
test('stairs are an actual stepped 3D mesh with an elevated landing and handrails',()=>{
  const model=createFurniture('stairs',100,180),steps=[],rails=[];model.traverse(mesh=>{if(mesh.name==='stair-step')steps.push(mesh);if(mesh.name==='stair-handrail')rails.push(mesh);});assert.equal(steps.length,8);assert.equal(rails.length,4);assert.deepEqual(steps.map(m=>m.position.z*2),[8,16,24,32,40,48,56,64]);model.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(model);assert.ok(bounds.max.z>90);assert.ok(bounds.max.x<=101);assert.ok(bounds.max.y<=181);
});
test('zone plaques sit wholly outside the north edge and open corridors have no label',()=>{
  const floor={id:'f',width:1000,height:680,objects:[],seats:[],rooms:[{id:'r',name:'Команда',x:20,y:30,width:500,height:400},{id:'c',name:'Коридор',x:20,y:450,width:500,height:100,open:true}]};
  const svg=sceneSvg(floor,{},{escape:s=>s,seatSvg:()=>''});assert.ok(svg.includes('Команда'));assert.ok(!svg.includes('Коридор'));assert.equal((svg.match(/caption-room/g)||[]).length,1);
  const label=mapCaption('Команда',250,0,isoTransform(floor),s=>s);assert.ok(label.includes('y="-64"'));assert.ok(label.includes('height="25"'));
  const front={id:'front',x:20,y:450,width:500,height:100};assert.equal(zoneCaptionPlacement(front,[floor.rooms[0],front]).side,'s','the label avoids a nearby zone behind it');
});
