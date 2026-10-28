import * as T from 'three';
import {createFurniture,createPlatform,createZoneWalls} from './map-3d-models.js';
import {doorWallPlacement} from '../dist/map-walls.js';
import {replaceCampusFloor} from '../dist/campus-model.js';

const sx=.82,sy=.46,projectionScale=sx*Math.SQRT2;
const cameraHeight=Math.sqrt(4*sy*sy/(projectionScale*projectionScale-2*sy*sy));

export function createOfficeRenderer(viewport){
  let renderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}catch{return null;}
  renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=false;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.domElement.className='office-webgl';renderer.domElement.setAttribute('aria-hidden','true');viewport.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera();camera.up.set(0,0,1);camera.position.set(20000,20000,20000*cameraHeight);camera.lookAt(0,0,0);camera.near=1;camera.far=100000;
  scene.add(new T.HemisphereLight(0xf2f3f6,0x191a20,2.2));
  const key=new T.DirectionalLight(0xf4f4f2,3.3);key.position.set(-400,-500,1500);scene.add(key);scene.add(key.target);
  const rim=new T.DirectionalLight(0xbfc2ca,1.1);rim.position.set(1000,500,500);scene.add(rim);
  const makeContent=()=>{const group=new T.Group();group.matrixAutoUpdate=false;group.matrix.set(0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1);return group;};
  let content=makeContent(),entities=new Map(),currentFloor,currentMap;scene.add(content);
  const raycaster=new T.Raycaster(),pointer=new T.Vector2();let drawWidth=0,drawHeight=0,drawRatio=0;
  function render(){if(!currentFloor||!currentMap?.camera)return;const rect=viewport.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const c=currentMap.camera,iso=currentMap.iso,scale=Math.min(rect.width/c.w,rect.height/c.h),w=rect.width/scale,h=rect.height/scale;
    camera.left=(c.x+c.w/2-w/2-iso.ox)/projectionScale;camera.right=camera.left+w/projectionScale;
    camera.top=(iso.oy-c.y-c.h/2+h/2)/projectionScale;camera.bottom=camera.top-h/projectionScale;camera.updateProjectionMatrix();
    // Supersampling preserves narrow edges when the entire floor is zoomed out.
    // Bound the buffer on large monitors rather than stretching a low-res canvas.
    const ratio=Math.max(1,Math.min(Math.max(devicePixelRatio||1,1.75),Math.sqrt(10000000/(rect.width*rect.height)),3));
    if(rect.width!==drawWidth||rect.height!==drawHeight||ratio!==drawRatio){renderer.setPixelRatio(ratio);renderer.setSize(rect.width,rect.height,false);drawWidth=rect.width;drawHeight=rect.height;drawRatio=ratio;}
    renderer.render(scene,camera);
  }
  function release(group){const geometry=new Set(),material=new Set();group.traverse(item=>{if(item.geometry)geometry.add(item.geometry);if(item.material)for(const m of Array.isArray(item.material)?item.material:[item.material])material.add(m);});
    // Shared meshes survive redraws; scene-specific allocations are disposed
    // once the next scene no longer references them.
    return{geometry,material};
  }
  function rebuild(floor,map){currentFloor=floor;currentMap=map;scene.remove(content);const previous=release(content);content=makeContent();entities=new Map();scene.add(content);
    const css=getComputedStyle(document.documentElement),theme=(key,fallback)=>{const value=css.getPropertyValue(key).trim();return /^#[\da-f]{6}$/i.test(value)?new T.Color(value):new T.Color(fallback);};
    const paper=theme('--paper',0x101114),raised=theme('--raised',0x1b1c20),accent=theme('--accent',0xc6c8ce),baseColor=paper.clone().lerp(raised,.45),sideColor=paper.clone().multiplyScalar(.65),zoneBase=raised.clone().lerp(accent,.12),wallColor=raised.clone().lerp(accent,.35);
    for(const plan of floor.plans||[{floor,x:0,y:0,width:floor.width,height:floor.height}]){
    const local=plan.floor||{width:plan.width,height:plan.height,rooms:[],seats:[],objects:[]},platform=new T.Group();platform.position.set(plan.x,plan.y,0);content.add(platform);if(plan.building)entities.set('building:'+plan.building.id,platform);
    const base=createPlatform(local.width,local.height,26,plan.floor?baseColor:paper,sideColor,wallColor);base.position.z=-12;base.userData.mapTarget=plan.floor?{kind:'floor',id:local.id}:{kind:'building',id:plan.building.id};platform.add(base);if(plan.floor)entities.set('floor:'+local.id,base);
    const zoneColors={teal:0x35454a,amber:0x51463f,violet:0x443d5b,coral:0x514047,blue:0x35445a,stone:0x3c3d47};
    const parents=new Map();for(const room of [...local.rooms].sort((a,b)=>Number(b.open)-Number(a.open))){const group=new T.Group();group.position.set(room.x,room.y,room.open?-4:0);group.userData.mapTarget={kind:'room',id:room.id};group.userData.floorId=local.id;const zone=zoneBase.clone().lerp(new T.Color(zoneColors[room.color]||zoneColors.stone),.16);group.add(createPlatform(room.width,room.height,room.open?8:12,zone,sideColor,wallColor),createZoneWalls(room,local.rooms,local.objects,wallColor));parents.set(room.id,group);entities.set('room:'+room.id,group);platform.add(group);}
    const add=(kind,item,mesh)=>{const g=new T.Group(),parent=parents.get(item.roomId);g.position.set(item.x,item.y,parent?0:-12);g.userData.mapTarget={kind,id:item.id};g.userData.floorId=local.id;g.add(mesh);(parent||platform).add(g);entities.set(kind+':'+item.id,g);};
    for(const seat of local.seats)add('seat',seat,createFurniture('workstation',seat.width??120,seat.height??75,seat.rotation||0));
    for(const object of local.objects||[]){const mesh=createFurniture(object.kind,object.width,object.height,object.rotation||0),attachment=doorWallPlacement(object,local.rooms);if(attachment)mesh.position.add(new T.Vector3(attachment.offset.x,attachment.offset.y,0));add('object',object,mesh);}
    }
    const extent=Math.max(floor.width,floor.height);key.position.set(floor.width/2-extent,floor.height/2-extent,extent*1.7);key.target.position.set(floor.width/2,floor.height/2,0);
    const next=release(content);for(const value of previous.geometry)if(!next.geometry.has(value))value.dispose();for(const value of previous.material)if(!next.material.has(value))value.dispose();
    viewport.classList.add('webgl-ready');render();
  }
  function pick(clientX,clientY){
    if(!currentFloor||!currentMap?.camera)return null;const rect=viewport.getBoundingClientRect();
    pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);raycaster.setFromCamera(pointer,camera);
    for(const hit of raycaster.intersectObject(content,true)){if(!hit.object.isMesh)continue;let object=hit.object;while(object){if(object.userData.mapTarget)return object.userData.mapTarget;object=object.parent;}}
    return null;
  }
  return{rebuild,render,pick,preview(kind,id,point){const entity=entities.get(kind+':'+id),source=currentFloor.plans?.find(p=>p.floor?.id===entity?.userData.floorId)?.floor||currentFloor;if(kind==='object'&&source.objects?.find(o=>o.id===id)?.kind==='door'){const next={...source,objects:source.objects.map(o=>o.id===id?{...o,...point}:o)};rebuild(currentFloor.plans?replaceCampusFloor(currentFloor,next):next,currentMap);return;}if(entity){entity.position.x=point.x;entity.position.y=point.y;render();}},dispose(){const last=release(content);for(const g of last.geometry)g.dispose();for(const m of last.material)m.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();viewport.classList.remove('webgl-ready');}};
}
