import {mapColors,objectKinds,objectSize} from './office-model.js';

const palette=value=>mapColors[value]||mapColors.stone;
const short=(text,max)=>text.length>max?text.slice(0,Math.max(1,max-1))+'…':text;
export function resizeHandles(kind,id,width,height){
  return `<g class="map-resize-handles" aria-label="Изменение размера">${[['e',width,height/2,'ширину'],['s',width/2,height,'высоту'],['se',width,height,'ширину и высоту']].map(([axis,x,y,label])=>`<g data-resize-kind="${kind}" data-resize-id="${id}" data-resize-axis="${axis}" transform="translate(${x} ${y})" role="button" tabindex="0" aria-label="Изменить ${label} ${kind==='floor'?'плана':'зоны'}" class="map-resize-handle ${axis}"><rect x="-14" y="-14" width="28" height="28" fill="transparent"/><rect class="handle-dot" x="-7" y="-7" width="14" height="14" rx="3"/></g>`).join('')}</g>`;
}
export function sceneSvg(floor,map,{escape,seatSvg}){
  const e=escape;
  const roomSvg=room=>{
    const color=palette(room.color),count=floor.seats.filter(s=>s.roomId===room.id).length+(floor.objects||[]).filter(o=>o.roomId===room.id).length;
    return `<g class="office-room map-zone ${room.open?'open-zone':''} ${map.roomId===room.id&&!map.seatId&&!map.objectId?'selected':''}" data-room-shape="${room.id}" data-map-kind="room" data-map-id="${room.id}" transform="translate(${room.x} ${room.y})" style="--zone-ink:${color.ink};--zone-fill:${color.fill};--zone-header:${color.header}"><rect class="office-room-bg" data-zone-body width="${room.width}" height="${room.height}" rx="${room.open?3:8}" data-layout="select-room" data-room="${room.id}"/><g data-room-drag="${room.id}" data-layout="select-room" data-room="${room.id}" role="button" tabindex="0" aria-label="Зона ${e(room.name)}"><rect class="office-room-title-bg" width="${room.width}" height="${Math.min(57,room.height)}" rx="5"/><text x="16" y="26" class="office-room-name">${e(short(room.name,Math.floor((room.width-32)/11)))}</text>${room.height>=100?`<text x="16" y="44" class="office-room-type">${room.open?'Без стен · ':''}${count} объектов</text>`:''}</g>${floor.seats.filter(s=>s.roomId===room.id).map(seatSvg).join('')}${(floor.objects||[]).filter(o=>o.roomId===room.id).map(o=>objectSvg(o,map,e)).join('')}${map.editing&&map.roomId===room.id&&!map.seatId&&!map.objectId?resizeHandles('room',room.id,room.width,room.height):''}</g>`;
  };
  return `<defs><pattern id="office-dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#343640"/></pattern></defs><rect class="map-floor-fill" data-map-kind="floor" data-map-id="${floor.id}" width="${floor.width}" height="${floor.height}" rx="5" fill="url(#office-dots)"/><rect class="map-floor-edge" data-floor-edge width="${floor.width}" height="${floor.height}" rx="5" fill="none"/><text class="map-floor-label" data-floor-label x="0" y="-23">ПЛАН · ${floor.width} × ${floor.height}</text>${[...floor.rooms].sort((a,b)=>Number(b.open)-Number(a.open)).map(roomSvg).join('')}${(floor.objects||[]).filter(o=>!o.roomId).map(o=>objectSvg(o,map,e)).join('')}${map.editing?resizeHandles('floor',floor.id,floor.width,floor.height):''}`;
}
function objectSvg(object,map,e){
  const {width:w,height:h}=object,size=objectSize(object),color=palette(object.color||objectKinds[object.kind]?.color),rot=object.rotation||0;
  const rotate=rot===90?`translate(${h} 0) rotate(90)`:rot===180?`translate(${w} ${h}) rotate(180)`:rot===270?`translate(0 ${w}) rotate(270)`:'';
  const shapes={
    door:`<path d="M0 ${h}H${w}M0 ${h}V0"/><path d="M0 0A${w} ${h} 0 0 1 ${w} ${h}" fill="none" stroke-dasharray="5 4"/><circle cx="0" cy="${h}" r="4" fill="currentColor"/>`,
    window:`<rect x="0" y="0" width="${w}" height="${h}" rx="2"/><path d="M0 ${h/2}H${w}M${w/2} 0V${h}"/>`,
    printer:`<rect x="${w*.18}" y="0" width="${w*.64}" height="${h*.4}" rx="3"/><rect x="0" y="${h*.25}" width="${w}" height="${h*.55}" rx="7"/><rect x="${w*.16}" y="${h*.6}" width="${w*.68}" height="${h*.4}" rx="2"/><path d="M${w*.26} ${h*.75}H${w*.74}M${w*.26} ${h*.86}H${w*.6}"/><circle cx="${w*.83}" cy="${h*.43}" r="3" fill="currentColor"/>`,
    table:`<rect width="${w}" height="${h}" rx="${Math.min(20,h/4)}"/><path d="M${w*.2} ${h*.3}V${h*.7}M${w*.8} ${h*.3}V${h*.7}" opacity=".4"/>`,
    cabinet:`<rect width="${w}" height="${h}" rx="4"/><path d="M${w/2} 0V${h}M${w*.4} ${h*.4}V${h*.6}M${w*.6} ${h*.4}V${h*.6}"/>`,
    plant:`<ellipse cx="${w/2}" cy="${h/2}" rx="${w*.45}" ry="${h*.45}"/><path d="M${w/2} ${h*.85}V${h*.23}M${w/2} ${h*.55}L${w*.22} ${h*.35}M${w/2} ${h*.67}L${w*.8} ${h*.4}"/>`,
    sofa:`<rect x="${w*.1}" width="${w*.8}" height="${h*.85}" rx="9"/><rect y="${h*.25}" width="${w}" height="${h*.75}" rx="8"/><path d="M${w*.13} ${h*.3}V${h*.82}H${w*.87}V${h*.3}M${w/2} ${h*.35}V${h*.82}"/>`,
    marker:`<rect width="${w}" height="${h}" rx="8"/><path d="M${w/2} ${h*.25}V${h*.58}"/><circle cx="${w/2}" cy="${h*.76}" r="2.5" fill="currentColor"/>`
  };
  return `<g class="map-object kind-${object.kind} ${map.objectId===object.id?'selected':''}" data-map-kind="object" data-map-id="${object.id}" data-object="${object.id}" data-layout="select-object" data-room="${object.roomId||''}" role="button" tabindex="0" aria-label="${e(object.name)}" transform="translate(${object.x} ${object.y})" style="--object-ink:${color.ink};--object-fill:${color.fill}"><title>${e(object.name)}</title><rect class="object-hit" x="-9" y="-9" width="${size.width+18}" height="${size.height+36}" rx="7"/><g class="object-symbol" transform="${rotate}">${shapes[object.kind]||shapes.marker}</g><text class="object-label" x="${size.width/2}" y="${size.height+22}" text-anchor="middle">${e(short(object.name,17))}</text></g>`;
}
export function previewSceneSize(svg,kind,id,width,height){
  const root=kind==='floor'?svg:svg.querySelector(`[data-room-shape="${id}"]`);
  if(!root)return;
  if(kind==='floor'){
    svg.querySelectorAll('.map-floor-fill,[data-floor-edge]').forEach(el=>{el.setAttribute('width',width);el.setAttribute('height',height);});
    const label=svg.querySelector('[data-floor-label]');if(label)label.textContent=`ПЛАН · ${width} × ${height}`;
  }else{
    const body=root.querySelector('[data-zone-body]'),header=root.querySelector('.office-room-title-bg');
    body?.setAttribute('width',width);body?.setAttribute('height',height);header?.setAttribute('width',width);header?.setAttribute('height',Math.min(57,height));
  }
  root.querySelectorAll(`[data-resize-kind="${kind}"][data-resize-id="${id}"]`).forEach(el=>{
    const axis=el.dataset.resizeAxis;el.setAttribute('transform',`translate(${axis==='s'?width/2:width} ${axis==='e'?height/2:height})`);
  });
}
