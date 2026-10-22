// Pure layout helpers shared by the UI and the data migration.
export const roomTypes={office:'Кабинет',open:'Открытый офис',meeting:'Переговорная',printing:'Зона печати'};
export function createOffice(people){
  return {version:1,floors:[3,4].map(number=>{
    const roomId=`room-${number}-open`;
    return{id:`floor-${number}`,number,name:`${number}-й этаж`,width:1000,height:680,
      rooms:[{id:roomId,name:number===3?'301 · Общий кабинет':'401 · Общий кабинет',type:'open',x:40,y:40,width:560,height:540},{id:`room-${number}-meeting`,name:'Переговорная',type:'meeting',x:640,y:40,width:320,height:240},{id:`room-${number}-print`,name:'Зона печати',type:'printing',x:640,y:320,width:320,height:260}],
      seats:Array.from({length:6},(_,i)=>{const p=people.filter(p=>p.floor===number)[i];return{id:`seat-${number}-${i+1}`,roomId,number:p?.desk||`${number}.${String(i+1).padStart(2,'0')}`,personId:p?.id||'',pc:p?.pc||'',phone:p?.phone||'',phoneIp:p?`192.0.2.${number*10+i+1}`:'',printerName:`DEMO-PRINT-${number}01`,printerIp:`198.51.100.${number*10+1}`,printerModel:'Демо МФУ',x:45+(i%3)*165,y:110+Math.floor(i/3)*190};})};
  })};
}
export function roomOverlaps(a,b,gap=16){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
export function validateRoom(floor,room){
  if(!room.name.trim())throw new Error('Укажите название кабинета.');
  if(![room.x,room.y,room.width,room.height].every(Number.isFinite)||room.x<20||room.y<20||room.width<240||room.height<200||room.width>3000||room.height>3000||room.x+room.width>6000||room.y+room.height>6000)throw new Error('Положение и размеры должны находиться в пределах плана: от 20 до 6000. Минимум кабинета — 240 × 200.');
  if(floor.rooms.some(r=>r.id!==room.id&&roomOverlaps(r,room)))throw new Error('Кабинет пересекается с другим. Измените положение или размеры.');
  if(floor.seats.some(s=>s.roomId===room.id&&(s.x+120>room.width-15||s.y+75>room.height-15)))throw new Error('В новые размеры не помещаются рабочие места. Увеличьте кабинет.');
}
export function saveRoom(floor,room){validateRoom(floor,room);const i=floor.rooms.findIndex(r=>r.id===room.id);if(i<0)floor.rooms.push(room);else floor.rooms[i]=room;floor.width=Math.max(floor.width,room.x+room.width+40);floor.height=Math.max(floor.height,room.y+room.height+40);}
export function nextRoomPosition(floor,placement='right'){return placement==='bottom'?{x:40,y:Math.max(20,...floor.rooms.map(r=>r.y+r.height))+40}:{x:Math.max(20,...floor.rooms.map(r=>r.x+r.width))+40,y:40};}
export function nextSeatPosition(floor,room){for(let y=90;y+75<=room.height-15;y+=145)for(let x=30;x+120<=room.width-15;x+=150)if(!floor.seats.some(s=>s.roomId===room.id&&Math.abs(s.x-x)<130&&Math.abs(s.y-y)<100))return{x,y};throw new Error('В кабинете нет свободного пространства. Сначала увеличьте его размеры.');}
export function locationForPerson(office,personId){for(const floor of office.floors){const seat=floor.seats.find(s=>s.personId===personId);if(seat)return{floor,seat,room:floor.rooms.find(r=>r.id===seat.roomId)};}return null;}
export function assignPerson(office,seatId,personId){if(personId)for(const floor of office.floors)for(const seat of floor.seats)if(seat.personId===personId&&seat.id!==seatId)seat.personId='';const seat=office.floors.flatMap(f=>f.seats).find(s=>s.id===seatId);if(!seat)throw new Error('Рабочее место не найдено.');seat.personId=personId;}
export function validateIp(value){return !value||/^\d{1,3}(\.\d{1,3}){3}$/.test(value)&&value.split('.').every(n=>Number(n)<=255);}
export function resizeFloor(floor,width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<400||height<350||width>6000||height>6000)throw new Error('Размеры плана: ширина 400–6000, высота 350–6000.');if(floor.rooms.some(r=>r.x+r.width+20>width||r.y+r.height+20>height))throw new Error('Кабинеты не помещаются в заданный размер. Увеличьте план.');floor.width=width;floor.height=height;}

export function snapSeatPosition(floor,seatId,x,y,{snap=10}={}){
  const seat=floor.seats.find(s=>s.id===seatId),room=floor.rooms.find(r=>r.id===seat?.roomId);
  if(!seat||!room)throw new Error('Рабочее место или кабинет не найдены.');
  if(![x,y,snap].every(Number.isFinite)||snap<=0)throw new Error('Некорректные координаты рабочего места.');
  return{x:Math.max(20,Math.min(room.width-135,Math.round(x/snap)*snap)),y:Math.max(90,Math.min(room.height-90,Math.round(y/snap)*snap))};
}
export function validateSeatPosition(floor,seatId,x,y){
  const seat=floor.seats.find(s=>s.id===seatId),room=floor.rooms.find(r=>r.id===seat?.roomId);
  if(!seat||!room)throw new Error('Рабочее место или кабинет не найдены.');
  if(![x,y].every(Number.isFinite)||x<20||y<90||x+120>room.width-15||y+75>room.height-15)throw new Error('Рабочее место должно оставаться внутри кабинета.');
  if(floor.seats.some(s=>s.id!==seatId&&s.roomId===seat.roomId&&Math.abs(s.x-x)<130&&Math.abs(s.y-y)<100))throw new Error('Здесь уже находится другое рабочее место.');
}
export function moveSeat(floor,seatId,x,y,options){
  const position=snapSeatPosition(floor,seatId,x,y,options);
  validateSeatPosition(floor,seatId,position.x,position.y);
  Object.assign(floor.seats.find(s=>s.id===seatId),position);
  return position;
}
