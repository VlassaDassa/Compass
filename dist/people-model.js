export function setEmployeeStatus(state,id,status,{date='',releaseSeat=true}={}){
  const p=state.people.find(p=>p.id===id);if(!p)throw new Error('Сотрудник не найден.');if(!['active','dismissed'].includes(status))throw new Error('Неизвестный статус.');
  p.status=status;if(status==='dismissed'){p.dismissedAt=date||new Date().toISOString().slice(0,10);if(releaseSeat)for(const f of state.office.floors)for(const seat of f.seats)if(seat.personId===id)seat.personId='';}else delete p.dismissedAt;
}
export function removeEmployee(state,id){
  if(!state.people.some(p=>p.id===id))throw new Error('Сотрудник не найден.');
  for(const f of state.office.floors)for(const seat of f.seats)if(seat.personId===id)seat.personId='';
  state.people=state.people.filter(p=>p.id!==id);delete state.demoCredentials[id];
}
