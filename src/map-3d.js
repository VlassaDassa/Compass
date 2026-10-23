import * as T from 'three';
import {createFurniture,createPlatform} from './map-3d-models.js';

const sx=.82,sy=.46,projectionScale=sx*Math.SQRT2;
const cameraHeight=Math.sqrt(4*sy*sy/(projectionScale*projectionScale-2*sy*sy));

export function createOfficeRenderer(viewport){
  let renderer;
  try{renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});}catch{return null;}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  renderer.domElement.className='office-webgl';renderer.domElement.setAttribute('aria-hidden','true');viewport.prepend(renderer.domElement);
  const scene=new T.Scene(),camera=new T.OrthographicCamera();camera.up.set(0,0,1);camera.position.set(20000,20000,20000*cameraHeight);camera.lookAt(0,0,0);camera.near=1;camera.far=100000;
  scene.add(new T.HemisphereLight(0xe9e4ff,0x1c152b,2.2));
  const key=new T.DirectionalLight(0xffead9,3.3);key.position.set(-400,-500,1500);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.001;key.shadow.normalBias=.5;scene.add(key);scene.add(key.target);
  const rim=new T.DirectionalLight(0xa998ff,1.3);rim.position.set(1000,500,500);scene.add(rim);
  const makeContent=()=>{const group=new T.Group();group.matrixAutoUpdate=false;group.matrix.set(0,1,0,0,1,0,0,0,0,0,1,0,0,0,0,1);return group;};
  let content=makeContent(),entities=new Map(),currentFloor,currentMap;scene.add(content);
  function render(){if(!currentFloor||!currentMap?.camera)return;const rect=viewport.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const c=currentMap.camera,iso=currentMap.iso,scale=Math.min(rect.width/c.w,rect.height/c.h),w=rect.width/scale,h=rect.height/scale;
    camera.left=(c.x+c.w/2-w/2-iso.ox)/projectionScale;camera.right=camera.left+w/projectionScale;
    camera.top=(iso.oy-c.y-c.h/2+h/2)/projectionScale;camera.bottom=camera.top-h/projectionScale;camera.updateProjectionMatrix();
    renderer.setSize(rect.width,rect.height,false);renderer.render(scene,camera);
  }
  function release(group){const geometry=new Set(),material=new Set();group.traverse(item=>{if(item.geometry)geometry.add(item.geometry);if(item.material)for(const m of Array.isArray(item.material)?item.material:[item.material])material.add(m);});
    // Shared meshes survive redraws; scene-specific allocations are disposed
    // once the next scene no longer references them.
    return{geometry,material};
  }
  function rebuild(floor,map){currentFloor=floor;currentMap=map;scene.remove(content);const previous=release(content);content=makeContent();entities=new Map();scene.add(content);
    const base=createPlatform(floor.width,floor.height,26,0x211c32,0x151121);base.position.z=-12;content.add(base);entities.set('floor:'+floor.id,base);
    const zoneColors={teal:0x333049,amber:0x383043,violet:0x38304d,coral:0x3a2e40,blue:0x2d3048,stone:0x2c293c};
    const parents=new Map();for(const room of [...floor.rooms].sort((a,b)=>Number(b.open)-Number(a.open))){const group=new T.Group();group.position.set(room.x,room.y,room.open?-4:0);group.add(createPlatform(room.width,room.height,room.open?8:12,zoneColors[room.color]||0x343047,0x211b31));parents.set(room.id,group);entities.set('room:'+room.id,group);content.add(group);}
    const add=(kind,item,mesh)=>{const g=new T.Group(),parent=parents.get(item.roomId);g.position.set(item.x,item.y,parent?0:-12);g.add(mesh);(parent||content).add(g);entities.set(kind+':'+item.id,g);};
    for(const seat of floor.seats)add('seat',seat,createFurniture('workstation',seat.width??120,seat.height??75,seat.rotation||0));
    for(const object of floor.objects||[])add('object',object,createFurniture(object.kind,object.width,object.height,object.rotation||0));
    const extent=Math.max(floor.width,floor.height);key.position.set(floor.width/2-extent,floor.height/2-extent,extent*1.7);key.target.position.set(floor.width/2,floor.height/2,0);Object.assign(key.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,near:1,far:extent*5});key.shadow.camera.updateProjectionMatrix();
    const next=release(content);for(const value of previous.geometry)if(!next.geometry.has(value))value.dispose();for(const value of previous.material)if(!next.material.has(value))value.dispose();
    viewport.classList.add('webgl-ready');render();
  }
  return{rebuild,render,preview(kind,id,point){const entity=entities.get(kind+':'+id);if(entity){entity.position.x=point.x;entity.position.y=point.y;render();}},dispose(){const last=release(content);for(const g of last.geometry)g.dispose();for(const m of last.material)m.dispose();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();viewport.classList.remove('webgl-ready');}};
}
