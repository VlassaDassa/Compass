import {objectSize,seatSize,saveRoom,saveObject,nextSeatPosition,validateSeatPosition} from './office-model.js';
import {validateLayoutResize} from './map-resize.js';

export function mapEntity(floor,kind,id){return(kind==='room'?floor.rooms:kind==='seat'?floor.seats:kind==='object'?floor.objects:[])?.find(x=>x.id===id);}
export function rotateMapEntity(floor,kind,id,angle){
  const next=structuredClone(floor),item=mapEntity(next,kind,id);if(!item)throw new Error('Объект не найден.');
  if(![0,90,180,270].includes(item.rotation||0))throw new Error('Некорректный исходный угол объекта.');
  const target=angle??((item.rotation||0)+90)%360;
  if(![0,90,180,270].includes(target))throw new Error('Выберите поворот 0, 90, 180 или 270°.');
  if(kind==='room'){
    let turns=((target-(item.rotation||0)+360)%360)/90;
    while(turns--){
      const height=item.height;
      for(const [type,children] of [['seat',next.seats],['object',next.objects||[]]])for(const child of children.filter(c=>c.roomId===id)){
        const size=type==='seat'?seatSize(child):objectSize(child),x=child.x;
        child.x=Math.round((height-child.y-size.height)*100)/100;child.y=x;child.rotation=((child.rotation||0)+90)%360;
      }
      [item.width,item.height]=[item.height,item.width];item.rotation=((item.rotation||0)+90)%360;
    }
    next.width=Math.max(next.width,item.x+item.width+40);next.height=Math.max(next.height,item.y+item.height+40);
  }else item.rotation=target;
  validateLayoutResize({floor:next});Object.assign(floor,next);return mapEntity(floor,kind,id);
}
export function copyMapEntity(floor,kind,id){
  const entity=mapEntity(floor,kind,id);if(!entity)throw new Error('Сначала выберите объект.');
  return structuredClone({kind,entity,floorId:floor.id,seats:kind==='room'?floor.seats.filter(s=>s.roomId===id):[],objects:kind==='room'?(floor.objects||[]).filter(o=>o.roomId===id):[]});
}
function nextSeatNumber(floor){let i=1;while(floor.seats.some(s=>s.number===`${floor.number}.${String(i).padStart(2,'0')}`))i++;return`${floor.number}.${String(i).padStart(2,'0')}`;}
export function pasteMapEntity(floor,clipboard,{roomId,offset=30,createId=()=>crypto.randomUUID()}={}){
  if(!clipboard?.entity)throw new Error('Сначала скопируйте объект на карте.');
  const next=structuredClone(floor),kind=clipboard.kind,item=structuredClone(clipboard.entity);item.id=createId();
  if(kind==='room'){
    item.name+=' · копия';let placed=false;
    const positions=[{x:item.x+40,y:item.y+40},{x:Math.max(20,...next.rooms.map(r=>r.x+r.width))+40,y:40},{x:40,y:Math.max(20,...next.rooms.map(r=>r.y+r.height))+40}];
    for(const point of positions){try{saveRoom(next,{...item,...point});Object.assign(item,point);placed=true;break;}catch{}}
    if(!placed)throw new Error('Копия зоны не помещается в пределы плана.');
    for(const seat of clipboard.seats||[])next.seats.push({...structuredClone(seat),id:createId(),roomId:item.id,personId:'',number:nextSeatNumber(next)});
    for(const object of clipboard.objects||[])next.objects.push({...structuredClone(object),id:createId(),roomId:item.id});
  }else if(kind==='seat'){
    item.roomId=roomId||((clipboard.floorId===floor.id&&next.rooms.some(r=>r.id===item.roomId))?item.roomId:next.rooms[0]?.id);
    const parent=next.rooms.find(r=>r.id===item.roomId);if(!parent)throw new Error('Добавьте зону для рабочего места.');
    item.personId='';item.number=nextSeatNumber(next);Object.assign(item,nextSeatPosition(next,parent,seatSize(item)));next.seats.push(item);validateSeatPosition(next,item.id,item.x,item.y);
  }else if(kind==='object'){
    item.roomId=roomId!==undefined?roomId:clipboard.floorId===floor.id?item.roomId:'';
    if(item.roomId&&!next.rooms.some(r=>r.id===item.roomId))item.roomId='';
    const parent=item.roomId?next.rooms.find(r=>r.id===item.roomId):next,size=objectSize(item),padding=item.roomId?0:20;
    item.x=Math.max(padding,Math.min(parent.width-size.width-padding,item.x+offset));item.y=Math.max(padding,Math.min(parent.height-size.height-padding,item.y+offset));
    item.name+=' · копия';saveObject(next,item);
  }else throw new Error('Этот элемент нельзя скопировать.');
  validateLayoutResize({floor:next});Object.assign(floor,next);return{kind,id:item.id};
}
export function deleteOfficeFloor(office,id){if(!office.floors.some(f=>f.id===id))throw new Error('Этаж не найден.');office.floors=office.floors.filter(f=>f.id!==id);}
