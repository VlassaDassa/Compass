import {objectSize,seatSize,validateRoom,validateObject,validateFloorSize,validateSeatPosition} from './office-model.js';

// Resize in world coordinates. The opposite edge stays anchored, including rotated furniture.
export function resizeLayout(floor,kind,id,axis,dx,dy){
  if(!['n','ne','e','se','s','sw','w','nw'].includes(axis)||![dx,dy].every(Number.isFinite))throw new Error('Некорректное изменение размера.');
  const next=structuredClone(floor),origin={x:0,y:0};
  const item=kind==='floor'?next:kind==='room'?next.rooms.find(r=>r.id===id):kind==='seat'?next.seats.find(s=>s.id===id):next.objects.find(o=>o.id===id);
  if(!item)throw new Error('Объект не найден.');
  const size=kind==='object'?objectSize(item):kind==='seat'?seatSize(item):item;
  const rotatedSeat=kind==='seat'&&item.rotation%180;
  const min=kind==='floor'?{width:400,height:350}:kind==='room'?{width:40,height:40}:kind==='seat'?(rotatedSeat?{width:45,height:60}:{width:60,height:45}):{width:12,height:12};
  const max=kind==='floor'?6000:kind==='room'?5000:kind==='seat'?600:1500;
  const delta={x:Math.round(dx/10)*10,y:Math.round(dy/10)*10};
  const round=value=>Math.round(value*100)/100;
  const clamp=(value,low)=>Math.max(low,Math.min(max,value));
  let width=axis.includes('e')?clamp(size.width+delta.x,min.width):axis.includes('w')?clamp(size.width-delta.x,min.width):size.width;
  let height=axis.includes('s')?clamp(size.height+delta.y,min.height):axis.includes('n')?clamp(size.height-delta.y,min.height):size.height;
  // Furniture is artwork; frames keep their aspect ratio only at the corners.
  if(kind==='object'||kind==='seat'||axis.length===2){
    const horizontal=axis.includes('e')||axis.includes('w'),vertical=axis.includes('n')||axis.includes('s');
    const changeX=horizontal?(axis.includes('w')?-delta.x:delta.x)/size.width:0;
    const changeY=vertical?(axis.includes('n')?-delta.y:delta.y)/size.height:0;
    const change=horizontal&&vertical?(Math.abs(changeX)>=Math.abs(changeY)?changeX:changeY):horizontal?changeX:changeY;
    const scale=Math.max(min.width/size.width,min.height/size.height,Math.min(max/size.width,max/size.height,1+change));
    width=round(size.width*scale);height=round(size.height*scale);
  }
  const shift={x:axis.includes('w')?round(size.width-width):0,y:axis.includes('n')?round(size.height-height):0};
  if(kind==='floor'){
    Object.assign(origin,shift);next.width=width;next.height=height;
    for(const room of next.rooms){room.x=round(room.x-shift.x);room.y=round(room.y-shift.y);}
    for(const object of next.objects||[])if(!object.roomId){object.x=round(object.x-shift.x);object.y=round(object.y-shift.y);}
  }else{
    item.x=round(item.x+shift.x);item.y=round(item.y+shift.y);
    if((kind==='object'||kind==='seat')&&item.rotation%180){item.width=height;item.height=width;}else{item.width=width;item.height=height;}
    if(kind==='room'){
      // Resizing a frame does not drag the furniture inside it.
      for(const child of [...next.seats,...(next.objects||[])])if(child.roomId===id){child.x=round(child.x-shift.x);child.y=round(child.y-shift.y);}
      next.width=Math.max(next.width,item.x+width+40);next.height=Math.max(next.height,item.y+height+40);
    }
  }
  return{floor:next,origin,width,height,kind,id};
}
export function validateLayoutResize(result){
  const f=result.floor;
  validateFloorSize(f,f.width,f.height);
  for(const room of f.rooms)validateRoom(f,room);
  for(const object of f.objects||[])validateObject(f,object);
  for(const seat of f.seats)validateSeatPosition(f,seat.id,seat.x,seat.y);
  return result;
}
