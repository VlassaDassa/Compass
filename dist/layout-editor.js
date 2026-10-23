import {state,update} from './store.js';
import {mapColors,objectKinds,objectSize,seatSize,seatDimensions,validateSeatPosition,saveRoom,nextRoomPosition,nextSeatPosition,locationForPerson,assignPerson,validateIp,resizeFloor,moveSeat,saveObject,nextObjectPosition,moveObject,deleteMapEntity,personSurnameFirst,personShortName} from './office-model.js';
import {sceneSvg,resizeHandles,isoTransform,isoRectBounds,mapCaption} from './map-scene.js';
import {workstationArt} from './map-art.js';
import {resizeLayout,validateLayoutResize} from './map-resize.js';
import {attachCanvasGestures} from './map-gestures.js';
import {copyValue} from './copy-utils.js';
import {rotateMapEntity,copyMapEntity,pasteMapEntity,deleteOfficeFloor} from './map-actions.js';
import {createOfficeRenderer} from './map-3d.js';
import {ensureBuildings,createBuilding,deleteBuilding,addEmployeeAtSeat} from './workspace-model.js';

let ui,map,active=false,observer,menuAnchor,mapClipboard,pasteOffset=0,renderer;
const undoStack=[],redoStack=[];
const $=selector=>document.querySelector(selector);
const e=value=>ui.esc(value??'');
const icon=name=>ui.icon(name);
const floor=()=>state.office.floors.find(f=>f.id===map.floorId);
const person=id=>state.people.find(p=>p.id===id);
const button=(action,label,attrs='',cls='btn')=>`<button type="button" class="${cls}" data-layout="${action}" ${attrs}>${label}</button>`;
const input=(id,label,value='',type='text',attrs='')=>`<div class="field"><label for="${id}">${label}</label><input id="${id}" value="${e(value)}" type="${type}" ${type==='number'&&id!=='floor-number'?'step="any"':''} ${attrs}></div>`;
const actions=label=>`<div id="layout-error" role="alert"></div><div class="modal-footer">${button('cancel','Отмена')}<button type="submit" class="btn btn-primary">${icon('check')}${label||'Сохранить'}</button></div>`;
function errorMessage(error){const el=$('#layout-error');if(el){el.className='form-error';el.textContent=error.message;}else{status(error.message,true);ui.toast(error.message);}}
function bindForm(id,handler){$(id).addEventListener('submit',async event=>{event.preventDefault();const submit=event.target.querySelector('[type=submit]');submit.disabled=true;try{await handler();}catch(error){errorMessage(error);}finally{if(submit.isConnected)submit.disabled=false;}});}
async function commit(mutator){let before;await update(s=>{before=structuredClone(s.office);mutator(s);});undoStack.push(before);if(undoStack.length>30)undoStack.shift();redoStack.length=0;syncHistoryButtons();}
async function history(redo=false){
  if(map.dragging)return;
  const session=map;
  const source=redo?redoStack:undoStack,target=redo?undoStack:redoStack;if(!source.length)return;
  const snapshot=source.at(-1),current=structuredClone(state.office);await update(s=>s.office=structuredClone(snapshot));source.pop();target.push(current);
  if(!active||map!==session)return;
  if(!state.office.floors.some(f=>f.id===map.floorId))map.floorId=state.office.floors[0]?.id||'';
  map.camera=null;sanitizeSelection();renderPage();status(redo?'Действие повторено':'Последнее действие отменено');
}
function syncHistoryButtons(){if(!active)return;document.querySelectorAll('[data-layout="undo"]').forEach(el=>el.disabled=!undoStack.length);document.querySelectorAll('[data-layout="redo"]').forEach(el=>el.disabled=!redoStack.length);}
export function clearLayoutHistory(){undoStack.length=0;redoStack.length=0;syncHistoryButtons();}
function sanitizeSelection(){const f=floor();if(!f){map.seatId='';map.objectId='';map.roomId='';map.focusRoomId='';return;}if(!f.seats.some(s=>s.id===map.seatId))map.seatId='';if(!f.rooms.some(r=>r.id===map.roomId))map.roomId='';if(!f.rooms.some(r=>r.id===map.focusRoomId))map.focusRoomId='';if(!f.objects.some(o=>o.id===map.objectId))map.objectId='';}
export function disposeLayoutMap(){active=false;observer?.disconnect();observer=null;renderer?.dispose();renderer=null;releaseMapFullscreen();document.body.classList.remove('map-workspace','map-expanded');closeLayoutMenu();map?.gestures.clear();}
export function mountLayoutMap(options){
  ui=options;active=true;observer?.disconnect();ensureBuildings(state.office);
  const loc=locationForPerson(state.office,options.params?.get('person')),f=loc?.floor||state.office.floors.find(f=>f.id===map?.floorId)||state.office.floors[0];
  map={buildingId:f?.buildingId||state.office.buildings[0]?.id,floorId:f?.id||'',roomId:loc?.room.id||'',focusRoomId:loc?.room.id||'',seatId:loc?.seat.id||'',objectId:'',editing:false,expanded:false,nativeFullscreen:false,mode:'plan',camera:null,iso:f?isoTransform(f):null,gestures:new Map(),moved:false};renderPage();
  const assign=options.params?.get('assign');if(assign&&person(assign))queueMicrotask(()=>showAssignPerson(assign));
}
export function refreshLayoutMap(){if(active){sanitizeSelection();renderPage();}}
function editorDock(){
  if(!map.editing)return '<span id="office-drag-status" class="office-map-help" role="status">Выберите объект на карте</span>';
  return `<div class="map-dock-tools" aria-label="Инструменты карты">${button('add-room',icon('plus')+'Зона','title="Добавить зону"','dock-button')}${button('add-corridor','Проход','','dock-button')}${button('add-seat',icon('monitor')+'Место','','dock-button')}<details class="dock-menu"><summary>Объект ${icon('down')}</summary><div class="dock-palette">${Object.entries(objectKinds).map(([kind,d])=>button('add-object',d.name,`data-kind="${kind}"`,'dock-button')).join('')}</div></details><details class="dock-menu"><summary>План ${icon('down')}</summary><div class="dock-palette">${button('add-floor','Добавить этаж','','dock-button')}</div></details>${button('paste',icon('clipboard'),`aria-label="Вставить" ${mapClipboard?'':'disabled'}`,'icon-btn')}${button('undo',icon('undo'),'aria-label="Отменить" title="Ctrl Z"','icon-btn')}${button('redo',icon('redo'),'aria-label="Повторить" title="Ctrl Shift Z"','icon-btn')}</div><span id="office-drag-status" class="office-map-help" role="status">Потяните за край, чтобы изменить размер</span>`;
}
function renderPage(){
  closeLayoutMenu();observer?.disconnect();renderer?.dispose();renderer=null;if(map.expanded)$('#map-fullscreen-root .office-plan-panel')?.remove();document.body.classList.add('map-workspace');
  const f=floor();if(!f){renderEmptyMap();return;}map.buildingId=f.buildingId;map.iso=isoTransform(f);
  $('#main-content').innerHTML=`<div class="map-workspace-heading"><div><h1>Карта офиса</h1><span>Корпуса, рабочие места и команда</span></div>${button('toggle-edit',icon(map.editing?'check':'edit')+(map.editing?'Готово':'Редактировать'),'',map.editing?'btn btn-primary':'btn')}</div>
  <div class="office-layout"><section class="office-plan-panel"><div class="office-map-top"><div class="map-location-selects"><select id="office-building" class="field-select" aria-label="Корпус">${state.office.buildings.map(b=>`<option value="${b.id}" ${b.id===map.buildingId?'selected':''}>${e(b.name)}</option>`).join('')}</select>${button('manage-buildings',icon('building'),'aria-label="Управление корпусами" title="Корпусы: добавить или удалить"','icon-btn map-building-manage')}<select id="office-floor" class="field-select" aria-label="Этаж">${state.office.floors.filter(f=>f.buildingId===map.buildingId).map(f=>`<option value="${f.id}" ${f.id===map.floorId?'selected':''}>${e(f.name)}</option>`).join('')}</select></div><div class="map-view-controls"><div class="office-mode" role="group" aria-label="Вид карты">${button('mode-plan',icon('map'),`aria-label="Карта" aria-pressed="${map.mode==='plan'}"`,map.mode==='plan'?'active':'')}${button('mode-list',icon('list'),`aria-label="Список" aria-pressed="${map.mode==='list'}"`,map.mode==='list'?'active':'')}</div>${button('fullscreen',icon('expand'),`aria-label="${map.expanded?'Выйти из полноэкранного режима':'Карта на весь экран'}" title="${map.expanded?'Выйти · Esc':'Карта на весь экран'}" aria-pressed="${!!map.expanded}"`,'icon-btn map-fullscreen-toggle')}</div></div>
  <div class="office-search-row"><label class="search-field">${icon('search')}<input id="office-search" type="search" placeholder="Сотрудник, зона или объект" aria-label="Найти на карте"></label></div><div id="office-search-results" class="office-search-results hidden"></div>
  <div id="office-viewport" class="office-viewport isometric ${map.editing?'editing':''} ${map.mode==='list'?'hidden':''}"><svg id="office-svg" class="office-svg" role="group" aria-label="Трёхмерная карта ${e(f.name)}"></svg></div><div id="office-seat-list" class="office-seat-list ${map.mode==='list'?'':'hidden'}"></div>
  <div class="office-map-bottom">${editorDock()}<div class="office-zoom-controls">${button('zoom-out','−','aria-label="Уменьшить карту"','icon-btn')}<output id="office-zoom" aria-label="Масштаб">100%</output>${button('zoom-in','+','aria-label="Увеличить карту"','icon-btn')}${button('fit',icon('map'),'aria-label="Вписать план"','icon-btn')}</div></div></section><aside id="office-detail" class="panel office-detail"></aside></div>`;
  document.body.classList.toggle('map-expanded',!!map.expanded);if(map.expanded)syncFullscreenHost();
  renderer=createOfficeRenderer($('#office-viewport'));draw();renderList();refreshLayoutDetails();bindGestures();syncHistoryButtons();
  $('#office-floor').addEventListener('change',event=>changeFloor(event.target.value));
  $('#office-building').addEventListener('change',event=>{map.buildingId=event.target.value;const next=state.office.floors.find(f=>f.buildingId===map.buildingId);changeFloor(next?.id||'');});
  $('#office-search').addEventListener('input',event=>search(event.target.value));
  observer=new ResizeObserver(()=>{if(active&&$('#office-svg'))applyCamera();});observer.observe($('#office-viewport'));
}
function changeFloor(id){map.floorId=id;map.roomId='';map.focusRoomId='';map.seatId='';map.objectId='';map.camera=null;renderPage();}
function renderEmptyMap(){
  releaseMapFullscreen();
  $('#main-content').innerHTML=`<div class="map-workspace-heading"><div><h1>Карта офиса</h1><span>Создайте план корпуса</span></div></div><div class="layout-edit-bar"><div class="layout-main-tools"><select id="empty-building" class="field-select" aria-label="Корпус">${state.office.buildings.map(b=>`<option value="${b.id}" ${b.id===map.buildingId?'selected':''}>${e(b.name)}</option>`).join('')}</select>${button('add-floor',icon('plus')+'Добавить этаж',state.office.buildings.length?'':'disabled')}${button('manage-buildings',icon('building')+'Корпусы','aria-label="Управление корпусами"')}${button('add-building',icon('plus')+'Добавить корпус')}${button('undo',icon('undo'),'aria-label="Отменить действие"','icon-btn')}</div></div><div class="empty"><h2>${state.office.buildings.length?'В корпусе пока нет этажей':'Пока нет корпусов'}</h2><p>${state.office.buildings.length?'Добавьте этаж, чтобы начать размещать зоны и рабочие места.':'Добавьте корпус, чтобы создать первый план офиса.'}</p></div>`;
  $('#empty-building').addEventListener('change',event=>{map.buildingId=event.target.value;changeFloor(state.office.floors.find(f=>f.buildingId===map.buildingId)?.id||'');});syncHistoryButtons();
}
function selection(){return map?.seatId?{kind:'seat',id:map.seatId}:map?.objectId?{kind:'object',id:map.objectId}:map?.roomId?{kind:'room',id:map.roomId}:null;}
function copySelection(kind,id){
  const selected=kind&&id?{kind,id}:selection();if(!selected)return;
  mapClipboard=copyMapEntity(floor(),selected.kind,selected.id);pasteOffset=0;ui.toast('Объект скопирован · Ctrl V — вставить');status('Объект скопирован');
  document.querySelectorAll('[data-layout="paste"]').forEach(el=>el.disabled=false);
}
async function pasteSelection(){
  if(!mapClipboard||!floor())return;
  const targetRoom=map.roomId||map.focusRoomId||undefined;let result;
  await commit(s=>result=pasteMapEntity(s.office.floors.find(f=>f.id===map.floorId),mapClipboard,{roomId:targetRoom,offset:30*(++pasteOffset)}));
  selectState(result.kind,result.id);map.editing=true;ui.closeModal();renderPage();status('Копия добавлена · Ctrl Z — отменить');
}
function defaultCamera(){const f=floor(),iso=map.iso||isoTransform(f),room=f.rooms.find(r=>r.id===map.focusRoomId);if(room)return isoRectBounds(iso,room.x,room.y,room.width,room.height,100);return{x:0,y:0,w:iso.width,h:iso.height};}
function applyCamera(){map.camera??=defaultCamera();const c=map.camera;$('#office-svg')?.setAttribute('viewBox',`${c.x} ${c.y} ${c.w} ${c.h}`);const viewport=$('#office-viewport');if(viewport){const rect=viewport.getBoundingClientRect();viewport.style.setProperty('--map-label-scale',Math.min(2.4,Math.max(.8,Math.max(c.w/Math.max(1,rect.width),c.h/Math.max(1,rect.height)))));}renderer?.render();if($('#office-zoom'))$('#office-zoom').textContent=Math.round(defaultCamera().w/c.w*100)+'%';}
function zoom(factor,anchor){const c=map.camera,base=defaultCamera();const width=Math.max(base.w*.12,Math.min(base.w*2.5,c.w*factor));factor=width/c.w;const p=anchor||{x:c.x+c.w/2,y:c.y+c.h/2};map.camera={x:p.x-(p.x-c.x)*factor,y:p.y-(p.y-c.y)*factor,w:width,h:c.h*factor};applyCamera();}
function worldPoint(x,y){const rect=$('#office-svg').getBoundingClientRect(),c=map.camera,scale=Math.max(c.w/rect.width,c.h/rect.height),view={x:c.x+c.w/2+(x-rect.left-rect.width/2)*scale,y:c.y+c.h/2+(y-rect.top-rect.height/2)*scale},iso=map.iso||isoTransform(floor()),u=(view.x-iso.ox)/iso.sx,v=(view.y-iso.oy)/iso.sy;return{x:(u+v)/2,y:(v-u)/2,view,scale};}
function draw(){if(!active)return;$('#office-svg').innerHTML=sceneSvg(floor(),map,{escape:e,seatSvg});map.camera??=defaultCamera();renderer?.rebuild(floor(),map);applyCamera();}
function seatSvg(seat,iso){
  const dimensions=seatDimensions(seat),rotation=seat.rotation||0;
  const p=person(seat.personId),name=p?personShortName(p.name):'Свободно',size=seatSize(seat),selected=map.seatId===seat.id;
  return `<g class="office-seat ${p?'occupied':'free'} ${selected?'selected':''}" data-map-kind="seat" data-map-id="${seat.id}" data-seat="${seat.id}" data-employee-id="${e(p?.id||'')}" data-layout="select-seat" role="button" tabindex="0" aria-label="${e(p?personSurnameFirst(p.name):'Свободно')}, место ${e(seat.number)}" transform="translate(${seat.x} ${seat.y})"><rect class="seat-hit" x="-12" y="-55" width="${size.width+24}" height="${size.height+65}" rx="4"/><g>${workstationArt(dimensions.width,dimensions.height,rotation)}</g>${mapCaption(name,size.width/2,size.height+8,iso,e,'seat')}${map.editing&&selected?resizeHandles('seat',seat.id,size.width,size.height,true):''}</g>`;
}
function selectState(kind,id){map.seatId=kind==='seat'?id:'';map.objectId=kind==='object'?id:'';map.roomId=kind==='room'?id:kind==='seat'?floor().seats.find(s=>s.id===id)?.roomId||'':kind==='object'?floor().objects.find(o=>o.id===id)?.roomId||'':'';}
function highlight(kind,id){selectState(kind,id);refreshLayoutDetails();document.querySelectorAll('#office-svg [data-map-kind]').forEach(el=>el.classList.toggle('selected',el.dataset.mapKind===kind&&el.dataset.mapId===id));}
function selectEntity(kind,id){selectState(kind,id);draw();refreshLayoutDetails();if(matchMedia('(max-width:760px)').matches){ui.showModal(entityName(kind,id),details());$('.modal').classList.add('office-detail-sheet');$('.overlay').classList.add('office-sheet-overlay');}}
function entityName(kind,id){return kind==='room'?floor().rooms.find(r=>r.id===id)?.name||'Зона':kind==='seat'?'Место '+(floor().seats.find(s=>s.id===id)?.number||''):kind==='object'?floor().objects.find(o=>o.id===id)?.name||'Объект':'План этажа';}
function status(message,error=false){const target=$('#office-drag-status');if(target){target.textContent=message;target.classList.toggle('error',error);}}
function bindGestures(){
  const session=map,floorId=map.floorId;
  attachCanvasGestures({svg:$('#office-svg'),map,getFloor:floor,toWorld:worldPoint,zoom,applyCamera,pick:renderer?(x,y)=>renderer.pick(x,y):undefined,activate:selectEntity,previewEntity:(kind,id,point)=>renderer?.preview(kind,id,point),select:highlight,render:()=>{draw();renderList();refreshLayoutDetails();},report:status,isActive:()=>active&&map===session,
    saveSeat:(id,point)=>commit(s=>moveSeat(s.office.floors.find(f=>f.id===floorId),id,point.x,point.y,{snap:1})),
    saveObject:object=>commit(s=>saveObject(s.office.floors.find(f=>f.id===floorId),object)),
    saveRoom:room=>commit(s=>saveRoom(s.office.floors.find(f=>f.id===floorId),room)),
    previewRoom:room=>{const f=structuredClone(floor());f.rooms[f.rooms.findIndex(r=>r.id===room.id)]=room;$('#office-svg').innerHTML=sceneSvg(f,map,{escape:e,seatSvg});renderer?.preview('room',room.id,room);},
    saveResize:commitResize,
    previewResize:result=>{$('#office-svg').innerHTML=sceneSvg(result.floor,map,{escape:e,seatSvg});renderer?.rebuild(result.floor,map);}
  });
}
async function commitResize(result){
  validateLayoutResize(result);
  await commit(s=>{const index=s.office.floors.findIndex(f=>f.id===result.floor.id);if(index<0)throw new Error('Этаж не найден.');s.office.floors[index]=structuredClone(result.floor);});
  if(result.kind==='floor'){const oldIso=map.iso||isoTransform(result.floor),nextIso=isoTransform(result.floor);map.iso=nextIso;if(map.camera){map.camera.x+=oldIso.sx*(result.origin.y-result.origin.x);map.camera.y-=oldIso.sy*(result.origin.x+result.origin.y);}}
}

function dl(rows){const copyLabels=['Компьютер','Внутренний телефон','IP телефона','Принтер','IP принтера','Модель принтера','IP','Модель'];return `<dl class="equipment-list">${rows.map(([label,value])=>`<div><dt>${e(label)}</dt><dd>${value&&copyLabels.includes(label)?copyValue(value,label,e,icon):e(value||'Не указано')}</dd></div>`).join('')}</dl>`;}
function selectionTools(kind,id){return `<div class="layout-detail-tools">${button('context',`${icon('more')}Действия`,`data-kind="${kind}" data-id="${id}" aria-haspopup="menu"`)}${button('rotate',`${icon('rotate')}Повернуть на 90°`,`data-kind="${kind}" data-id="${id}"`)}${button('copy',`${icon('clipboard')}Копировать`,`data-kind="${kind}" data-id="${id}"`)}${map.editing?button('delete',`${icon('trash')}Удалить`,`data-kind="${kind}" data-id="${id}"`,'btn btn-danger'):''}</div>`;}
function details(){
  const f=floor(),seat=f.seats.find(s=>s.id===map.seatId),object=f.objects.find(o=>o.id===map.objectId),room=f.rooms.find(r=>r.id===map.roomId);
  if(seat){const p=person(seat.personId),r=f.rooms.find(r=>r.id===seat.roomId);return `<div class="between"><span class="badge neutral">Место ${e(seat.number)}</span><span class="badge">${p?'Занято':'Свободно'}</span></div><h2>${e(p?personSurnameFirst(p.name):'Свободное место')}</h2><p>${e(p?.job||'Назначьте сотрудника в карточке места')}</p>${dl([['Зона',r?.name],['Компьютер',seat.pc],['Внутренний телефон',seat.phone||p?.phone],['IP телефона',seat.phoneIp],['Принтер',seat.printerName],['IP принтера',seat.printerIp],['Модель принтера',seat.printerModel],...(map.editing?[['Размер',`${seatSize(seat).width} × ${seatSize(seat).height}`],['Поворот',`${seat.rotation||0}°`],['Положение',`X ${seat.x} · Y ${seat.y}`]]:[])])}${p?ui.personNote(p):''}${button('edit-seat',p?'Изменить назначение':'Назначить или добавить сотрудника',`data-id="${seat.id}"`,'btn office-detail-action')}${p?button('edit-person',`${icon('users')}Карточка сотрудника`,`data-person="${p.id}"`,'btn office-detail-action'):''}<p class="field-help">Правый клик по месту откроет действия и редактирование.</p>`;}
  if(object){const color=mapColors[object.color]||mapColors.stone;return `<span class="layout-kind-label" style="color:${color.ink}"><i style="background:${color.ink}"></i>${e(objectKinds[object.kind]?.name||'Объект')}</span><h2>${e(object.name)}</h2>${dl([['Зона',f.rooms.find(r=>r.id===object.roomId)?.name||'На плане'],['Размер',`${object.width} × ${object.height}`],['Поворот',`${object.rotation}°`],['Положение',`X ${object.x} · Y ${object.y}`],...(object.kind==='printer'?[['IP',object.ip],['Модель',object.model]]:[])])}${object.notes?`<p class="layout-object-note">${e(object.notes)}</p>`:''}<p class="field-help">Правый клик по объекту откроет изменение размера, поворот, копирование и удаление.</p>`;}
  if(room){const count=f.seats.filter(s=>s.roomId===room.id).length+f.objects.filter(o=>o.roomId===room.id).length;return `<span class="layout-kind-label" style="color:${mapColors[room.color]?.ink||'#ccc'}">${room.open?'Зона без стен':'Прямоугольная зона'}</span><h2>${e(room.name)}</h2>${dl([['Размер',`${room.width} × ${room.height}`],['Поворот',`${room.rotation||0}°`],['Положение',`X ${room.x} · Y ${room.y}`],['Внутри',`${count} объектов`]])}<p class="field-help">Тяните за край или угол, чтобы изменить размер. Правый клик открывает остальные действия.</p>`;}
  return `<span class="category-icon purple">${icon('map')}</span><h2>Ваш план офиса</h2><p>Выберите объект на схеме. Зоны и предметы редактируются прямо на карте.</p>${dl([['Размер плана',`${f.width} × ${f.height}`],['Зон',String(f.rooms.length)],['Рабочих мест',String(f.seats.length)],['Предметов',String(f.objects.length)]])}<p class="field-help">Включите режим редактирования, чтобы добавлять элементы. Размер и удаление доступны на самой карте.</p>`;
}
export function refreshLayoutDetails(){if(active&&$('#office-detail'))$('#office-detail').innerHTML=details();}
function renderList(){const f=floor(),rooms=map.focusRoomId?f.rooms.filter(r=>r.id===map.focusRoomId):[...f.rooms,{id:'',name:'На плане'}];const visibleRooms=rooms.filter(r=>f.seats.some(s=>s.roomId===r.id)||f.objects.some(o=>o.kind==='printer'&&(o.roomId||'')===r.id));$('#office-seat-list').innerHTML=visibleRooms.map(r=>{const seats=f.seats.filter(s=>s.roomId===r.id),objects=f.objects.filter(o=>o.kind==='printer'&&(o.roomId||'')===r.id);return `<section><h3>${e(r.name)}</h3>${seats.map(s=>button('select-seat',`<span class="seat-list-icon">${icon('monitor')}</span><span><strong>Место ${e(s.number)}</strong><small>${e(personSurnameFirst(person(s.personId)?.name)||'Свободное место')}</small></span>${icon('chevron')}`,`data-id="${s.id}"`,'office-seat-row')).join('')}${objects.map(o=>button('select-object',`<span class="layout-list-dot" style="background:${mapColors[o.color]?.ink||'#ccc'}"></span><span><strong>${e(o.name)}</strong><small>${e(objectKinds[o.kind]?.name)}</small></span>${icon('chevron')}`,`data-id="${o.id}"`,'office-seat-row')).join('')}${!seats.length&&!objects.length?'<p class="office-empty-room">Пока пусто</p>':''}</section>`;}).join('');}
function search(query){const terms=query.toLocaleLowerCase('ru').trim().split(/\s+/).filter(Boolean),f=floor(),target=$('#office-search-results');if(!terms.length){target.classList.add('hidden');return;}const matches=[];for(const room of f.rooms)if(terms.every(t=>room.name.toLowerCase().includes(t)))matches.push(['room',room.id,room.name]);for(const seat of f.seats)if(terms.every(t=>[seat.number,seat.pc,seat.phoneIp,seat.printerName,seat.printerIp,person(seat.personId)?.name].join(' ').toLowerCase().includes(t)))matches.push(['seat',seat.id,`${seat.number} · ${personSurnameFirst(person(seat.personId)?.name)||'Свободно'}`]);for(const o of f.objects)if(terms.every(t=>[o.name,o.ip,o.model,o.notes,objectKinds[o.kind]?.name].join(' ').toLowerCase().includes(t)))matches.push(['object',o.id,o.name]);target.classList.remove('hidden');target.innerHTML=matches.slice(0,12).map(([kind,id,name])=>button('find',`<span>${e(name)}</span>${icon('arrow')}`,`data-kind="${kind}" data-id="${id}"`,'office-search-result')).join('')||'<p>Ничего не найдено</p>';}
function colors(id,value){return `<fieldset class="layout-color-field"><legend>Цвет</legend><div>${Object.entries(mapColors).map(([key,color])=>`<label class="layout-color-choice"><input type="radio" name="${id}" value="${key}" ${key===value?'checked':''}><span style="--swatch:${color.ink}"><i></i>${color.name}</span></label>`).join('')}</div></fieldset>`;}
function chosenColor(id){return document.querySelector(`input[name="${id}"]:checked`)?.value||'stone';}
function showRoomForm(id,passage=false){
  closeLayoutMenu();const f=floor(),existing=f.rooms.find(r=>r.id===id),point=nextRoomPosition(f,'bottom');
  const room=existing||{id:crypto.randomUUID(),name:passage?'Коридор':'Новая зона',...point,width:passage?500:480,height:passage?140:440,open:passage,color:passage?'stone':['amber','teal','violet','coral'][f.rooms.length%4]};
  ui.showModal(existing?'Изменить зону':'Добавить прямоугольную зону',`<form id="layout-room-form">${input('zone-name','Название',room.name,'text','required maxlength="100" placeholder="Любое название: кухня, холл, отдел…"')}<label class="layout-checkbox"><input id="zone-open" type="checkbox" ${room.open?'checked':''}><span>Без стен — коридор, проход или открытая площадка</span></label>${colors('zone-color',room.color)}<div class="office-form-grid">${input('zone-width','Ширина',room.width,'number','min="40" max="5000" required')}${input('zone-height','Высота',room.height,'number','min="40" max="5000" required')}${input('zone-x','Положение X',room.x,'number','min="20" max="5980" required')}${input('zone-y','Положение Y',room.y,'number','min="20" max="5980" required')}</div><p class="field-help">Зона — обычный прямоугольник. В неё можно добавить любые объекты. Зоны без стен могут соединяться и пересекаться; план расширяется автоматически.</p>${actions(existing?'Сохранить зону':'Добавить зону')}</form>`,true);
  bindForm('#layout-room-form',async()=>{const next={...room,name:$('#zone-name').value.trim(),open:$('#zone-open').checked,color:chosenColor('zone-color'),width:Number($('#zone-width').value),height:Number($('#zone-height').value),x:Number($('#zone-x').value),y:Number($('#zone-y').value)};await commit(s=>saveRoom(s.office.floors.find(f=>f.id===map.floorId),next));selectState('room',next.id);if(!existing){map.focusRoomId=next.id;map.camera=null;}ui.closeModal();renderPage();status('Зона сохранена. Меняйте размер за любой край или угол.');});
}
function nextNumber(f){let n=1;while(f.seats.some(s=>s.number===`${f.number}.${String(n).padStart(2,'0')}`))n++;return`${f.number}.${String(n).padStart(2,'0')}`;}
function showSeatForm(id,roomId){
  closeLayoutMenu();const f=floor(),existing=f.seats.find(s=>s.id===id);if(!f.rooms.length){ui.toast('Добавьте зону для рабочего места');showRoomForm();return;}
  const seat=existing||{id:crypto.randomUUID(),roomId:roomId||map.roomId||f.rooms[0].id,number:nextNumber(f),personId:'',pc:'',phone:'',phoneIp:'',printerName:'',printerIp:'',printerModel:''};
  ui.showModal(existing?'Рабочее место':'Добавить рабочее место',`<form id="layout-seat-form"><div class="office-form-grid">
    <div class="field office-field-full"><label for="seat-person">Сотрудник</label><select id="seat-person"><option value="">Свободное место</option><option value="__new">＋ Добавить нового сотрудника</option>${state.people.filter(p=>p.status!=='dismissed'||p.id===seat.personId).map(p=>`<option value="${p.id}" ${p.id===seat.personId?'selected':''}>${e(personSurnameFirst(p.name))} · ${e(p.department)}</option>`).join('')}</select></div>
    <div id="new-seat-employee" class="office-field-full office-form-grid hidden">${input('new-seat-name','Имя и фамилия','','text','maxlength="100" autocomplete="name"')}${input('new-seat-department','Отдел','','text','maxlength="100"')}${input('new-seat-job','Должность','','text','maxlength="120"')}${input('new-seat-email','Email','','email','maxlength="200"')}</div>
    <div class="field"><label for="seat-room">Зона</label><select id="seat-room">${f.rooms.map(r=>`<option value="${r.id}" ${r.id===seat.roomId?'selected':''}>${e(r.name)}</option>`).join('')}</select></div>
    ${input('seat-number','Номер места',seat.number,'text','required maxlength="30"')}${input('seat-pc','Компьютер',seat.pc,'text','maxlength="100"')}${input('seat-phone','Внутренний телефон',seat.phone,'text','maxlength="30"')}${input('seat-phone-ip','IP телефона',seat.phoneIp,'text','inputmode="decimal" maxlength="15"')}</div>
    <details class="seat-extra"><summary>Принтер рабочего места</summary><div class="office-form-grid">${input('seat-printer-name','Имя принтера',seat.printerName,'text','maxlength="100"')}${input('seat-printer-ip','IP принтера',seat.printerIp,'text','inputmode="decimal" maxlength="15"')}${input('seat-printer-model','Модель',seat.printerModel,'text','maxlength="120"')}</div></details>${actions(existing?'Сохранить':'Добавить место')}</form>`,true);
  $('#seat-person').addEventListener('change',event=>{const isNew=event.target.value==='__new';$('#new-seat-employee').classList.toggle('hidden',!isNew);$('#new-seat-name').required=isNew;$('#new-seat-department').required=isNew;const p=person(event.target.value);if(p&&!$('#seat-phone').value)$('#seat-phone').value=p.phone||'';if(isNew)$('#new-seat-name').focus();});
  bindForm('#layout-seat-form',async()=>{const values={...seat,number:$('#seat-number').value.trim(),roomId:$('#seat-room').value,personId:$('#seat-person').value,rotation:seat.rotation||0};
    for(const [key,id] of Object.entries({pc:'seat-pc',phone:'seat-phone',phoneIp:'seat-phone-ip',printerName:'seat-printer-name',printerIp:'seat-printer-ip',printerModel:'seat-printer-model'}))values[key]=$('#'+id).value.trim();
    if(!values.number)throw new Error('Укажите номер места.');if(!validateIp(values.phoneIp)||!validateIp(values.printerIp))throw new Error('Проверьте IP-адреса.');
    const employee=values.personId==='__new'?{id:crypto.randomUUID(),name:$('#new-seat-name').value,department:$('#new-seat-department').value,job:$('#new-seat-job').value,email:$('#new-seat-email').value.trim(),phone:values.phone}:null;
    await commit(s=>{const f=s.office.floors.find(f=>f.id===map.floorId);if(f.seats.some(x=>x.id!==seat.id&&x.number.toLowerCase()===values.number.toLowerCase()))throw new Error('Место с таким номером уже есть.');if(!existing||values.roomId!==existing.roomId)Object.assign(values,nextSeatPosition(f,f.rooms.find(r=>r.id===values.roomId),seatSize(values)));addEmployeeAtSeat(s,f.id,values,employee);});
    selectState('seat',values.id);map.focusRoomId='';ui.closeModal();renderPage();status(employee?'Сотрудник создан и назначен на место':'Рабочее место сохранено');
  });
}
function showAssignPerson(personId){
  const employee=person(personId);if(!employee)return;
  const options=state.office.floors.flatMap(f=>f.rooms.map(r=>({floor:f,room:r})));
  if(!options.length){ui.toast('Сначала добавьте зону, затем назначьте сотрудника');map.editing=true;renderPage();return;}
  ui.showModal('Добавить на карту',`<form id="assign-person-form"><p>${e(personSurnameFirst(employee.name))}</p><div class="field"><label for="assign-zone">Корпус, этаж и зона</label><select id="assign-zone">${options.map(({floor:f,room:r})=>`<option value="${r.id}">${e(state.office.buildings.find(b=>b.id===f.buildingId)?.name)} · ${e(f.name)} · ${e(r.name)}</option>`).join('')}</select></div><div class="field"><label for="assign-place">Рабочее место</label><select id="assign-place"></select></div>${actions('Добавить на карту')}</form>`);
  const places=()=>{const item=options.find(o=>o.room.id===$('#assign-zone').value);$('#assign-place').innerHTML='<option value="__new">Создать новое место</option>'+item.floor.seats.filter(s=>s.roomId===item.room.id&&!s.personId).map(s=>`<option value="${s.id}">Свободное место ${e(s.number)}</option>`).join('');};
  $('#assign-zone').addEventListener('change',places);places();
  bindForm('#assign-person-form',async()=>{const {floor:f,room:r}=options.find(o=>o.room.id===$('#assign-zone').value),seatId=$('#assign-place').value;
    let id=seatId;await commit(s=>{const target=s.office.floors.find(x=>x.id===f.id);if(id==='__new'){id=crypto.randomUUID();const seat={id,roomId:r.id,number:nextNumber(target),personId,pc:employee.pc||'',phone:employee.phone||'',...nextSeatPosition(target,r)};addEmployeeAtSeat(s,target.id,seat);}else assignPerson(s.office,id,personId);});
    map.floorId=f.id;map.buildingId=f.buildingId;map.camera=null;map.focusRoomId=r.id;selectState('seat',id);ui.closeModal();renderPage();ui.toast('Сотрудник добавлен на карту');
  });
}
function showBuildings(){
  closeLayoutMenu();
  ui.showModal('Корпусы',`<div class="building-list">${state.office.buildings.map(b=>{const floors=state.office.floors.filter(f=>f.buildingId===b.id),seats=floors.reduce((n,f)=>n+f.seats.length,0);return `<div class="building-row"><span class="building-row-icon">${icon('building')}</span><div><h3>${e(b.name)}</h3><p>Этажей: ${floors.length} · Рабочих мест: ${seats}</p></div>${button('delete-building',icon('trash'),`data-id="${b.id}" aria-label="Удалить корпус ${e(b.name)}" title="Удалить корпус"`,'icon-btn danger')}</div>`;}).join('')||'<p class="field-help">Корпусов пока нет. Создайте первый план офиса.</p>'}</div><div class="modal-footer">${button('cancel','Закрыть')}${button('add-building',icon('plus')+'Добавить корпус','','btn btn-primary')}</div>`);
}
function showDeleteBuilding(id){
  const building=state.office.buildings.find(b=>b.id===id);if(!building)return;
  const floors=state.office.floors.filter(f=>f.buildingId===id),seats=floors.reduce((n,f)=>n+f.seats.length,0);
  ui.showModal('Удалить корпус?',`<form id="layout-delete-building"><p class="field-help">Корпус «${e(building.name)}»: этажей — ${floors.length}, рабочих мест — ${seats}. Все планы и объекты этого корпуса будут удалены. Сотрудники останутся в справочнике без назначения на удалённые места. Остальные корпусы не изменятся. Вернуть удалённое можно через Ctrl Z.</p>${actions('Удалить корпус')}</form>`);
  bindForm('#layout-delete-building',async()=>{await commit(s=>deleteBuilding(s.office,id));if(!floor()){const next=state.office.floors[0];map.floorId=next?.id||'';map.buildingId=next?.buildingId||state.office.buildings[0]?.id||'';map.roomId='';map.seatId='';map.objectId='';map.focusRoomId='';map.camera=null;}ui.closeModal();renderPage();ui.toast('Корпус удалён · Ctrl Z — вернуть');});
}
function showBuildingForm(){
  ui.showModal('Добавить корпус',`<form id="layout-building-form">${input('building-name','Название корпуса','','text','required maxlength="100" placeholder="Например: Южный корпус"')}${actions('Создать план')}</form>`);
  bindForm('#layout-building-form',async()=>{let result;await commit(s=>result=createBuilding(s.office,$('#building-name').value));map.buildingId=result.buildingId;map.floorId=result.floorId;map.camera=null;map.focusRoomId='';selectState('floor',result.floorId);ui.closeModal();renderPage();});
}
function showObjectForm(id,kind='door',roomId){
  closeLayoutMenu();const f=floor(),existing=f.objects.find(o=>o.id===id),definition=objectKinds[kind]||objectKinds.door;
  const parent=roomId??map.roomId??'',object=existing||{id:crypto.randomUUID(),roomId:parent,kind:objectKinds[kind]?kind:'door',name:definition.name,width:definition.width,height:definition.height,rotation:0,color:definition.color,x:20,y:80,ip:'',model:'',notes:''};
  if(!existing){try{Object.assign(object,nextObjectPosition(f,parent,object.kind));}catch{object.roomId='';Object.assign(object,nextObjectPosition(f,'',object.kind));}}
  ui.showModal(existing?'Изменить объект':'Добавить объект',`<form id="layout-object-form"><div class="office-form-grid"><div class="field"><label for="object-kind">Вид объекта</label><select id="object-kind">${Object.entries(objectKinds).map(([key,d])=>`<option value="${key}" ${key===object.kind?'selected':''}>${d.name}</option>`).join('')}</select></div><div class="field"><label for="object-room">Разместить в</label><select id="object-room"><option value="">На плане, вне зон</option>${f.rooms.map(r=>`<option value="${r.id}" ${r.id===object.roomId?'selected':''}>${e(r.name)}</option>`).join('')}</select></div><div class="office-field-full">${input('object-name','Название',object.name,'text','required maxlength="100"')}</div></div>${colors('object-color',object.color)}<div class="office-form-grid">${input('object-width','Ширина',object.width,'number','min="12" max="1500" required')}${input('object-height','Высота',object.height,'number','min="12" max="1500" required')}${input('object-x','Положение X',object.x,'number','min="0" max="6000" required')}${input('object-y','Положение Y',object.y,'number','min="0" max="6000" required')}<div class="field"><label for="object-rotation">Поворот</label><select id="object-rotation">${[0,90,180,270].map(r=>`<option value="${r}" ${r===object.rotation?'selected':''}>${r}°</option>`).join('')}</select></div></div><div id="object-network" class="office-form-grid ${object.kind==='printer'?'':'hidden'}">${input('object-ip','IP принтера',object.ip,'text','inputmode="decimal" maxlength="15"')}${input('object-model','Модель принтера',object.model,'text','maxlength="120"')}</div><div class="field"><label for="object-notes">Описание</label><textarea id="object-notes" rows="3" maxlength="3000">${e(object.notes)}</textarea></div><p class="field-help">Двери и окна можно двигать вдоль стен и поворачивать. Объекты в проходах размещаются так же, как в любых других зонах.</p>${actions(existing?'Сохранить объект':'Добавить объект')}</form>`,true);
  let previousKind=object.kind;
  const reposition=()=>{try{const point=nextObjectPosition(f,$('#object-room').value,$('#object-kind').value);$('#object-x').value=point.x;$('#object-y').value=point.y;}catch(error){errorMessage(error);}};
  $('#object-room').addEventListener('change',reposition);
  $('#object-kind').addEventListener('change',event=>{const d=objectKinds[event.target.value];if($('#object-name').value===objectKinds[previousKind].name)$('#object-name').value=d.name;$('#object-width').value=d.width;$('#object-height').value=d.height;$('#object-rotation').value='0';document.querySelector(`input[name="object-color"][value="${d.color}"]`).checked=true;$('#object-network').classList.toggle('hidden',event.target.value!=='printer');previousKind=event.target.value;reposition();});
  bindForm('#layout-object-form',async()=>{const next={...object,kind:$('#object-kind').value,roomId:$('#object-room').value,name:$('#object-name').value.trim(),color:chosenColor('object-color'),notes:$('#object-notes').value.trim(),ip:$('#object-ip').value.trim(),model:$('#object-model').value.trim()};for(const key of ['width','height','x','y','rotation'])next[key]=Number($('#object-'+key).value);await commit(s=>saveObject(s.office.floors.find(f=>f.id===map.floorId),next));selectState('object',next.id);if(map.focusRoomId&&map.focusRoomId!==next.roomId){map.focusRoomId=next.roomId;map.camera=null;}ui.closeModal();renderPage();status('Объект сохранён');});
}
function showFloorSize(){closeLayoutMenu();const f=floor();ui.showModal('Размер плана',`<form id="layout-size-form"><p class="field-help">Тяните за любой край или угол плана. Здесь можно указать точные размеры.</p><div class="office-form-grid">${input('floor-width','Ширина плана',f.width,'number','min="400" max="6000" required')}${input('floor-height','Высота плана',f.height,'number','min="350" max="6000" required')}</div>${actions()}</form>`);bindForm('#layout-size-form',async()=>{await commit(s=>resizeFloor(s.office.floors.find(f=>f.id===map.floorId),Number($('#floor-width').value),Number($('#floor-height').value)));map.focusRoomId='';map.camera=null;ui.closeModal();renderPage();});}
function showFloorForm(){
  if(!state.office.buildings.length){showBuildingForm();return;}
  const buildingId=map.buildingId||state.office.buildings[0].id,number=Math.max(0,...state.office.floors.filter(f=>f.buildingId===buildingId).map(f=>f.number))+1;
  ui.showModal('Добавить этаж',`<form id="layout-floor-form">${input('floor-number','Номер этажа',number,'number','min="1" max="200" required')}${input('floor-name','Название',number+'-й этаж','text','required maxlength="100"')}${actions('Добавить этаж')}</form>`);
  bindForm('#layout-floor-form',async()=>{const number=Number($('#floor-number').value),name=$('#floor-name').value.trim(),id=crypto.randomUUID();if(!name||!Number.isInteger(number)||number<1||number>200)throw new Error('Укажите название и номер этажа от 1 до 200.');await commit(s=>{if(s.office.floors.some(f=>f.buildingId===buildingId&&f.number===number))throw new Error('Такой этаж в корпусе уже есть.');s.office.floors.push({id,buildingId,number,name,width:1000,height:680,rooms:[],seats:[],objects:[]});});map.floorId=id;map.focusRoomId='';selectState('floor',id);map.camera=null;ui.closeModal();renderPage();});
}
async function removeEntity(kind,id){closeLayoutMenu();const name=entityName(kind,id);if(kind==='room'&&map.focusRoomId===id)map.camera=null;await commit(s=>deleteMapEntity(s.office.floors.find(f=>f.id===map.floorId),kind,id));ui.closeModal();map.editing=true;selectState('floor',floor().id);sanitizeSelection();renderPage();status(`«${name}» удалено · Ctrl Z — вернуть`);ui.toast('Объект удалён. Вернуть: «Отменить действие» или Ctrl Z.');}
async function rotateObject(kind,id){await commit(s=>rotateMapEntity(s.office.floors.find(f=>f.id===map.floorId),kind||'object',id));draw();refreshLayoutDetails();status('Объект повёрнут');}
function showDeleteFloor(){
  const f=floor();if(!f)return;closeLayoutMenu();
  ui.showModal('Удалить этаж?',`<form id="layout-delete-floor"><p class="field-help">Этаж «${e(f.name)}»: ${f.rooms.length} зон, ${f.seats.length} рабочих мест, ${f.objects.length} предметов. Сотрудники останутся в справочнике. Удаление можно отменить через Ctrl Z.</p>${actions('Удалить этаж')}</form>`);
  bindForm('#layout-delete-floor',async()=>{await commit(s=>deleteOfficeFloor(s.office,f.id));map.floorId=state.office.floors[0]?.id||'';map.roomId='';map.seatId='';map.objectId='';map.focusRoomId='';map.camera=null;ui.closeModal();renderPage();ui.toast('Этаж удалён · Ctrl Z — вернуть');});
}
export function closeLayoutMenu(focus=false){$('#layout-context-menu')?.remove();if(menuAnchor?.isConnected){menuAnchor.setAttribute('aria-expanded','false');if(focus)menuAnchor.focus({preventScroll:true});}menuAnchor=null;}
function openContext(kind,id,point,anchor){
  closeLayoutMenu();ui.hideSecrets?.();menuAnchor=anchor||document.activeElement;menuAnchor?.setAttribute?.('aria-expanded','true');
  const name=entityName(kind,id),menu=document.createElement('div');menu.id='layout-context-menu';menu.className='office-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',`Действия: ${name}`);
  const item=(action,label,attrs='',danger=false)=>button(action,label,`role="menuitem" tabindex="-1" ${attrs}`,'context-menu-item'+(danger?' danger':''));
  const seat=kind==='seat'?floor().seats.find(s=>s.id===id):null;
  menu.innerHTML=`<div class="context-menu-heading">${e(name)}</div>${kind==='floor'?item('add-room',`${icon('plus')}Добавить зону`)+item('resize-floor',`${icon('expand')}Размер плана`):item(kind==='room'?'edit-room':kind==='seat'?'edit-seat':'edit-object',`${icon('edit')}Изменить ${kind==='room'?'зону':kind==='seat'?'место':'объект'}`,`data-id="${id}"`)}${kind==='room'?item('add-object',`${icon('plus')}Добавить объект`,`data-room="${id}"`)+item('add-seat',`${icon('monitor')}Добавить место`,`data-room="${id}"`):''}${kind!=='floor'?item('rotate',`${icon('rotate')}Повернуть на 90°`,`data-kind="${kind}" data-id="${id}"`)+item('copy',`${icon('clipboard')}Копировать · Ctrl C`,`data-kind="${kind}" data-id="${id}"`):item('delete-floor',`${icon('trash')}Удалить этаж`,'',true)}${mapClipboard?item('paste',`${icon('clipboard')}Вставить · Ctrl V`):''}${seat?.personId?item('person-note',`${icon('clipboard')}Заметка сотрудника`,`data-person="${seat.personId}"`):''}${kind!=='floor'?`<div class="context-menu-divider"></div>${item('delete',`${icon('trash')}${kind==='room'?'Удалить зону с содержимым':kind==='seat'?'Удалить рабочее место':'Удалить объект'}`,`data-kind="${kind}" data-id="${id}"`,true)}`:''}`;
  (document.fullscreenElement||$('#map-fullscreen-root')||document.body).append(menu);const rect=menu.getBoundingClientRect(),bottom=matchMedia('(max-width:760px)').matches?80:10;menu.style.left=Math.max(10,Math.min(point.x,innerWidth-rect.width-10))+'px';menu.style.top=Math.max(10,Math.min(point.y,innerHeight-rect.height-bottom))+'px';menu.querySelector('[role=menuitem]')?.focus({preventScroll:true});
}
async function act(el){
  const {layout:action,id,kind,room,person:personId}=el.dataset;
  if(action!=='context')closeLayoutMenu();
  switch(action){
    case 'cancel':ui.closeModal();break;
    case 'fullscreen':await toggleMapFullscreen();break;
    case 'toggle-edit':map.editing=!map.editing;renderPage();break;
    case 'add-room':showRoomForm();break;
    case 'add-corridor':showRoomForm(null,true);break;
    case 'edit-room':showRoomForm(id);break;
    case 'add-seat':showSeatForm(null,room);break;
    case 'edit-seat':showSeatForm(id);break;
    case 'add-object':showObjectForm(null,kind||'door',room);break;
    case 'edit-object':showObjectForm(id);break;
    case 'resize-floor':showFloorSize();break;
    case 'add-floor':showFloorForm();break;
    case 'add-building':showBuildingForm();break;
    case 'manage-buildings':showBuildings();break;
    case 'delete-building':showDeleteBuilding(el.dataset.id);break;
    case 'rotate':await rotateObject(kind,id);break;
    case 'copy':copySelection(kind,id);break;
    case 'paste':await pasteSelection();break;
    case 'delete-floor':showDeleteFloor();break;
    case 'select-floor':selectEntity('floor',id);break;
    case 'delete':await removeEntity(kind,id);break;
    case 'undo':await history();break;
    case 'redo':await history(true);break;
    case 'edit-person':ui.onPerson(personId);break;
    case 'person-note':ui.onNotes(personId);break;
    case 'select-seat':selectEntity('seat',id||el.dataset.seat);break;
    case 'select-object':selectEntity('object',id||el.dataset.mapId||el.dataset.object);break;
    case 'select-room':selectEntity('room',room||el.closest('[data-room-shape]')?.dataset.roomShape);break;
    case 'mode-plan':map.mode='plan';renderPage();break;
    case 'mode-list':map.mode='list';renderPage();break;
    case 'zoom-in':zoom(.8);break;
    case 'zoom-out':zoom(1.25);break;
    case 'fit':map.focusRoomId='';map.camera=null;draw();renderList();break;
    case 'focus-room':map.focusRoomId=id;map.camera=null;ui.closeModal();renderPage();break;
    case 'find':{selectState(kind,id);map.mode='plan';map.focusRoomId=kind==='room'?id:map.roomId;map.camera=null;renderPage();selectEntity(kind,id);break;}
    case 'context':{const rect=el.getBoundingClientRect();openContext(kind,id,{x:rect.right-260,y:rect.bottom+5},el);break;}
  }
}
document.addEventListener('click',event=>{if(!active)return;const el=event.target.closest('[data-layout]');if(!el)return;event.preventDefault();event.stopImmediatePropagation();act(el).catch(errorMessage);});
document.addEventListener('contextmenu',event=>{if(!active||$('.modal')||!event.target.closest('#office-svg'))return;const caption=event.target.closest('[data-map-caption]'),element=event.target.closest('[data-map-kind]'),hit=renderer&&!caption?renderer.pick(event.clientX,event.clientY):element?{kind:element.dataset.mapKind,id:element.dataset.mapId}:null;if(!hit)return;event.preventDefault();event.stopImmediatePropagation();highlight(hit.kind,hit.id);openContext(hit.kind,hit.id,{x:event.clientX,y:event.clientY},element);});
document.addEventListener('pointerdown',event=>{if($('#layout-context-menu')&&!event.target.closest('#layout-context-menu,[data-layout="context"]'))closeLayoutMenu();},true);
window.addEventListener('scroll',()=>closeLayoutMenu(),{capture:true,passive:true});
window.addEventListener('resize',()=>closeLayoutMenu());
window.addEventListener('blur',()=>{if(map){map.spacePanning=false;$('#office-viewport')?.classList.remove('hand-tool');}});
document.addEventListener('keyup',event=>{if(map&&event.code==='Space'){map.spacePanning=false;$('#office-viewport')?.classList.remove('hand-tool');}});
function clipboardTarget(event){return active&&map?.editing&&!map.dragging&&!$('.modal')&&!event.target.closest('input,textarea,select,[contenteditable=true]');}
document.addEventListener('copy',event=>{if(!clipboardTarget(event)||!selection()||window.getSelection()?.toString())return;copySelection();event.preventDefault();event.clipboardData?.setData('text/plain','Компас · объект карты');});
document.addEventListener('paste',event=>{if(!clipboardTarget(event)||!mapClipboard||!floor())return;event.preventDefault();pasteSelection().catch(errorMessage);});

document.addEventListener('keydown',event=>{
  if(!active)return;
  const menu=$('#layout-context-menu');
  if(menu&&['ArrowDown','ArrowUp','Home','End','Escape','Tab'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();if(['Escape','Tab'].includes(event.key)){closeLayoutMenu(true);return;}const items=[...menu.querySelectorAll('[role=menuitem]')],index=items.indexOf(document.activeElement);items[event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:items.length-1))%items.length]?.focus();return;}
  if($('.modal')||event.target.closest('input,textarea,select,[contenteditable=true]'))return;
  const shortcut={KeyC:'c',KeyV:'v',KeyZ:'z'}[event.code]||event.key.toLowerCase();
  const selected=selection(),entity=event.target.closest('#office-svg [data-map-kind]')||(selected?document.querySelector(`#office-svg [data-map-kind="${selected.kind}"][data-map-id="${selected.id}"]`):null),handle=event.target.closest('[data-resize-kind]');
  if(entity&&(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10')){event.preventDefault();event.stopImmediatePropagation();const rect=entity.getBoundingClientRect();openContext(entity.dataset.mapKind,entity.dataset.mapId,{x:rect.left+20,y:rect.top+20},entity);return;}
  if(map.editing&&!map.dragging&&(event.ctrlKey||event.metaKey)&&['c','v'].includes(shortcut)){
    if(shortcut==='c'&&selected&&!window.getSelection()?.toString()){event.preventDefault();event.stopImmediatePropagation();copySelection();}else if(shortcut==='v'&&mapClipboard&&floor()){event.preventDefault();event.stopImmediatePropagation();pasteSelection().catch(errorMessage);}return;
  }
  if((event.ctrlKey||event.metaKey)&&shortcut==='z'){event.preventDefault();event.stopImmediatePropagation();history(event.shiftKey).catch(errorMessage);return;}
  if(map.editing&&event.code==='Space'&&(map.canvasHovered||event.target.closest('#office-svg'))){event.preventDefault();map.spacePanning=true;$('#office-viewport')?.classList.add('hand-tool');return;}
  if(handle&&['Enter',' '].includes(event.key)){event.preventDefault();const kind=handle.dataset.resizeKind,id=handle.dataset.resizeId;if(kind==='floor')showFloorSize();else if(kind==='room')showRoomForm(id);else if(kind==='seat')showSeatForm(id);else showObjectForm(id);return;}
  if(entity&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();selectEntity(entity.dataset.mapKind,entity.dataset.mapId);return;}
  if(!map.editing||map.dragging)return;
  if(event.repeat&&['Delete','Backspace'].includes(event.key))return;
  if(['Delete','Backspace'].includes(event.key)&&entity&&entity.dataset.mapKind!=='floor'){event.preventDefault();event.stopImmediatePropagation();removeEntity(entity.dataset.mapKind,entity.dataset.mapId).catch(errorMessage);return;}
  if(handle&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
    event.preventDefault();event.stopImmediatePropagation();const step=event.shiftKey?50:10,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0,{resizeKind:kind,resizeId:id,resizeAxis:axis}=handle.dataset;
    commitResize(resizeLayout(floor(),kind,id,axis,dx,dy)).then(()=>{draw();refreshLayoutDetails();document.querySelector(`#office-svg [data-resize-kind="${kind}"][data-resize-id="${id}"][data-resize-axis="${axis}"]`)?.focus({preventScroll:true});status('Размер сохранён');}).catch(errorMessage);return;
  }
  if(!entity||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();event.stopImmediatePropagation();const {mapKind:kind,mapId:id}=entity.dataset,step=event.shiftKey?10:1,dx=event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0,dy=event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0;
  commit(s=>{const f=s.office.floors.find(f=>f.id===map.floorId);if(kind==='seat'){const item=f.seats.find(o=>o.id===id);moveSeat(f,id,item.x+dx,item.y+dy,{snap:1});}else if(kind==='object'){const item=f.objects.find(o=>o.id===id);moveObject(f,id,item.x+dx,item.y+dy,{snap:1});}else if(kind==='room'){const item=f.rooms.find(o=>o.id===id);saveRoom(f,{...item,x:item.x+dx,y:item.y+dy});}}).then(()=>{selectState(kind,id);draw();refreshLayoutDetails();document.querySelector(`#office-svg [data-map-kind="${kind}"][data-map-id="${id}"]`)?.focus({preventScroll:true});status('Положение сохранено');}).catch(errorMessage);
});

// Only this opaque root enters browser fullscreen. Site chrome stays outside,
// while forms and popovers remain children of the active fullscreen element.
function syncFullscreenHost(){
  let root=$('#map-fullscreen-root');if(!root){root=document.createElement('div');root.id='map-fullscreen-root';root.setAttribute('role','region');root.setAttribute('aria-label','Полноэкранная карта офиса');document.body.append(root);}
  const panel=$('#main-content .office-plan-panel');if(panel)root.prepend(panel);
  const overlay=$('#overlay-root');if(overlay&&overlay.parentElement!==root)root.append(overlay);
  return root;
}
function restoreFullscreenHost(){
  const root=$('#map-fullscreen-root');if(!root)return;
  const panel=root.querySelector('.office-plan-panel'),layout=$('#main-content .office-layout');if(panel&&layout)layout.prepend(panel);
  const overlay=root.querySelector('#overlay-root');if(overlay)document.body.append(overlay);root.remove();
}
function releaseMapFullscreen(){
  const root=$('#map-fullscreen-root');if(root&&document.fullscreenElement===root)document.exitFullscreen?.().catch(()=>{});
  if(map){map.expanded=false;map.nativeFullscreen=false;}document.body.classList.remove('map-expanded');restoreFullscreenHost();
}
async function toggleMapFullscreen(){
  if(!active||!floor())return;
  if(map.expanded){map.expanded=false;map.nativeFullscreen=false;if(document.fullscreenElement===$('#map-fullscreen-root'))await document.exitFullscreen().catch(()=>{});document.body.classList.remove('map-expanded');restoreFullscreenHost();}
  else{map.expanded=true;document.body.classList.add('map-expanded');const root=syncFullscreenHost();if(!document.fullscreenElement&&root.requestFullscreen)try{await root.requestFullscreen();map.nativeFullscreen=true;}catch{}}
  updateFullscreenButton();requestAnimationFrame(applyCamera);
}
function updateFullscreenButton(){const button=$('[data-layout="fullscreen"]');if(!button||!map)return;const label=map.expanded?'Выйти из полноэкранного режима':'Карта на весь экран';button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(!!map.expanded));button.title=map.expanded?'Выйти · Esc':label;}
document.addEventListener('fullscreenchange',()=>{if(active&&map?.nativeFullscreen&&!document.fullscreenElement){map.expanded=false;map.nativeFullscreen=false;document.body.classList.remove('map-expanded');restoreFullscreenHost();updateFullscreenButton();requestAnimationFrame(applyCamera);}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&active&&map?.expanded&&!$('.modal')&&!$('#layout-context-menu')&&!$('.custom-select-popover')){event.preventDefault();toggleMapFullscreen().catch(errorMessage);}});
