import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createZoneWalls,createFurniture} from '../src/map-3d-models.js';

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
