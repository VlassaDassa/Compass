import {mapColors,objectKinds,objectSize,seatSize,rotationTransform} from './office-model.js';
import {mapArtDefs,furnitureArt} from './map-art.js';
import {wallPath} from './map-walls.js';

const palette=value=>mapColors[value]||mapColors.stone;
const short=(text,max)=>text.length>max?text.slice(0,Math.max(1,max-1))+'…':text;
const entityLabel={floor:'плана',room:'зоны',object:'объекта',seat:'рабочего места'};
const ISO_X=.82,ISO_Y=.46,ISO_PADDING=120,ISO_DEPTH=28;
export function isoTransform(floor,padding=ISO_PADDING){
  const points=[[0,0],[floor.width,0],[0,floor.height],[floor.width,floor.height]].map(([x,y])=>({x:ISO_X*(x-y),y:ISO_Y*(x+y)}));
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return{sx:ISO_X,sy:ISO_Y,ox:padding-minX,oy:padding-minY,width:maxX-minX+padding*2,height:maxY-minY+padding*2};
}
export function projectIsoPoint(iso,x,y){return{x:iso.ox+iso.sx*(x-y),y:iso.oy+iso.sy*(x+y)};}
export function isoRectBounds(iso,x,y,width,height,padding=0){
  const points=[[x,y],[x+width,y],[x,y+height],[x+width,y+height]].map(([px,py])=>projectIsoPoint(iso,px,py));
  const xs=points.map(point=>point.x),ys=points.map(point=>point.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  return{x:minX-padding,y:minY-padding,w:maxX-minX+padding*2,h:maxY-minY+padding*2};
}
const isoMatrix=iso=>`translate(${iso.ox} ${iso.oy}) matrix(${iso.sx} ${iso.sy} ${-iso.sx} ${iso.sy} 0 0)`;
const pointsForRect=(iso,x,y,width,height)=>[[x,y],[x+width,y],[x+width,y+height],[x,y+height]].map(([px,py])=>projectIsoPoint(iso,px,py));
const pathPolygon=points=>points.map((point,index)=>`${index?'L':'M'}${point.x} ${point.y}`).join(' ')+'Z';
const drop=point=>({x:point.x,y:point.y+ISO_DEPTH});
const volumeDrop=(point,depth)=>({x:point.x,y:point.y+depth});
const inverseMatrix=iso=>{const a=1/(2*iso.sx),b=-1/(2*iso.sx),c=1/(2*iso.sy),d=1/(2*iso.sy);return{a,b,c,d};};
const readableLabel=(iso,x,y)=>{const m=inverseMatrix(iso),e=x-m.a*x-m.c*y,f=y-m.b*x-m.d*y;return`matrix(${m.a} ${m.b} ${m.c} ${m.d} ${e} ${f})`;};
const extrusion=(iso,points,kind,style='')=>{const [,b,c,d]=points,faces=[[b,c,drop(c),drop(b)],[c,d,drop(d),drop(c)]];return`<g class="iso-extrusion ${kind}" style="${style}" aria-hidden="true"><path class="iso-face iso-face-right" d="${pathPolygon(faces[0])}"/><path class="iso-face iso-face-front" d="${pathPolygon(faces[1])}"/><path class="iso-edge" d="M${drop(b).x} ${drop(b).y}L${drop(c).x} ${drop(c).y}L${drop(d).x} ${drop(d).y}"/></g>`;};
const objectVolume=(iso,x,y,width,height,depth,kind,style='')=>{const points=pointsForRect(iso,x,y,width,height),[,b,c,d]=points,faces=[[b,c,volumeDrop(c,depth),volumeDrop(b,depth)],[c,d,volumeDrop(d,depth),volumeDrop(c,depth)]];const shadow=points.map(point=>({x:point.x+5,y:point.y+depth+7}));return`<g class="iso-volume kind-${kind}" style="${style}" aria-hidden="true"><path class="iso-volume-shadow" d="${pathPolygon(shadow)}"/><path class="iso-volume-face iso-volume-face-right" d="${pathPolygon(faces[0])}"/><path class="iso-volume-face iso-volume-face-front" d="${pathPolygon(faces[1])}"/><path class="iso-volume-edge" d="M${volumeDrop(b,depth).x} ${volumeDrop(b,depth).y}L${volumeDrop(c,depth).x} ${volumeDrop(c,depth).y}L${volumeDrop(d,depth).x} ${volumeDrop(d,depth).y}"/></g>`;};
export function resizeHandles(kind,id,width,height,selected=true){
  const edges=[['n',0,0,width,0,'верхний'],['e',width,0,width,height,'правый'],['s',width,height,0,height,'нижний'],['w',0,height,0,0,'левый']];
  const corners=[['nw',0,0,'верхний левый'],['ne',width,0,'верхний правый'],['se',width,height,'нижний правый'],['sw',0,height,'нижний левый']];
  const attrs=(axis,label)=>`data-resize-kind="${kind}" data-resize-id="${id}" data-resize-axis="${axis}" role="button" tabindex="${selected?0:-1}" aria-label="Изменить размер ${entityLabel[kind]}: ${label}" class="map-resize-edge ${axis}"`;
  return `<g class="map-resize-handles ${selected?'is-selected':''}">${selected?`<rect class="resize-selection" width="${width}" height="${height}" rx="2"/>`:''}${edges.map(([axis,x,y,x2,y2,label])=>`<path ${attrs(axis,label+' край')} d="M${x} ${y}L${x2} ${y2}"/>`).join('')}${corners.map(([axis,x,y,label])=>`<path ${attrs(axis,label+' угол')} d="M${x-4} ${y}H${x+4}"/>`).join('')}</g>`;
}
export function sceneSvg(floor,map,{escape,seatSvg}){
  const e=escape,iso=isoTransform(floor),worldTransform=isoMatrix(iso);
  const floorPoints=pointsForRect(iso,0,0,floor.width,floor.height);
  const roomSvg=room=>{
    const color=palette(room.color),selected=map.roomId===room.id&&!map.seatId&&!map.objectId;
    const walls=wallPath(room,floor.rooms);
    const count=floor.seats.filter(s=>s.roomId===room.id).length+(floor.objects||[]).filter(o=>o.roomId===room.id).length;
    const roomStyle=`--zone-ink:${color.ink};--zone-fill:${color.fill};--zone-header:${color.header}`;
    return`<g class="office-room map-zone ${room.open?'open-zone':''} ${selected?'selected':''}" data-room-shape="${room.id}" data-map-kind="room" data-map-id="${room.id}" transform="translate(${room.x} ${room.y})" style="${roomStyle}"><rect class="office-room-bg" data-zone-body="true" width="${room.width}" height="${room.height}" rx="3" data-layout="select-room" data-room="${room.id}"/><rect class="room-floor-grain" width="${room.width}" height="${room.height}" fill="url(#map-floorboards)"/><g class="room-walls" aria-hidden="true"><path class="wall-shadow" d="${walls}"/><path class="wall-body" d="${walls}"/><path class="wall-highlight" d="${walls}"/></g><g class="${room.rotation?'rotated-room-caption':''}" data-room-drag="${room.id}" data-layout="select-room" data-room="${room.id}" role="button" tabindex="0" aria-label="Зона ${e(room.name)}"><rect class="office-room-title-bg" x="10" y="10" width="${Math.max(1,room.width-20)}" height="${Math.min(52,room.height-20)}" rx="3"/><text x="22" y="33" class="office-room-name" transform="${readableLabel(iso,22,33)}">${e(short(room.name,Math.floor((room.width-42)/11)))}</text>${room.height>=100?`<text x="22" y="51" class="office-room-type" transform="${readableLabel(iso,22,51)}">${room.open?'ОТКРЫТАЯ ЗОНА · ':''}${count} ОБЪЕКТОВ</text>`:''}</g>${map.editing?resizeHandles('room',room.id,room.width,room.height,selected):''}${floor.seats.filter(s=>s.roomId===room.id).map(seat=>seatSvg(seat,iso)).join('')}</g>`;
  };
  const floorShell=`<g class="iso-floor-shell" aria-hidden="true"><path class="iso-floor-face" d="${pathPolygon([floorPoints[1],floorPoints[2],drop(floorPoints[2]),drop(floorPoints[1])])}"/><path class="iso-floor-face iso-floor-face-front" d="${pathPolygon([floorPoints[2],floorPoints[3],drop(floorPoints[3]),drop(floorPoints[2])])}"/><path class="iso-floor-edge" d="${pathPolygon(floorPoints)}"/></g>`;
  const roomShells=[...floor.rooms].sort((a,b)=>Number(b.open)-Number(a.open)).map(room=>{const color=palette(room.color),style=`--zone-ink:${color.ink};--zone-fill:${color.fill};--zone-header:${color.header}`;return extrusion(iso,pointsForRect(iso,room.x,room.y,room.width,room.height),`room ${room.open?'open':''}`,style);}).join('');
  const seatVolumes=floor.seats.map(seat=>{const parent=floor.rooms.find(room=>room.id===seat.roomId),size=seatSize(seat);return objectVolume(iso,(parent?.x||0)+seat.x,(parent?.y||0)+seat.y,size.width,size.height,18,'workstation');}).join('');
  const objectVolumes=(floor.objects||[]).map(object=>{const parent=floor.rooms.find(room=>room.id===object.roomId),size=objectSize(object),depth={table:22,printer:20,cabinet:28,sofa:24,plant:20,marker:16,door:8,window:7}[object.kind]||16;return objectVolume(iso,(parent?.x||0)+object.x,(parent?.y||0)+object.y,size.width,size.height,depth,object.kind);}).join('');
  const equipment=(floor.objects||[]).map(object=>{const parent=floor.rooms.find(room=>room.id===object.roomId);return`<g class="map-equipment-layer" transform="translate(${parent?.x||0} ${parent?.y||0})">${objectSvg(object,map,e,iso)}</g>`;}).join('');
  const world=`<g class="iso-world" transform="${worldTransform}"><rect class="map-floor-fill" data-map-kind="floor" data-map-id="${floor.id}" data-layout="select-floor" data-id="${floor.id}" width="${floor.width}" height="${floor.height}" rx="4"/><rect class="map-edit-grid" width="${floor.width}" height="${floor.height}" fill="url(#office-dots)"/><rect class="map-floor-edge" data-floor-edge="true" width="${floor.width}" height="${floor.height}" rx="4" fill="none"/><text class="map-floor-label" data-floor-label="true" x="0" y="-23" transform="${readableLabel(iso,0,-23)}">ПЛАН · ${floor.width} × ${floor.height}</text>${map.editing?resizeHandles('floor',floor.id,floor.width,floor.height,false):''}${[...floor.rooms].sort((a,b)=>Number(b.open)-Number(a.open)).map(roomSvg).join('')}${equipment}</g>`;
  return`<defs>${mapArtDefs}<pattern id="office-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="#7fb5b0" fill-opacity=".16"/><path d="M0 0H24M0 0V24" stroke="#6c9b9a" stroke-opacity=".055"/></pattern></defs>${floorShell}${roomShells}${seatVolumes}${objectVolumes}${world}`;
}
function objectSvg(object,map,e,iso){
  const{width:w,height:h}=object,size=objectSize(object),color=palette(object.color||objectKinds[object.kind]?.color),rot=object.rotation||0,selected=map.objectId===object.id;
  const rotate=rotationTransform(w,h,rot);
  return`<g class="map-object kind-${object.kind} ${selected?'selected':''}" data-map-kind="object" data-map-id="${object.id}" data-object="${object.id}" data-layout="select-object" data-room="${object.roomId||''}" role="button" tabindex="0" aria-label="${e(object.name)}" transform="translate(${object.x} ${object.y})" style="--object-ink:${color.ink};--object-fill:${color.fill}"><title>${e(object.name)}</title><rect class="object-hit" x="-10" y="-10" width="${size.width+20}" height="${size.height+20}" rx="4"/><g class="object-symbol" transform="${rotate}">${furnitureArt(object.kind,w,h)}</g><text class="object-label" x="${size.width/2}" y="${size.height+23}" text-anchor="middle" transform="${readableLabel(iso,size.width/2,size.height+23)}">${e(short(object.name,20))}</text>${map.editing&&selected?resizeHandles('object',object.id,size.width,size.height,true):''}${map.editing&&selected?`<g class="map-move-grip" data-map-move role="button" aria-label="Переместить ${e(object.name)}" transform="translate(${size.width/2} ${size.height/2})"><rect x="-16" y="-11" width="32" height="22" rx="6"/><path d="M-6 -4h1m5 0h1m5 0h1M-6 4h1m5 0h1m5 0h1"/></g>`:''}</g>`;
}
