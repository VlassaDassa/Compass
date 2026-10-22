// Pure layout helpers shared by the UI and the data migration.
export const roomTypes={office:'Кабинет',open:'Открытый офис',meeting:'Переговорная',printing:'Зона печати'};
export const mapColors={amber:{name:'Тёплый',ink:'#c7b58c',fill:'#343536',header:'#3e3e3b'},teal:{name:'Шалфей',ink:'#9cae9f',fill:'#333837',header:'#3d4340'},violet:{name:'Дымчатый',ink:'#aaa6b6',fill:'#36353b',header:'#403e47'},coral:{name:'Глина',ink:'#b6a69d',fill:'#393634',header:'#44403c'},blue:{name:'Стальной',ink:'#a1adb7',fill:'#33383c',header:'#3c4349'},stone:{name:'Графит',ink:'#b0b3b8',fill:'#35383b',header:'#404449'}};
export const objectKinds={door:{name:'Дверь',width:80,height:80,color:'amber'},window:{name:'Окно',width:110,height:16,color:'blue'},printer:{name:'Принтер',width:76,height:70,color:'stone'},table:{name:'Стол',width:140,height:80,color:'amber'},cabinet:{name:'Шкаф',width:85,height:60,color:'stone'},plant:{name:'Растение',width:48,height:48,color:'teal'},sofa:{name:'Диван',width:130,height:65,color:'stone'},marker:{name:'Ориентир',width:75,height:54,color:'coral'}};
export function createOffice(people){
  return upgradeOffice({version:1,floors:[3,4].map(number=>{
    const roomId=`room-${number}-open`;
    return{id:`floor-${number}`,number,name:`${number}-й этаж`,width:1000,height:680,
      rooms:[{id:roomId,name:number===3?'301 · Общий кабинет':'401 · Общий кабинет',type:'open',x:40,y:40,width:560,height:540},{id:`room-${number}-meeting`,name:'Переговорная',type:'meeting',x:640,y:40,width:320,height:240},{id:`room-${number}-print`,name:'Зона печати',type:'printing',x:640,y:320,width:320,height:260}],
      seats:Array.from({length:6},(_,i)=>{const p=people.filter(p=>p.floor===number)[i];return{id:`seat-${number}-${i+1}`,roomId,number:p?.desk||`${number}.${String(i+1).padStart(2,'0')}`,personId:p?.id||'',pc:p?.pc||'',phone:p?.phone||'',phoneIp:p?`192.0.2.${number*10+i+1}`:'',printerName:`DEMO-PRINT-${number}01`,printerIp:`198.51.100.${number*10+1}`,printerModel:'Демо МФУ',x:45+(i%3)*165,y:110+Math.floor(i/3)*190};})};
  })});
}
export function roomOverlaps(a,b,gap=16){return a.x<b.x+b.width+gap&&a.x+a.width+gap>b.x&&a.y<b.y+b.height+gap&&a.y+a.height+gap>b.y;}
export function validateRoom(floor,room){
  if(!room.name.trim())throw new Error('Укажите название зоны.');
  if(![room.x,room.y,room.width,room.height].every(Number.isFinite)||room.x<20||room.y<20||room.width<40||room.height<40||room.width>5000||room.height>5000||room.x+room.width>5980||room.y+room.height>5980)throw new Error('Размер зоны — от 40 до 5000. Координаты — от 20 до 5980, в пределах плана.');
  if(!room.open&&floor.rooms.some(r=>r.id!==room.id&&!r.open&&roomOverlaps(r,room,0)))throw new Error('Зона пересекается с другой. Для коридоров и соединённых проходов включите «Без стен».');
  if(floor.seats.some(s=>s.roomId===room.id&&(s.x<20||s.y<90||s.x+seatSize(s).width>room.width-15||s.y+seatSize(s).height>room.height-15)))throw new Error('В новые размеры не помещаются рабочие места. Увеличьте зону.');
  if((floor.objects||[]).some(o=>o.roomId===room.id&&(o.x<0||o.y<0||o.x+objectSize(o).width>room.width||o.y+objectSize(o).height>room.height)))throw new Error('В новые размеры не помещаются объекты. Переместите их или увеличьте зону.');
}
export function saveRoom(floor,room){validateRoom(floor,room);const i=floor.rooms.findIndex(r=>r.id===room.id);if(i<0)floor.rooms.push(room);else floor.rooms[i]=room;floor.width=Math.max(floor.width,room.x+room.width+40);floor.height=Math.max(floor.height,room.y+room.height+40);}
export function nextRoomPosition(floor,placement='right'){return placement==='bottom'?{x:40,y:Math.max(20,...floor.rooms.map(r=>r.y+r.height))+40}:{x:Math.max(20,...floor.rooms.map(r=>r.x+r.width))+40,y:40};}
export function seatSize(seat){return{width:seat.width??120,height:seat.height??75};}
export function seatsOverlap(a,b){const sa=seatSize(a),sb=seatSize(b);return a.x<b.x+sb.width+10&&a.x+sa.width+10>b.x&&a.y<b.y+sb.height+25&&a.y+sa.height+25>b.y;}
export function nextSeatPosition(floor,room,size={width:120,height:75}){for(let y=90;y+size.height<=room.height-15;y+=size.height+70)for(let x=30;x+size.width<=room.width-15;x+=size.width+30)if(!floor.seats.some(s=>s.roomId===room.id&&seatsOverlap({...size,x,y},s)))return{x,y};throw new Error('В кабинете нет свободного пространства. Сначала увеличьте его размеры.');}
export function locationForPerson(office,personId){for(const floor of office.floors){const seat=floor.seats.find(s=>s.personId===personId);if(seat)return{floor,seat,room:floor.rooms.find(r=>r.id===seat.roomId)};}return null;}
export function assignPerson(office,seatId,personId){if(personId)for(const floor of office.floors)for(const seat of floor.seats)if(seat.personId===personId&&seat.id!==seatId)seat.personId='';const seat=office.floors.flatMap(f=>f.seats).find(s=>s.id===seatId);if(!seat)throw new Error('Рабочее место не найдено.');seat.personId=personId;}
export function validateIp(value){return !value||/^\d{1,3}(\.\d{1,3}){3}$/.test(value)&&value.split('.').every(n=>Number(n)<=255);}
export function resizeFloor(floor,width,height){validateFloorSize(floor,width,height);floor.width=width;floor.height=height;}
export function validateFloorSize(floor,width,height){if(!Number.isFinite(width)||!Number.isFinite(height)||width<400||height<350||width>6000||height>6000)throw new Error('Размеры плана: ширина 400–6000, высота 350–6000.');if(floor.rooms.some(r=>r.x+r.width+20>width||r.y+r.height+20>height)||(floor.objects||[]).some(o=>!o.roomId&&(o.x+objectSize(o).width+20>width||o.y+objectSize(o).height+20>height)))throw new Error('Объекты не помещаются в заданный размер. Увеличьте план.');}

export function snapSeatPosition(floor,seatId,x,y,{snap=10}={}){
  const seat=floor.seats.find(s=>s.id===seatId),room=floor.rooms.find(r=>r.id===seat?.roomId);
  if(!seat||!room)throw new Error('Рабочее место или кабинет не найдены.');
  if(![x,y,snap].every(Number.isFinite)||snap<=0)throw new Error('Некорректные координаты рабочего места.');
  return{x:Math.max(20,Math.min(room.width-seatSize(seat).width-15,Math.round(x/snap)*snap)),y:Math.max(90,Math.min(room.height-seatSize(seat).height-15,Math.round(y/snap)*snap))};
}
export function validateSeatPosition(floor,seatId,x,y){
  const seat=floor.seats.find(s=>s.id===seatId),room=floor.rooms.find(r=>r.id===seat?.roomId);
  if(!seat||!room)throw new Error('Рабочее место или кабинет не найдены.');
  const size=seatSize(seat);if(![size.width,size.height].every(Number.isFinite)||size.width<60||size.height<45||size.width>600||size.height>600)throw new Error('Размер рабочего места: ширина 60–600, высота 45–600.');
  if(![x,y].every(Number.isFinite)||x<20||y<90||x+seatSize(seat).width>room.width-15||y+seatSize(seat).height>room.height-15)throw new Error('Рабочее место должно оставаться внутри кабинета.');
  if(floor.seats.some(s=>s.id!==seatId&&s.roomId===seat.roomId&&seatsOverlap({...seat,x,y},s)))throw new Error('Здесь уже находится другое рабочее место.');
}
export function moveSeat(floor,seatId,x,y,options){
  const position=snapSeatPosition(floor,seatId,x,y,options);
  validateSeatPosition(floor,seatId,position.x,position.y);
  Object.assign(floor.seats.find(s=>s.id===seatId),position);
  return position;
}

export function objectSize(object){return object.rotation%180?{width:object.height,height:object.width}:{width:object.width,height:object.height};}
export function upgradeOffice(office){
  if(office.version>=2)return office;
  for(const floor of office.floors){
    floor.objects??=[];
    floor.rooms.forEach((room,index)=>{
      room.color??=room.type==='meeting'?'violet':room.type==='printing'?'coral':['teal','amber','blue'][index%3];
      room.open??=false;
      if(room.type==='meeting')floor.objects.push({id:`${room.id}-table`,roomId:room.id,kind:'table',name:'Стол переговоров',x:Math.max(0,room.width/2-70),y:Math.max(60,room.height/2-20),width:140,height:70,rotation:0,color:'amber',notes:''});
      if(room.type==='printing')floor.objects.push({id:`${room.id}-printer`,roomId:room.id,kind:'printer',name:'Принтер',x:Math.max(0,room.width/2-38),y:Math.max(60,room.height/2-30),width:76,height:70,rotation:0,color:'violet',notes:'',ip:'',model:''});
    });
  }
  office.version=2;return office;
}
export function validateObject(floor,object){
  if(!objectKinds[object.kind]||!object.name?.trim())throw new Error('Укажите название и вид объекта.');
  if(![object.x,object.y,object.width,object.height,object.rotation].every(Number.isFinite)||object.width<12||object.height<12||object.width>1500||object.height>1500||![0,90,180,270].includes(object.rotation))throw new Error('Размер объекта — от 12 до 1500. Поворот — 0, 90, 180 или 270°.');
  const parent=object.roomId?floor.rooms.find(r=>r.id===object.roomId):floor;
  if(!parent)throw new Error('Зона для объекта не найдена.');
  const size=objectSize(object),padding=object.roomId?0:20;
  if(object.x<padding||object.y<padding||object.x+size.width>parent.width-padding||object.y+size.height>parent.height-padding)throw new Error('Объект выходит за границы зоны или плана. Измените размер, положение или поворот.');
  if(object.ip&&!validateIp(object.ip))throw new Error('Проверьте IP-адрес объекта.');
}
export function saveObject(floor,object){
  validateObject(floor,object);floor.objects??=[];
  const next={...object,color:mapColors[object.color]?object.color:objectKinds[object.kind].color},index=floor.objects.findIndex(o=>o.id===object.id);
  if(index<0)floor.objects.push(next);else floor.objects[index]=next;
  return next;
}
export function snapObjectPosition(floor,id,x,y,{snap=10}={}){
  const object=floor.objects.find(o=>o.id===id),parent=object?.roomId?floor.rooms.find(r=>r.id===object.roomId):floor;
  if(!object||!parent||![x,y,snap].every(Number.isFinite)||snap<=0)throw new Error('Некорректный объект или координаты.');
  const size=objectSize(object),padding=object.roomId?0:20;
  return{x:Math.max(padding,Math.min(parent.width-size.width-padding,Math.round(x/snap)*snap)),y:Math.max(padding,Math.min(parent.height-size.height-padding,Math.round(y/snap)*snap))};
}
export function moveObject(floor,id,x,y,options){const object=floor.objects.find(o=>o.id===id),point=snapObjectPosition(floor,id,x,y,options);saveObject(floor,{...object,...point});return point;}
export function nextObjectPosition(floor,roomId,kind){
  const parent=roomId?floor.rooms.find(r=>r.id===roomId):floor,definition=objectKinds[kind]||objectKinds.marker;
  if(!parent)throw new Error('Сначала добавьте зону.');
  const padding=roomId?0:20;
  if(parent.width<definition.width+padding*2||parent.height<definition.height+padding*2)throw new Error('Объект не помещается. Увеличьте зону или выберите размещение на плане.');
  if(kind==='window')return{x:Math.round((parent.width-definition.width)/2),y:padding};
  if(kind==='door')return{x:Math.min(30,parent.width-definition.width-padding),y:parent.height-definition.height-padding};
  const items=(floor.objects||[]).filter(o=>(o.roomId||'')===(roomId||''));
  for(let y=roomId?70:40;y+definition.height<=parent.height-padding;y+=100)for(let x=roomId?25:40;x+definition.width<=parent.width-padding;x+=100){
    const candidate={x,y,width:definition.width,height:definition.height};
    if(!items.some(o=>roomOverlaps(candidate,{...o,...objectSize(o)},12))&&!floor.seats.some(s=>s.roomId===roomId&&roomOverlaps(candidate,{x:s.x,y:s.y-25,width:seatSize(s).width,height:seatSize(s).height+25},8)))return{x,y};
  }
  return{x:padding,y:padding};
}
export function deleteMapEntity(floor,kind,id){
  if(kind==='room'){
    if(!floor.rooms.some(r=>r.id===id))throw new Error('Зона не найдена.');
    floor.rooms=floor.rooms.filter(r=>r.id!==id);floor.seats=floor.seats.filter(s=>s.roomId!==id);floor.objects=(floor.objects||[]).filter(o=>o.roomId!==id);
  }else if(kind==='seat')floor.seats=floor.seats.filter(s=>s.id!==id);
  else if(kind==='object')floor.objects=(floor.objects||[]).filter(o=>o.id!==id);
  else throw new Error('Этот объект нельзя удалить.');
}
