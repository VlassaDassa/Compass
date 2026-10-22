import {mapColors,objectKinds,objectSize} from './office-model.js';
import {mapArtDefs,furnitureArt} from './map-art.js';

const palette=value=>mapColors[value]||mapColors.stone;
const short=(text,max)=>text.length>max?text.slice(0,Math.max(1,max-1))+'…':text;
const entityLabel={floor:'плана',room:'зоны',object:'объекта',seat:'рабочего места'};
export function resizeHandles(kind,id,width,height,selected=true){
  const edges=[['n',0,0,width,0,'верхний'],['e',width,0,width,height,'правый'],['s',width,height,0,height,'нижний'],['w',0,height,0,0,'левый']];
  const corners=[['nw',0,0,'верхний левый'],['ne',width,0,'верхний правый'],['se',width,height,'нижний правый'],['sw',0,height,'нижний левый']];
  const attrs=(axis,label)=>`data-resize-kind="${kind}" data-resize-id="${id}" data-resize-axis="${axis}" role="button" tabindex="${selected?0:-1}" aria-label="Изменить размер ${entityLabel[kind]}: ${label}" class="map-resize-edge ${axis}"`;
  return `<g class="map-resize-handles ${selected?'is-selected':''}">${selected?`<rect class="resize-selection" width="${width}" height="${height}" rx="2"/>`:''}${edges.map(([axis,x,y,x2,y2,label])=>`<path ${attrs(axis,label+' край')} d="M${x} ${y}L${x2} ${y2}"/>`).join('')}${corners.map(([axis,x,y,label])=>`<path ${attrs(axis,label+' угол')} d="M${x-4} ${y}H${x+4}"/>`).join('')}</g>`;
}
export function sceneSvg(floor,map,{escape,seatSvg}){
  const e=escape;
  const roomSvg=room=>{
    const color=palette(room.color),selected=map.roomId===room.id&&!map.seatId&&!map.objectId;
    const count=floor.seats.filter(s=>s.roomId===room.id).length+(floor.objects||[]).filter(o=>o.roomId===room.id).length;
    return `<g class="office-room map-zone ${room.open?'open-zone':''} ${selected?'selected':''}" data-room-shape="${room.id}" data-map-kind="room" data-map-id="${room.id}" transform="translate(${room.x} ${room.y})" style="--zone-ink:${color.ink};--zone-fill:${color.fill};--zone-header:${color.header}"><rect class="office-room-bg" data-zone-body width="${room.width}" height="${room.height}" rx="2" data-layout="select-room" data-room="${room.id}"/><rect class="room-floor-grain" width="${room.width}" height="${room.height}" fill="url(#map-floorboards)"/><rect class="room-wall-inset" x="5" y="5" width="${Math.max(1,room.width-10)}" height="${Math.max(1,room.height-10)}" rx="1"/><g data-room-drag="${room.id}" data-layout="select-room" data-room="${room.id}" role="button" tabindex="0" aria-label="Зона ${e(room.name)}"><rect class="office-room-title-bg" x="8" y="8" width="${Math.max(1,room.width-16)}" height="${Math.min(49,room.height-16)}" rx="2"/><text x="19" y="30" class="office-room-name">${e(short(room.name,Math.floor((room.width-36)/11)))}</text>${room.height>=100?`<text x="19" y="48" class="office-room-type">${room.open?'Проход · ':''}${count} объектов</text>`:''}</g>${map.editing?resizeHandles('room',room.id,room.width,room.height,selected):''}${floor.seats.filter(s=>s.roomId===room.id).map(seatSvg).join('')}${(floor.objects||[]).filter(o=>o.roomId===room.id).map(o=>objectSvg(o,map,e)).join('')}</g>`;
  };
  return `<defs>${mapArtDefs}<pattern id="office-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#868b8f" fill-opacity=".2"/></pattern></defs><rect class="map-floor-fill" data-map-kind="floor" data-map-id="${floor.id}" width="${floor.width}" height="${floor.height}" rx="3"/><rect class="map-edit-grid" width="${floor.width}" height="${floor.height}" fill="url(#office-dots)"/><rect class="map-floor-edge" data-floor-edge width="${floor.width}" height="${floor.height}" rx="3" fill="none"/><text class="map-floor-label" data-floor-label x="0" y="-23">ПЛАН · ${floor.width} × ${floor.height}</text>${map.editing?resizeHandles('floor',floor.id,floor.width,floor.height,false):''}${[...floor.rooms].sort((a,b)=>Number(b.open)-Number(a.open)).map(roomSvg).join('')}${(floor.objects||[]).filter(o=>!o.roomId).map(o=>objectSvg(o,map,e)).join('')}`;
}
function objectSvg(object,map,e){
  const {width:w,height:h}=object,size=objectSize(object),color=palette(object.color||objectKinds[object.kind]?.color),rot=object.rotation||0,selected=map.objectId===object.id;
  const rotate=rot===90?`translate(${h} 0) rotate(90)`:rot===180?`translate(${w} ${h}) rotate(180)`:rot===270?`translate(0 ${w}) rotate(270)`:'';
  return `<g class="map-object kind-${object.kind} ${selected?'selected':''}" data-map-kind="object" data-map-id="${object.id}" data-object="${object.id}" data-layout="select-object" data-room="${object.roomId||''}" role="button" tabindex="0" aria-label="${e(object.name)}" transform="translate(${object.x} ${object.y})" style="--object-ink:${color.ink};--object-fill:${color.fill}"><title>${e(object.name)}</title><rect class="object-hit" x="-5" y="-5" width="${size.width+10}" height="${size.height+30}" rx="3"/><g class="object-symbol" transform="${rotate}">${furnitureArt(object.kind,w,h)}</g><text class="object-label" x="${size.width/2}" y="${size.height+22}" text-anchor="middle">${e(short(object.name,20))}</text>${map.editing?resizeHandles('object',object.id,size.width,size.height,selected):''}</g>`;
}
