// Lightweight 3D mesh artwork for the isometric office plan.
// Every model is made from 3D vertices (x, y, z) and projected through the
// same orthographic isometric camera as the floor. This keeps the map editable
// without introducing a heavy runtime 3D engine or a second coordinate system.
const ISO_Y=.46;

export const mapArtDefs=`
<linearGradient id="map-wood" x2=".1" y2="1"><stop stop-color="#f1c98f"/><stop offset=".52" stop-color="#c9935f"/><stop offset="1" stop-color="#8b5a3e"/></linearGradient>
<linearGradient id="model-wood-top" x2=".1" y2="1"><stop stop-color="#f1c98f"/><stop offset=".52" stop-color="#c9935f"/><stop offset="1" stop-color="#8b5a3e"/></linearGradient>
<linearGradient id="model-wood-side" x2="0" y2="1"><stop stop-color="#9b6345"/><stop offset="1" stop-color="#59382d"/></linearGradient>
<linearGradient id="model-metal-top" x2="0" y2="1"><stop stop-color="#f1f5f1"/><stop offset="1" stop-color="#a8b9bc"/></linearGradient>
<linearGradient id="model-case-top" x2=".2" y2="1"><stop stop-color="#dfe8e4"/><stop offset="1" stop-color="#899ca0"/></linearGradient>
<linearGradient id="model-screen" x2=".7" y2="1"><stop stop-color="#c8fbf2"/><stop offset=".45" stop-color="#55a8b1"/><stop offset="1" stop-color="#183f52"/></linearGradient>
<linearGradient id="model-fabric-top" x2=".2" y2="1"><stop stop-color="#65b1b1"/><stop offset="1" stop-color="#286171"/></linearGradient>
<linearGradient id="model-fabric-side" x2="0" y2="1"><stop stop-color="#234b59"/><stop offset="1" stop-color="#102a35"/></linearGradient>
<linearGradient id="model-plant" x2=".2" y2="1"><stop stop-color="#91c07f"/><stop offset="1" stop-color="#2d664d"/></linearGradient>
`;

const face=(className,points)=>`<path class="model-face ${className}" d="${points}"/>`;

function projector(width,height,rotation=0){
  const unit=Math.max(0.35,Math.min(width,height)/100);
  const rotate=(x,y)=>{
    if(rotation===90)return{x:height-y,y:x};
    if(rotation===180)return{x:width-x,y:height-y};
    if(rotation===270)return{x:y,y:width-x};
    return{x,y};
  };
  const point=(x,y,z=0)=>{const p=rotate(x,y);return{x:p.x-z/(2*ISO_Y),y:p.y-z/(2*ISO_Y)};};
  const path=points=>points.map((p,index)=>`${index?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')+'Z';
  const line=points=>points.map((p,index)=>`${index?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const box=(x,y,w,d,top,bottom,material='neutral')=>{
    const t=[point(x,y,top),point(x+w,y,top),point(x+w,y+d,top),point(x,y+d,top)];
    const b=[point(x,y,bottom),point(x+w,y,bottom),point(x+w,y+d,bottom),point(x,y+d,bottom)];
    return`<g class="model-box material-${material}">${face('model-side-a',path([t[1],t[2],b[2],b[1]]))}${face('model-side-b',path([t[2],t[3],b[3],b[2]]))}${face('model-top',path(t))}<path class="model-edge" d="${line([t[0],t[1],t[2],t[3],t[0]])}"/></g>`;
  };
  const panelY=(x,y,w,z0,z1,material='detail')=>face(`model-panel material-${material}`,path([point(x,y,z0),point(x+w,y,z0),point(x+w,y,z1),point(x,y,z1)]));
  const panelX=(x,y,d,z0,z1,material='detail')=>face(`model-panel material-${material}`,path([point(x,y,z0),point(x,y+d,z0),point(x,y+d,z1),point(x,y,z1)]));
  const leaf=(x,y,tx,ty,z0,z1,material='leaf')=>face(`model-leaf material-${material}`,path([point(x-unit*7,y,z0),point(tx,ty,z1),point(x+unit*7,y,z0)]));
  const x=n=>width*n/100,y=n=>height*n/100,z=n=>n*unit;
  return{width,height,rotation,unit,point,path,line,box,panelY,panelX,leaf,x,y,z};
}

function workstationMesh(p){
  const{x,y,z,box,panelY}=p;
  return[
    box(x(2),y(5),x(96),y(55),z(35),z(29),'wood'),
    box(x(7),y(10),x(6),y(6),z(29),0,'metal'),box(x(87),y(10),x(6),y(6),z(29),0,'metal'),
    box(x(7),y(48),x(6),y(6),z(29),0,'metal'),box(x(87),y(48),x(6),y(6),z(29),0,'metal'),
    box(x(35),y(9),x(31),y(13),z(59),z(36),'dark'),
    panelY(x(39),y(22),x(23),z(42),z(56),'screen'),
    box(x(39),y(28),x(31),y(12),z(39),z(35),'metal'),
    box(x(9),y(13),x(14),y(20),z(48),z(35),'dark'),
    box(x(78),y(12),x(12),y(18),z(46),z(35),'dark'),
    box(x(38),y(63),x(25),y(25),z(18),z(5),'fabric'),
    box(x(39),y(57),x(23),y(9),z(40),z(18),'fabric'),
    panelY(x(43),y(64),x(15),z(21),z(28),'metal')
  ].join('');
}

function tableMesh(p){
  const{x,y,z,box}=p;
  return[
    box(x(3),y(8),x(94),y(80),z(42),z(34),'wood'),
    box(x(9),y(14),x(7),y(7),z(34),0,'metal'),box(x(84),y(14),x(7),y(7),z(34),0,'metal'),
    box(x(9),y(75),x(7),y(7),z(34),0,'metal'),box(x(84),y(75),x(7),y(7),z(34),0,'metal'),
    box(x(44),y(43),x(12),y(14),z(45),z(42),'metal')
  ].join('');
}

function printerMesh(p){
  const{x,y,z,box,panelY}=p;
  return[
    box(x(9),y(21),x(82),y(58),z(27),0,'case'),
    box(x(14),y(18),x(72),y(45),z(43),z(27),'case'),
    box(x(25),y(7),x(50),y(25),z(59),z(43),'metal'),
    panelY(x(22),y(62),x(56),z(29),z(40),'dark'),
    panelY(x(29),y(63),x(42),z(31),z(38),'paper'),
    box(x(26),y(70),x(48),y(12),z(42),z(40),'metal'),
    box(x(71),y(28),x(9),y(10),z(46),z(43),'screen')
  ].join('');
}

function cabinetMesh(p){
  const{x,y,z,box,panelY,panelX}=p;
  return[
    box(x(8),y(8),x(84),y(84),z(76),0,'case'),
    panelY(x(12),y(89),x(36),z(7),z(69),'case-dark'),panelY(x(52),y(89),x(36),z(7),z(69),'case-dark'),
    panelY(x(48),y(89),x(4),z(5),z(72),'metal'),
    box(x(39),y(82),x(4),y(4),z(40),z(33),'metal'),box(x(57),y(82),x(4),y(4),z(40),z(33),'metal'),
    panelX(x(8),y(28),y(55),z(12),z(16),'metal')
  ].join('');
}

function sofaMesh(p){
  const{x,y,z,box}=p;
  return[
    box(x(5),y(24),x(90),y(61),z(19),0,'fabric'),
    box(x(7),y(4),x(86),y(17),z(52),z(19),'fabric'),
    box(x(0),y(19),x(13),y(70),z(43),z(8),'fabric'),box(x(87),y(19),x(13),y(70),z(43),z(8),'fabric'),
    box(x(14),y(31),x(34),y(42),z(38),z(19),'fabric-light'),box(x(52),y(31),x(34),y(42),z(38),z(19),'fabric-light'),
    box(x(18),y(35),x(26),y(5),z(41),z(38),'fabric-light'),box(x(56),y(35),x(26),y(5),z(41),z(38),'fabric-light')
  ].join('');
}

function plantMesh(p){
  const{x,y,z,box,leaf}=p;
  return[
    box(x(27),y(48),x(46),y(38),z(25),0,'terracotta'),
    box(x(21),y(44),x(58),y(10),z(31),z(24),'terracotta'),
    leaf(x(50),y(52),x(18),y(26),z(25),z(78),'leaf'),leaf(x(50),y(52),x(39),y(12),z(25),z(86),'leaf-light'),
    leaf(x(50),y(52),x(74),y(15),z(25),z(82),'leaf'),leaf(x(50),y(52),x(88),y(34),z(25),z(72),'leaf-light'),
    leaf(x(50),y(52),x(70),y(77),z(25),z(76),'leaf'),leaf(x(50),y(52),x(28),y(76),z(25),z(70),'leaf-dark')
  ].join('');
}

function doorMesh(p){
  const{x,y,z,box,panelY}=p;
  return[
    box(x(8),y(8),x(84),y(84),z(10),0,'wood-dark'),
    box(x(13),y(13),x(74),y(74),z(15),z(10),'wood'),
    panelY(x(19),y(87),x(62),z(15),z(54),'wood-dark'),
    box(x(72),y(83),x(7),y(5),z(32),z(27),'metal')
  ].join('');
}

function windowMesh(p){
  const{x,y,z,box,panelY}=p;
  return[
    box(x(3),y(13),x(94),y(74),z(9),0,'metal'),
    box(x(8),y(18),x(84),y(64),z(12),z(9),'glass'),
    panelY(x(10),y(82),x(80),z(10),z(12),'metal'),
    box(x(48),y(18),x(4),y(64),z(15),z(12),'metal'),
    box(x(8),y(48),x(84),y(4),z(15),z(12),'metal')
  ].join('');
}

function markerMesh(p){
  const{x,y,z,box,panelY}=p;
  return[
    box(x(10),y(14),x(80),y(72),z(17),0,'metal'),
    box(x(22),y(26),x(56),y(48),z(29),z(17),'dark'),
    box(x(30),y(34),x(40),y(32),z(35),z(29),'gold'),
    panelY(x(39),y(75),x(22),z(21),z(30),'gold')
  ].join('');
}

function model3d(kind,width,height,rotation=0,extraClass='furniture-art'){
  const p=projector(width,height,rotation),meshes={workstation:workstationMesh,table:tableMesh,printer:printerMesh,cabinet:cabinetMesh,sofa:sofaMesh,plant:plantMesh,door:doorMesh,window:windowMesh,marker:markerMesh};
  const mesh=meshes[kind]||markerMesh;
  return`<g class="${extraClass} model-3d model-${kind}" aria-hidden="true">${mesh(p)}</g>`;
}

export function furnitureArt(kind,width,height,rotation=0){return model3d(kind,width,height,rotation,'furniture-art');}
export function workstationArt(width,height,rotation=0){return model3d('workstation',width,height,rotation,'workstation-art');}
