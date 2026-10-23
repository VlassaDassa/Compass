import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {wallSegments} from '../dist/map-walls.js';

const colors={wood:0xb98c63,woodEdge:0x805f4a,metal:0x8693aa,dark:0x242737,screen:0x72c8de,ivory:0xd0d4de,fabric:0x6674a4,leaf:0x648f77,pot:0x9c7063,gold:0xbca2ed,glass:0x7aa4ca};
const materials=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,new T.MeshStandardMaterial({color,roughness:key==='metal'?.48:.76,metalness:key==='metal'?.28:0,emissive:key==='screen'?0x265267:0,emissiveIntensity:.35})]));
const geometries=new Map();
function box(g,x,y,z,w,d,h,material='metal',radius=0){
  const key=[w,d,h,radius].join('/');
  if(!geometries.has(key))geometries.set(key,radius?new RoundedBoxGeometry(w,d,h,2,Math.min(radius,w/3,d/3,h/3)):new T.BoxGeometry(w,d,h));
  const mesh=new T.Mesh(geometries.get(key),materials[material]);mesh.position.set(x+w/2,y+d/2,z+h/2);g.add(mesh);return mesh;
}
function cylinder(g,x,y,z,r1,r2,h,material='metal',segments=12){
  const geometry=new T.CylinderGeometry(r1,r2,h,segments);geometry.rotateX(Math.PI/2);
  const mesh=new T.Mesh(geometry,materials[material]);mesh.position.set(x,y,z+h/2);g.add(mesh);return mesh;
}
function desk(g,meeting=false){
  const w=meeting?140:120,d=meeting?80:58,h=42;
  for(const x of [7,w-11])for(const y of [7,d-11])box(g,x,y,0,4,4,h-4,'metal',.6);
  box(g,2,2,h-5,w-4,d-4,5,'wood',2);
  if(meeting){box(g,62,34,h,16,12,1.3,'dark',1);return;}
  // The display stands vertically, with the screen facing the chair.
  box(g,42,12,h,27,13,2,'dark',1);box(g,54,16,h+2,3,3,9,'metal');
  box(g,38,12,h+10,38,4,23,'dark',1.2);box(g,40,16.1,h+12,34,.5,19,'screen',.2);
  box(g,38,37,h,35,10,1.8,'ivory',.7);
  for(let row=0;row<3;row++)for(let col=0;col<9;col++)box(g,40+col*3.5,39+row*2.2,h+1.8,2.2,1.2,.25,'metal');
  box(g,81,39,h,5,8,2,'ivory',2);
  box(g,10,14,h,12,22,4,'dark',1);box(g,12,16,h+4,8,5,.5,'screen');
  box(g,98,8,0,14,30,33,'dark',1.5);box(g,99,36,25,12,1,4,'metal');
  // Five-star chair, padded seat, arms and an upright backrest.
  cylinder(g,58,79,0,3,3,20,'dark');
  for(let a=0;a<5;a++){const bar=box(g,57,79,3,2,18,2,'dark');bar.position.set(58,79,4);bar.geometry=bar.geometry.clone();bar.geometry.translate(0,8,0);bar.rotation.z=a*Math.PI*2/5;}
  box(g,43,65,20,31,29,6,'fabric',3);box(g,43,88,26,31,5,28,'fabric',2);
  for(const x of [39,75]){box(g,x,70,20,3,3,15,'dark');box(g,x,68,33,4,20,3,'dark',1);}
}
function printer(g){
  box(g,8,12,0,60,47,39,'ivory',3);box(g,11,14,39,54,40,7,'metal',2);
  box(g,18,6,46,42,28,6,'ivory',1);box(g,22,9,52,34,22,1,'glass',.3);
  box(g,15,58,23,46,1,11,'dark',.5);box(g,19,58.7,26,38,.5,2,'ivory');
  box(g,17,52,35,43,15,2,'ivory',1);box(g,53,42,46,10,8,2,'screen',.5);
  for(let z=6;z<20;z+=9)box(g,15,59,z,45,.5,1,'metal');
}
function cabinet(g){
  box(g,2,4,0,81,51,96,'ivory',1.8);
  for(const x of [5,44]){box(g,x,55,4,36,1.5,87,'metal',.5);box(g,x+27,57,40,2,2,15,'dark',.5);}
}
function sofa(g){
  for(const x of [9,112])for(const y of [10,51])cylinder(g,x,y,0,2,2,8,'metal');
  box(g,4,5,7,122,55,17,'dark',3);box(g,8,4,24,114,11,30,'fabric',4);
  for(const x of [0,115])box(g,x,10,20,15,52,22,'fabric',4);
  for(const x of [17,67])box(g,x,19,24,46,38,9,'fabric',4);
}
function plant(g){
  cylinder(g,24,24,0,15,11,25,'pot',18);cylinder(g,24,24,25,16,16,4,'pot',18);
  cylinder(g,24,24,28,13,13,1,'dark');cylinder(g,24,24,29,1.2,1.6,35,'leaf');
  for(let i=0;i<9;i++){
    const angle=i*2.4,h=42+i*3;
    const leaf=new T.Mesh(new T.SphereGeometry(1,8,5),materials.leaf);
    leaf.scale.set(5,14,2.5);leaf.position.set(24+Math.cos(angle)*10,24+Math.sin(angle)*10,h);leaf.rotation.set(.5*Math.cos(angle),.45*Math.sin(angle),angle);g.add(leaf);
  }
}
function door(g){
  // A free-standing frame and open leaf; the footprint still controls placement.
  box(g,3,3,0,5,9,109,'ivory',1);box(g,72,3,0,5,9,109,'ivory',1);box(g,3,3,105,74,9,5,'ivory',1);
  const leaf=new T.Group();leaf.position.set(9,7,0);leaf.rotation.z=Math.PI/5;
  box(leaf,0,0,0,60,4,102,'wood',1);box(leaf,50,4,43,8,3,2,'metal',.5);g.add(leaf);
}
function windowModel(g){
  for(const x of [3,104])box(g,x,4,22,4,8,75,'ivory',.7);
  for(const z of [22,58,94])box(g,3,4,z,105,8,4,'ivory',.7);
  box(g,54,4,22,4,8,76,'ivory',.7);
  // Opaque softly lit panes remain legible without transparent sorting artifacts.
  for(const x of [8,59])for(const z of [27,63])box(g,x,7,z,44,1.5,29,'glass',.3);
  box(g,0,0,19,110,16,4,'metal',1);
}
function flag(g){
  cylinder(g,16,28,0,13,16,5,'metal',18);cylinder(g,16,28,5,1.5,1.8,80,'ivory');
  const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(43,0);shape.lineTo(34,-15);shape.lineTo(43,-30);shape.lineTo(0,-30);shape.closePath();
  const mesh=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:1.2,bevelEnabled:false}),materials.gold);
  mesh.rotation.x=Math.PI/2;mesh.position.set(18,28,81);g.add(mesh);
}
function stairs(g){
  for(let i=0;i<8;i++){
    const top=(i+1)*8;
    box(g,5,i*18,0,90,18,top,'metal',.4).name='stair-step';
    box(g,6,i*18,top-.5,88,2,1,'ivory',.2);
  }
  box(g,5,144,0,90,36,64,'metal',.4).name='stair-landing';
  const rail=(a,b)=>{const direction=b.clone().sub(a),mesh=new T.Mesh(new T.CylinderGeometry(1.5,1.5,direction.length(),8),materials.ivory);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize());mesh.name='stair-handrail';g.add(mesh);};
  for(const x of [3,97]){
    for(const [y,z]of [[8,8],[62,32],[116,56],[174,64]])cylinder(g,x,y,z,1.3,1.3,30,'ivory',8);
    rail(new T.Vector3(x,8,38),new T.Vector3(x,144,94));rail(new T.Vector3(x,144,94),new T.Vector3(x,174,94));
  }
}

export function createFurniture(kind,width,height,rotation=0){
  const definitions={workstation:[desk,120,100],table:[g=>desk(g,true),140,80],printer:[printer,76,70],cabinet:[cabinet,85,60],sofa:[sofa,130,65],plant:[plant,48,48],door:[door,80,80],window:[windowModel,110,16],marker:[flag,75,54],stairs:[stairs,100,180]};
  const [build,w,d]=definitions[kind]||definitions.marker,g=new T.Group();build(g);
  g.scale.set(width/w,height/d,Math.min(width/w,height/d));
  const pivot=new T.Group();pivot.add(g);pivot.rotation.z=rotation*Math.PI/180;
  if(rotation===90)pivot.position.x=height;else if(rotation===180)pivot.position.set(width,height,0);else if(rotation===270)pivot.position.y=width;
  return pivot;
}

export function createPlatform(width,height,depth,topColor,sideColor){
  const top=new T.MeshStandardMaterial({color:topColor,roughness:.94}),side=new T.MeshStandardMaterial({color:sideColor,roughness:.8});
  const geometry=new T.BoxGeometry(width,height,depth),mesh=new T.Mesh(geometry,[side,side,side,side,top,side]);
  mesh.position.set(width/2,height/2,-depth/2);
  const group=new T.Group();group.add(mesh);
  const border=new T.LineSegments(new T.EdgesGeometry(geometry),new T.LineBasicMaterial({color:0x81729e,transparent:true,opacity:.38}));border.position.copy(mesh.position);group.add(border);return group;
}

export function createZoneWalls(room,rooms,objects=[]){
  const group=new T.Group();if(room.open)return group;
  const thickness=4,segments=wallSegments(room,rooms,objects),material=new T.MeshStandardMaterial({color:0x746b86,roughness:.82});
  for(const [side,parts]of Object.entries(segments))for(const [a,b]of parts){
    // The front boundary stays low so it never hides desks or chairs.
    const horizontal=side==='n'||side==='s',height=side==='n'||side==='w'?24:13;
    const mesh=new T.Mesh(new T.BoxGeometry(horizontal?b-a:thickness,horizontal?thickness:b-a,height),material);
    mesh.position.set(horizontal?(a+b)/2:side==='w'?thickness/2:room.width-thickness/2,horizontal?(side==='n'?thickness/2:room.height-thickness/2):(a+b)/2,height/2);
    mesh.name='zone-wall';group.add(mesh);
  }
  return group;
}
