import {assignPerson,nextSeatPosition,seatSize,validateSeatPosition} from './office-model.js';

export function ensureBuildings(office){
  office.buildings??=[{id:'building-main',name:'Основной корпус'}];
  if(!office.buildings.length&&office.floors.length)office.buildings.push({id:'building-main',name:'Основной корпус'});
  for(const floor of office.floors)if(!office.buildings.some(b=>b.id===floor.buildingId))floor.buildingId=office.buildings[0].id;
  return office;
}
export function deleteBuilding(office,id){
  if(!office.buildings?.some(b=>b.id===id))throw new Error('Корпус не найден.');
  office.floors=office.floors.filter(f=>f.buildingId!==id);
  office.buildings=office.buildings.filter(b=>b.id!==id);
}
export function createBuilding(office,name,id=crypto.randomUUID(),floorId=crypto.randomUUID()){
  ensureBuildings(office);name=String(name||'').trim();if(!name)throw new Error('Укажите название корпуса.');
  if(office.buildings.some(b=>b.name.toLocaleLowerCase('ru')===name.toLocaleLowerCase('ru')))throw new Error('Корпус с таким названием уже есть.');
  office.buildings.push({id,name});office.floors.push({id:floorId,buildingId:id,number:1,name:'1-й этаж',width:1000,height:680,rooms:[],seats:[],objects:[]});return{buildingId:id,floorId};
}
export function addEmployeeAtSeat(state,floorId,seat,employee){
  const floor=state.office.floors.find(f=>f.id===floorId);if(!floor)throw new Error('Этаж не найден.');
  const next={...seat};if(employee){const name=String(employee.name||'').trim(),department=String(employee.department||'').trim();if(!name||!department)throw new Error('Укажите имя, фамилию и отдел нового сотрудника.');
    const entry={...employee,id:employee.id||crypto.randomUUID(),name,department,initials:name.split(/\s+/).slice(0,2).map(s=>s[0]).join(''),color:'violet',status:'active',notes:''};
    if(entry.email&&state.people.some(p=>p.email?.toLowerCase()===entry.email.toLowerCase()))throw new Error('Сотрудник с такой почтой уже есть.');
    next.personId=entry.id;
    // Validate before adding either record so a placement error is atomic.
    if(next.x===undefined)Object.assign(next,nextSeatPosition(floor,floor.rooms.find(r=>r.id===next.roomId),seatSize(next)));
    const temporary=structuredClone(floor);temporary.seats=temporary.seats.filter(s=>s.id!==next.id);temporary.seats.push(next);validateSeatPosition(temporary,next.id,next.x,next.y);state.people.push(entry);
  }
  const index=floor.seats.findIndex(s=>s.id===next.id);if(index<0)floor.seats.push(next);else floor.seats[index]=next;
  validateSeatPosition(floor,next.id,next.x,next.y);assignPerson(state.office,next.id,next.personId||'');return next;
}
