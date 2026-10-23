// A view over existing per-building floors. Nothing is merged or migrated:
// editor operations continue saving each entity to its original local floor.
export function campusLevels(office,current=1){return [...new Set([current,...office.floors.map(f=>f.number)])].sort((a,b)=>a-b);}
export function campusScene(office,level){
  const buildings=office.buildings||[],columns=Math.max(1,Math.ceil(Math.sqrt(buildings.length))),gap=240;
  const slots=buildings.map(building=>{const floors=office.floors.filter(f=>f.buildingId===building.id);return{building,width:Math.max(1000,...floors.map(f=>f.width)),height:Math.max(680,...floors.map(f=>f.height)),floor:floors.find(f=>f.number===level)||null};});
  const colWidths=Array.from({length:columns},(_,col)=>Math.max(0,...slots.filter((_,i)=>i%columns===col).map(s=>s.width))),rows=Math.ceil(slots.length/columns);
  const rowHeights=Array.from({length:rows},(_,row)=>Math.max(0,...slots.slice(row*columns,(row+1)*columns).map(s=>s.height)));
  const plans=slots.map((slot,i)=>({...slot,level,x:colWidths.slice(0,i%columns).reduce((a,b)=>a+b+gap,0),y:rowHeights.slice(0,Math.floor(i/columns)).reduce((a,b)=>a+b+gap,0),width:slot.floor?.width||slot.width,height:slot.floor?.height||slot.height}));
  return{id:'campus',level,plans,width:Math.max(400,...plans.map(p=>p.x+p.width)),height:Math.max(350,...plans.map(p=>p.y+p.height)),rooms:[],seats:[],objects:[]};
}
export function sourceFloorFor(office,kind,id){return office.floors.find(f=>kind==='floor'?f.id===id:(kind==='room'?f.rooms:kind==='seat'?f.seats:kind==='object'?f.objects:[])?.some(item=>item.id===id));}
export function replaceCampusFloor(scene,floor){return{...scene,plans:scene.plans.map(plan=>plan.floor?.id===floor.id?{...plan,floor,width:floor.width,height:floor.height}:plan)};}
